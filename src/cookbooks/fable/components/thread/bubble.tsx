import { Image } from "expo-image";
import { router } from "expo-router";
import { memo, useCallback, useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Orb } from "../ui/orb";
import { EASE_OUT, SOFT } from "../../constants/motion";
import { Ink, Radius, Space, Type } from "../../constants/theme";
import type { Message } from "../../data/messages";
import type { Person } from "../../data/people";
import { useScheme, useTheme } from "../../hooks/use-theme";
import type { ReactionTarget } from "./reaction-picker";

export const BUBBLE_AVATAR = 26;

/**
 * Outgoing bubbles leave the composer: they start where the text was typed,
 * a shade lighter and slightly larger (the composer's own scale), and settle
 * into place as ink. Scaling down from 1.02 keeps the glyphs crisp.
 */
const enterOutgoing = () => {
  "worklet";
  return {
    initialValues: {
      opacity: 0,
      transform: [{ translateY: 22 }, { scale: 1.02 }],
    },
    animations: {
      opacity: withTiming(1, { duration: 140 }),
      transform: [
        { translateY: withSpring(0, SOFT) },
        { scale: withSpring(1, SOFT) },
      ],
    },
  };
};

type Props = {
  message: Message;
  person: Person;
  showAvatar: boolean; // last incoming bubble in a run carries the avatar, grouped by sender
  first: boolean; // first bubble of a run gets the wider gap
  animate: boolean; // only messages that arrive after mount animate in
  onReact: (message: Message, target: ReactionTarget) => void;
  /** True while this message's reaction bar is open — the bubble stays pressed down. */
  reacting: boolean;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const Bubble = memo(function Bubble({
  message,
  person,
  showAvatar,
  first,
  animate,
  onReact,
  reacting,
}: Props) {
  const theme = useTheme();
  const scheme = useScheme();
  const mine = message.from === "me";
  const bubbleRef = useRef<View>(null);
  const onReactRef = useRef(onReact);
  onReactRef.current = onReact;

  // iMessage-style press-down: the bubble depresses on a soft spring while
  // the reaction bar is open, then settles back when it closes.
  const depress = useSharedValue(1);
  const depressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: depress.value }],
  }));
  useEffect(() => {
    depress.value = withSpring(reacting ? 0.93 : 1, SOFT);
  }, [reacting, depress]);

  // Long-press anywhere on the bubble (text, photo, or badge) lifts the
  // iOS-style reaction bar. Text is not selectable so the gesture is reliable.
  const handleLongPress = useCallback(() => {
    bubbleRef.current?.measureInWindow((x, y, width) => {
      if (width > 0) onReactRef.current(message, { x, y, width });
    });
  }, [message]);

  const reactions = message.reactions ?? [];
  const badge = reactions.length > 0 && (
    <View
      style={[
        styles.badge,
        mine ? styles.badgeMine : styles.badgeTheirs,
        {
          backgroundColor: theme.surface,
          boxShadow: "0 2px 10px rgba(16, 16, 18, 0.14)",
        },
      ]}
    >
      <Text style={styles.badgeText}>{reactions.join(" ")}</Text>
    </View>
  );

  return (
    <Animated.View
      entering={
        animate
          ? mine
            ? enterOutgoing
            : FadeInDown.duration(260).easing(EASE_OUT.factory())
          : undefined
      }
      style={[
        styles.row,
        mine ? styles.rowMine : styles.rowTheirs,
        { marginTop: first ? Space[5] : Space[2] },
      ]}
    >
      {!mine && (
        <View style={styles.avatarSlot}>
          {showAvatar && <Orb source={person.avatar} size={BUBBLE_AVATAR} />}
        </View>
      )}
      {message.photo ? (
        <Animated.View ref={bubbleRef} style={[styles.photoWrap, depressStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open shared photo"
            onPress={() =>
              router.push({
                pathname: "/fable/photo",
                params: { id: person.id },
              })
            }
            onLongPress={handleLongPress}
            delayLongPress={350}
            style={styles.photo}
          >
            <Image
              source={person.story}
              style={{ flex: 1 }}
              contentFit="cover"
            />
          </Pressable>
          {badge}
        </Animated.View>
      ) : mine ? (
        <AnimatedPressable
          ref={bubbleRef}
          onLongPress={handleLongPress}
          delayLongPress={350}
          style={[
            styles.bubble,
            styles.mine,
            { backgroundColor: theme.outgoing },
            depressStyle,
          ]}
        >
          <Text style={[Type.body, { color: theme.outgoingText }]}>
            {message.text}
          </Text>
          {badge}
        </AnimatedPressable>
      ) : (
        <AnimatedPressable
          ref={bubbleRef}
          onLongPress={handleLongPress}
          delayLongPress={350}
          style={[
            styles.bubble,
            styles.theirs,
            {
              backgroundColor: theme.surface,
              boxShadow:
                scheme === "dark"
                  ? undefined
                  : "0 4px 18px rgba(16, 16, 18, 0.05)",
            },
            depressStyle,
          ]}
        >
          <Text style={[Type.body, { color: theme.incomingText }]}>
            {message.text}
          </Text>
          {badge}
        </AnimatedPressable>
      )}
    </Animated.View>
  );
});

export { Ink };

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Space[4],
  },
  rowMine: {
    justifyContent: "flex-end",
  },
  rowTheirs: {
    justifyContent: "flex-start",
    gap: 8,
  },
  avatarSlot: {
    width: BUBBLE_AVATAR,
    height: BUBBLE_AVATAR,
  },
  photoWrap: {
    width: "72%",
    aspectRatio: 0.9,
  },
  photo: {
    flex: 1,
    borderRadius: 26,
    overflow: "hidden",
  },
  bubble: {
    maxWidth: "74%",
    borderRadius: Radius.bubble,
    borderCurve: "continuous",
  },
  mine: {
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  theirs: {
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  badge: {
    position: "absolute",
    bottom: -13,
    borderRadius: 14,
    borderCurve: "continuous",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeMine: {
    right: 14,
  },
  badgeTheirs: {
    left: 14,
  },
  badgeText: {
    fontSize: 14,
    lineHeight: 18,
  },
});
