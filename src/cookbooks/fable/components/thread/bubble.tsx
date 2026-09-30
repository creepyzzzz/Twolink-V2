import { Image } from "expo-image";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeInDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { SFIcon } from "../../../../ui/SFIcon";
import { Glass } from "../ui/glass";
import { EASE_OUT, SNAP, SOFT } from "../../constants/motion";
import { Accent, Ink, Radius, Space, Type } from "../../constants/theme";
import type { Message } from "../../data/messages";
import type { Person } from "../../data/people";
import { useScheme, useTheme } from "../../hooks/use-theme";
import type { ReactionTarget } from "./reaction-picker";
import { MessageText } from "./highlight-text";

/**
 * Fable conversation bubble.
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
  first: boolean; // first bubble of a run gets the wider gap
  animate: boolean; // only messages that arrive after mount animate in
  onReact: (message: Message, target: ReactionTarget) => void;
  /** True while this message's reaction bar is open — the bubble stays pressed down. */
  reacting: boolean;
  /** Swipe right on a bubble to reply to it. */
  onReply: (message: Message) => void;
  /** Tap a photo bubble to open it fullscreen. */
  onOpenPhoto: (message: Message) => void;
  /** Active in-conversation search query — matches highlight in the text. */
  highlight?: string;
  /** This message holds the currently selected search match. */
  highlightActive?: boolean;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const REPLY_TRIGGER = 60;
const DRAG_MAX = 76;

export const Bubble = memo(function Bubble({
  message,
  person,
  first,
  animate,
  onReact,
  reacting,
  onReply,
  onOpenPhoto,
  highlight,
  highlightActive,
}: Props) {
  const theme = useTheme();
  const scheme = useScheme();
  const mine = message.from === "me";
  const bubbleRef = useRef<View>(null);
  const onReactRef = useRef(onReact);
  onReactRef.current = onReact;
  const onReplyRef = useRef(onReply);
  onReplyRef.current = onReply;
  const onOpenPhotoRef = useRef(onOpenPhoto);
  onOpenPhotoRef.current = onOpenPhoto;

  // iMessage-style press-down: the bubble depresses on a soft spring while
  // the reaction bar is open, then settles back when it closes.
  const depress = useSharedValue(1);
  const depressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: depress.value }],
  }));
  useEffect(() => {
    depress.value = withSpring(reacting ? 0.93 : 1, SNAP);
  }, [reacting, depress]);

  // Swipe right to reply: the row follows the finger, a reply arrow fades in
  // beside the bubble, and releasing past the threshold arms the composer.
  // Vertical scrolling still wins — the pan only claims horizontal drags.
  const dragX = useSharedValue(0);
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-16, 16])
        .failOffsetY([-10, 10])
        .onUpdate((e) => {
          dragX.value = Math.max(0, Math.min(e.translationX, DRAG_MAX));
        })
        .onEnd((e) => {
          if (e.translationX > REPLY_TRIGGER)
            runOnJS(onReplyRef.current)(message);
          dragX.value = withSpring(0, SNAP);
        }),
    [dragX, message],
  );
  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }],
  }));
  const hintStyle = useAnimatedStyle(() => ({
    width: (dragX.value / DRAG_MAX) * 38,
    opacity: Math.min(dragX.value / 44, 1),
  }));

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

  const quoteText = message.replyTo
    ? message.replyTo.photo
      ? "Photo"
      : message.replyTo.text
    : "";
  const quote = message.replyTo && (
    <View
      style={[
        styles.quote,
        {
          backgroundColor: mine ? "rgba(255,255,255,0.3)" : theme.chip,
        },
      ]}
    >
      <View
        style={[
          styles.quoteBar,
          { backgroundColor: mine ? "rgba(255,255,255,0.95)" : Accent },
        ]}
      />
      <Text
        numberOfLines={2}
        style={[
          Type.preview,
          { color: mine ? theme.outgoingText : theme.secondary },
        ]}
      >
        {quoteText}
      </Text>
    </View>
  );

  // A device photo when one was picked, otherwise the person's story art
  // (the seed content for the mock thread).
  const photoSource = message.photoUri
    ? { uri: message.photoUri }
    : person.story;

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
        { marginTop: first ? Space[5] : Space[2] },
      ]}
    >
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.dragRow,
            mine ? styles.rowMine : styles.rowTheirs,
            dragStyle,
          ]}
        >
          <Animated.View style={[styles.hint, hintStyle]}>
            <View
              style={[styles.hintCircle, { backgroundColor: theme.chip }]}
            >
              <SFIcon
                name="arrowshape.turn.up.left"
                size={15}
                color={theme.secondary}
              />
            </View>
          </Animated.View>
          {message.photo ? (
            <Animated.View
              ref={bubbleRef}
              style={[styles.photoWrap, depressStyle]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open shared photo"
                onPress={() => onOpenPhotoRef.current(message)}
                onLongPress={handleLongPress}
                delayLongPress={350}
                style={styles.photo}
              >
                <Image
                  source={photoSource}
                  style={{ flex: 1 }}
                  contentFit="cover"
                />
              </Pressable>
              {message.replyTo && (
                <View pointerEvents="none" style={styles.photoQuoteWrap}>
                  <Glass style={styles.photoQuote}>
                    <Text
                      numberOfLines={1}
                      style={[Type.caption, { color: "#FFFFFF" }]}
                    >
                      {quoteText}
                    </Text>
                  </Glass>
                </View>
              )}
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
              {quote}
              <MessageText
                text={message.text}
                query={highlight}
                active={highlightActive}
                mine
                color={theme.outgoingText}
              />
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
              {quote}
              <MessageText
                text={message.text}
                query={highlight}
                active={highlightActive}
                mine={false}
                color={theme.incomingText}
              />
              {badge}
            </AnimatedPressable>
          )}
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
});

export { Ink };

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: Space[4],
  },
  dragRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  rowMine: {
    justifyContent: "flex-end",
  },
  rowTheirs: {
    justifyContent: "flex-start",
    gap: 8,
  },
  hint: {
    overflow: "hidden",
    alignItems: "flex-end",
    justifyContent: "center",
    alignSelf: "stretch",
  },
  hintCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
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
  photoQuoteWrap: {
    position: "absolute",
    top: 10,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  photoQuote: {
    maxWidth: "82%",
    borderRadius: 14,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderCurve: "continuous",
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 7,
  },
  quoteBar: {
    width: 3,
    alignSelf: "stretch",
    borderRadius: 1.5,
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
