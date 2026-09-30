import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useState } from "react";
import {
  Image as RNImage,
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
import { Orb } from "../ui/orb";
import { SNAP } from "../../constants/motion";
import { Radius, Space, Type } from "../../constants/theme";
import { STORIES, type Person } from "../../data/people";
import {
  closeStory,
  markStorySeen,
  pickAndPostStory,
  useActiveStory,
  useStoryLiked,
  toggleStoryLike,
} from "../../data/story-state";
import { useFable } from "../../data/store";

const DURATION = 6000;
const ENTER_DELAY = 50;

/** "5m", "2h", "3d" from a timestamp. */
function agoString(at: number) {
  const mins = Math.max(0, Math.round((Date.now() - at) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

/**
 * Mounted once in the root layout, above the navigator, so the viewer always sits on top.
 * The viewer itself stays mounted (hidden) for the life of the app: opening a story only swaps
 * its photo and starts the entrance, so no frame of the entrance is lost to mounting.
 */
export function StoryHost() {
  const active = useActiveStory();
  useEffect(() => () => closeStory(), []);
  // Mount with a real story from the start (hidden), so the first open is as cheap as every other.
  const [shown, setShown] = useState<Person>(active ?? STORIES[1]);
  // Keep the last story on screen while it animates out.
  if (active && active !== shown) setShown(active);
  return (
    <View
      collapsable={false}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "yes" : "no-hide-descendants"}
      accessibilityViewIsModal={!!active}
      pointerEvents={active ? "box-none" : "none"}
      style={StyleSheet.absoluteFill}
    >
      <>
        {active && <StatusBar style="light" />}
        <StoryViewer person={shown} open={!!active} onClose={closeStory} />
      </>
    </View>
  );
}

type Props = {
  person: Person;
  open: boolean;
  onClose: () => void;
};

/**
 * Story viewer: one photo in a large rounded card, glass controls floating
 * over it. Tap or drag down to leave; it leaves on its own when the bar fills.
 * Hosted at the root so it always sits above the navigator.
 */
export function StoryViewer({ person, open, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const liked = useStoryLiked(person.id);
  const { width, height } = useWindowDimensions();

  const ty = useSharedValue(0);
  const enter = useSharedValue(0);
  const progress = useSharedValue(0);
  const armed = useSharedValue(false); // gestures only count once the card has fully arrived

  const markSeen = useCallback(() => markStorySeen(person.id), [person.id]);

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
    progress.set(
      withDelay(
        ENTER_DELAY,
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
        ),
      ),
    );
    return () => {
      cancelAnimation(progress);
    };
  }, [open, person, armed, enter, leave, progress, ty]);

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

  const isMe = person.id === "me";
  const name = isMe ? "Your story" : person.first;
  // Your posted stories live in the fable store (newest first); the viewer
  // shows the latest. Everyone else keeps their bundled story art.
  const myStories = useFable((state) => state.myStories);
  const myLatest = isMe && myStories.length > 0 ? myStories[0] : null;
  const storyUri = myLatest
    ? myLatest.uri
    : RNImage.resolveAssetSource(person.story).uri;
  const ago = myLatest ? agoString(myLatest.at) : person.storyAgo;

  const deleteMyStory = useCallback(() => {
    const stories = useFable.getState().myStories;
    if (stories.length === 0) return;
    useFable.getState().removeStory(stories[0].uri);
    // Nothing left to show — leave the viewer with the usual animation.
    if (stories.length === 1) leave();
  }, [leave]);

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
        />
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
          <Orb source={person.avatar} size={36} shadow={false} />
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
              onPress={() => {
                leave();
                router.push({
                  pathname: "/fable/chat/[id]",
                  params: { id: person.id },
                });
              }}
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
              onPress={() => toggleStoryLike(person.id)}
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
