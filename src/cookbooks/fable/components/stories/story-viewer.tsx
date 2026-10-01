import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  ReduceMotion,
  useReducedMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Glass } from "../ui/glass";
import { GlassButton } from "../ui/glass-button";
import { Avatar } from "../ui/avatar";
import { SNAP } from "../../constants/motion";
import { Radius, Space, Type } from "../../constants/theme";
import { avatarSource, type Person } from "../../data/people";
import {
  closeStory,
  markStorySeen,
  pickAndPostStory,
  useActiveStoryUserId,
  useStoryLiked,
  toggleStoryLike,
} from "../../data/story-state";
import { deleteStoryDb, getOrCreateDirectChat } from "../../../../lib/chat";
import { useFable, type StoryItem } from "../../data/store";

const DURATION = 6000;
const ENTER_DELAY = 50;

/**
 * Mounted once in the root layout, above the navigator, so the viewer always sits on top.
 * The viewer itself stays mounted (hidden) for the life of the app: opening a story only swaps
 * its photo and starts the entrance, so no frame of the entrance is lost to mounting.
 */
export function StoryHost() {
  const activeUserId = useActiveStoryUserId();
  const stories = useFable((s) => s.stories);
  const people = useFable((s) => s.people);
  const myId = useFable((s) => s.myId);
  useEffect(() => () => closeStory(), []);
  // The latest story from the opened user (newest first in the store).
  const current =
    activeUserId && people[activeUserId]
      ? stories.find((s) => s.userId === activeUserId) ?? null
      : null;
  // Keep the last story mounted while it animates out (exit plays on `open=false`).
  const [shown, setShown] = useState<{
    item: StoryItem;
    person: Person;
    isMe: boolean;
  } | null>(null);
  if (
    current &&
    people[activeUserId!] &&
    current.id !== shown?.item.id
  )
    setShown({
      item: current,
      person: people[activeUserId!],
      isMe: activeUserId === myId,
    });
  return (
    <View
      collapsable={false}
      accessibilityElementsHidden={!activeUserId}
      importantForAccessibility={activeUserId ? "yes" : "no-hide-descendants"}
      accessibilityViewIsModal={!!activeUserId}
      pointerEvents={activeUserId ? "box-none" : "none"}
      style={StyleSheet.absoluteFill}
    >
      <>
        {activeUserId && <StatusBar style="light" />}
        {shown && (
          <StoryViewer
            item={shown.item}
            person={shown.person}
            isMe={shown.isMe}
            open={!!activeUserId}
            onClose={closeStory}
          />
        )}
      </>
    </View>
  );
}

type Props = {
  item: StoryItem;
  person: Person;
  isMe: boolean;
  open: boolean;
  onClose: () => void;
};

/**
 * Story viewer: one photo in a large rounded card, glass controls floating
 * over it. Tap or drag down to leave; it leaves on its own when the bar fills.
 * Hosted at the root so it always sits above the navigator.
 */
export function StoryViewer({ item, person, isMe, open, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const liked = useStoryLiked(item.id);
  const { width, height } = useWindowDimensions();
  const [loaded, setLoaded] = useState(false);

  const ty = useSharedValue(0);
  const enter = useSharedValue(0);
  const progress = useSharedValue(0);
  const armed = useSharedValue(false); // gestures only count once the card has fully arrived

  const markSeen = useCallback(
    () => markStorySeen(item.id),
    [item.id],
  );

  const leave = useCallback(() => {
    "worklet";
    if (!armed.get()) return;
    armed.set(false);
    cancelAnimation(progress);
    // Let go of touches now, not when the exit ends: the list underneath answers the very next tap or drag.
    scheduleOnRN(onClose);
    ty.set(
      withTiming(height * 0.6, {
        duration: 240,
        easing: Easing.in(Easing.cubic),
      }),
    );
    enter.set(
      withTiming(0, { duration: 200 }, (done) => {
        if (done) scheduleOnRN(markSeen);
      }),
    );
  }, [armed, enter, markSeen, height, onClose, progress, ty]);

  useEffect(() => {
    if (!open) return;
    ty.set(0);
    armed.set(false);
    enter.set(0);
    progress.set(0);
    setLoaded(false);
    // Start a few frames after the new photo and name are committed, while the card is still invisible,
    // so the swap never costs a frame of the entrance.
    enter.set(
      withDelay(
        ENTER_DELAY,
        withTiming(
          1,
          { duration: 280, easing: Easing.out(Easing.cubic) },
          (done) => {
            if (done) armed.set(true);
          },
        ),
      ),
    );
  }, [open, item, armed, enter, ty]);

  useEffect(() => {
    if (!open || !loaded) return;
    progress.set(
      withTiming(
        1,
        {
          duration: DURATION,
          easing: Easing.linear,
          reduceMotion: ReduceMotion.Never,
        },
        (done) => {
          if (done) {
            armed.set(true);
            leave();
          }
        },
      )
    );
    return () => {
      cancelAnimation(progress);
    };
  }, [open, loaded, item, armed, leave, progress]);

  const tap = Gesture.Tap().onEnd((_e, success) => {
    if (success) leave();
  });
  const pan = Gesture.Pan()
    .onChange((e) => {
      ty.set(Math.max(0, ty.get() + e.changeY));
    })
    .onEnd((e) => {
      if (ty.get() > 120 || e.velocityY > 900) leave();
      else ty.set(withSpring(0, { ...SNAP, velocity: e.velocityY }));
    });
  const surface = Gesture.Exclusive(pan, tap);

  const backdrop = useAnimatedStyle(() => ({
    opacity: enter.get() * (1 - ty.get() / height),
  }));
  const card = useAnimatedStyle(() => {
    const e = enter.get();
    const t = ty.get();
    return {
      opacity: e,
      transform: [
        { translateY: reduced ? 0 : t + (1 - e) * 28 },
        { scale: reduced ? 1 : (0.94 + 0.06 * e) * (1 - (t / height) * 0.18) },
      ],
    };
  });
  const bar = useAnimatedStyle(() => ({
    width: progress.get() * (width - 2 * Space[4]),
  }));

  const name = isMe ? "Your story" : person.first;
  const storyUri = item.mediaUrl;
  const ago = item.ago;

  const deleteMyStory = useCallback(() => {
    void deleteStoryDb(item.id)
      .then(() => useFable.getState().refreshStories())
      .catch(() => {});
    // Leave the viewer with the usual animation.
    leave();
  }, [item.id, leave]);

  const replyToStory = useCallback(() => {
    leave();
    void getOrCreateDirectChat(person.id).then((chatId) => {
      router.push({
        pathname: "/fable/chat/[id]",
        params: { id: chatId },
      });
    });
  }, [leave, person.id]);

  return (
    <View collapsable={false} style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}
      />
      <Animated.View
        style={[
          styles.card,
          { top: insets.top, bottom: Math.max(insets.bottom, Space[4]) },
          card,
        ]}
      >
        <Image
          source={{ uri: storyUri }}
          cachePolicy="memory"
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={0}
          onLoad={() => setLoaded(true)}
        />
        {!loaded && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', zIndex: 10 }]}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        )}
        {/* Gesture surface sits under the controls so the buttons stay ordinary pressables. */}
        <GestureDetector gesture={surface}>
          <Animated.View
            accessibilityLabel="Dismiss story"
            style={StyleSheet.absoluteFill}
          />
        </GestureDetector>
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(0,0,0,0.42)", "rgba(0,0,0,0)"]}
          locations={[0, 1]}
          style={styles.topScrim}
        />
        {/* Real photos can be bright at the bottom; keep the reply line readable on any of them. */}
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.36)"]}
          locations={[0, 1]}
          style={styles.bottomScrim}
        />
        <View style={styles.track}>
          <Animated.View style={[styles.fill, bar]} />
        </View>
        <View style={styles.header}>
          <Avatar source={avatarSource(person)} size={36} />
          <Text
            numberOfLines={1}
            style={[Type.name, styles.name, { flexShrink: 1 }]}
          >
            {name}
          </Text>
          {!!ago && (
            <Text style={[Type.meta, styles.ago]}>{ago}</Text>
          )}
          <View style={styles.spacer} />
          {isMe && (
            <>
              <GlassButton
                symbol="trash"
                iconSize={15}
                size={40}
                tint="#FFFFFF"
                accessibilityLabel="Delete this story"
                onPress={deleteMyStory}
              />
              <GlassButton
                symbol="plus"
                iconSize={15}
                size={40}
                tint="#FFFFFF"
                accessibilityLabel="Add to your story"
                onPress={() => pickAndPostStory()}
              />
            </>
          )}
          <GlassButton
            symbol="xmark"
            iconSize={15}
            size={40}
            tint="#FFFFFF"
            accessibilityLabel="Close"
            onPress={() => leave()}
          />
        </View>
        {!isMe && (
          <View pointerEvents="box-none" style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Reply to ${name}`}
              onPress={replyToStory}
              style={{ flex: 1 }}
            >
              <Glass effect="clear" style={styles.reply}>
                <Text style={[Type.body, styles.replyText]}>
                  Reply to {person.first}
                </Text>
              </Glass>
            </Pressable>
            <GlassButton
              symbol={liked ? "heart.fill" : "heart"}
              iconSize={19}
              size={48}
              tint="#FFFFFF"
              accessibilityLabel={liked ? "Unlike story" : "Like story"}
              onPress={() => toggleStoryLike(item.id)}
            />
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "#000000",
  },
  card: {
    position: "absolute",
    left: 0,
    right: 0,
    borderRadius: Radius.panel,
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: "#101012",
  },
  topScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 160,
  },
  bottomScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 180,
  },
  track: {
    position: "absolute",
    top: Space[4],
    left: Space[4],
    right: Space[4],
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.35)",
    overflow: "hidden",
  },
  fill: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#FFFFFF",
  },
  header: {
    position: "absolute",
    top: Space[4] + 14,
    left: Space[4],
    right: Space[4],
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  name: {
    color: "#FFFFFF",
  },
  ago: {
    color: "rgba(255,255,255,0.72)",
  },
  spacer: {
    flex: 1,
  },
  footer: {
    position: "absolute",
    left: Space[4],
    right: Space[4],
    bottom: Space[4],
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  reply: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  replyText: {
    color: "rgba(255,255,255,0.9)",
  },
});
