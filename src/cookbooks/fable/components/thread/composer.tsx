import { SFIcon } from "../../../../ui/SFIcon";
import { requestRecordingPermissionsAsync } from "expo-audio";
import { useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
} from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import Animated, {
  FadeInDown,
  FadeOutDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Glass } from "../ui/glass";
import { EASE_OUT } from "../../constants/motion";
import { Accent, Radius, Space, Type } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";
import { EmojiPanel } from "./emoji-panel";
import { VoiceRecorder } from "./voice-recorder";

const BTN = 44;

export type ReplyPreview = {
  name: string;
  text: string;
  photo: boolean;
  voice?: boolean;
};

type Props = {
  insetBottom: number;
  onSend: (text: string) => void;
  onSendVoice: (uri: string, durationSec: number, waveform: number[]) => void;
  onAttach: () => void;
  onLayoutHeight: (h: number) => void; // full height incl. safe-area padding
  /** When set, a slim iMessage-style "replying to" strip sits above the input. */
  replyPreview?: ReplyPreview | null;
  onCancelReply?: () => void;
};

/**
 * The floating composer card in liquid glass: the text line on top,
 * a row of round actions beneath. It rides the keyboard, including the
 * interactive drag-to-dismiss, and the send button swaps in for the mic
 * the moment there is text.
 */
export function Composer({
  insetBottom,
  onSend,
  onSendVoice,
  onAttach,
  onLayoutHeight,
  replyPreview,
  onCancelReply,
}: Props) {
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);
  const draft = useRef("");
  const selRef = useRef({ start: 0, end: 0 });
  const [hasText, setHasText] = useState(false);
  const [recording, setRecording] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const sendT = useSharedValue(0);

  const sendStyle = useAnimatedStyle(() => ({
    opacity: sendT.get(),
    transform: [{ scale: 0.7 + 0.3 * sendT.get() }],
  }));
  const micStyle = useAnimatedStyle(() => ({
    opacity: 1 - sendT.get(),
    transform: [{ scale: 1 - 0.3 * sendT.get() }],
  }));

  const onChangeText = (t: string) => {
    draft.current = t;
    const has = t.trim().length > 0;
    if (has !== hasText) {
      setHasText(has);
      sendT.set(withTiming(has ? 1 : 0, { duration: 180, easing: EASE_OUT }));
    }
  };

  const submit = () => {
    const text = draft.current.trim();
    if (!text) return;
    inputRef.current?.clear();
    onChangeText("");
    onSend(text);
  };

  const onLayout = (e: LayoutChangeEvent) =>
    onLayoutHeight(e.nativeEvent.layout.height);

  const onSelectionChange = (
    e: NativeSyntheticEvent<TextInputSelectionChangeEventData>,
  ) => {
    selRef.current = e.nativeEvent.selection;
  };

  /** Insert an emoji at the caret, iOS-keyboard style. */
  const insertEmoji = (emoji: string) => {
    const { start, end } = selRef.current;
    const cur = draft.current;
    const safeStart = Math.min(start, cur.length);
    const safeEnd = Math.min(end, cur.length);
    const next = cur.slice(0, safeStart) + emoji + cur.slice(safeEnd);
    draft.current = next;
    inputRef.current?.setNativeProps({ text: next });
    const pos = safeStart + emoji.length;
    selRef.current = { start: pos, end: pos };
    requestAnimationFrame(() => {
      inputRef.current?.setNativeProps({
        selection: { start: pos, end: pos },
      });
    });
    onChangeText(next);
  };

  const startRecording = async () => {
    Keyboard.dismiss();
    setEmojiOpen(false);
    let perm;
    try {
      perm = await requestRecordingPermissionsAsync();
    } catch {
      perm = null;
    }
    if (!perm?.granted) {
      Alert.alert(
        "Microphone",
        "Voice recording needs microphone access and the latest dev build. Allow the microphone in Settings, or rebuild the dev client if you just updated.",
      );
      return;
    }
    setRecording(true);
  };

  const sendVoice = (uri: string, durationSec: number, waveform: number[]) => {
    setRecording(false);
    onSendVoice(uri, durationSec, waveform);
  };

  return (
    <KeyboardStickyView
      offset={{ closed: 0, opened: insetBottom }}
      style={styles.sticky}
    >
      <View
        onLayout={onLayout}
        style={[styles.root, { paddingBottom: insetBottom + Space[2] }]}
      >
        <Animated.View
          layout={LinearTransition.duration(220).easing(EASE_OUT.factory())}
          style={[styles.lift, { boxShadow: theme.lift }]}
        >
          <Glass style={styles.card}>
            {replyPreview && (
              <Animated.View
                entering={FadeInDown.duration(220).easing(EASE_OUT.factory())}
                style={styles.replyRow}
              >
                <View
                  style={[styles.replyBar, { backgroundColor: Accent }]}
                />
                <View style={styles.replyTextWrap}>
                  <Text
                    numberOfLines={1}
                    style={[Type.caption, { color: Accent }]}
                  >
                    {replyPreview.name}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[Type.preview, { color: theme.secondary }]}
                  >
                    {replyPreview.photo
                      ? "Photo"
                      : replyPreview.voice
                        ? "Voice message"
                        : replyPreview.text}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cancel reply"
                  onPress={onCancelReply}
                  hitSlop={8}
                  style={styles.replyClose}
                >
                  <SFIcon name="xmark" size={12} color={theme.tertiary} />
                </Pressable>
              </Animated.View>
            )}
            {recording ? (
              <VoiceRecorder
                onSend={sendVoice}
                onCancel={() => setRecording(false)}
              />
            ) : (
              <>
                <TextInput
                  ref={inputRef}
                  accessibilityLabel="Message"
                  testID="fable-message-input"
                  multiline
                  placeholder="Message"
                  placeholderTextColor={theme.placeholder}
                  onChangeText={onChangeText}
                  onSelectionChange={onSelectionChange}
                  onFocus={() => setEmojiOpen(false)}
                  onSubmitEditing={submit}
                  submitBehavior="submit"
                  returnKeyType="send"
                  enablesReturnKeyAutomatically
                  selectionColor={Accent}
                  style={[Type.body, styles.input, { color: theme.label }]}
                />
                <View style={styles.actions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Share a photo"
                    onPress={() => {
                      Keyboard.dismiss();
                      onAttach();
                    }}
                    hitSlop={6}
                    style={[styles.round, { backgroundColor: theme.chip }]}
                  >
                    <SFIcon name="plus" size={19} color={theme.label} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Emoji"
                    onPress={() => {
                      Keyboard.dismiss();
                      setEmojiOpen((v) => !v);
                    }}
                    hitSlop={6}
                    style={[
                      styles.round,
                      {
                        backgroundColor: emojiOpen
                          ? theme.outgoing
                          : theme.chip,
                      },
                    ]}
                  >
                    <SFIcon
                      name="face.smiling"
                      size={20}
                      color={emojiOpen ? theme.outgoingText : theme.label}
                    />
                  </Pressable>
                  <View style={styles.spacer} />
                  <View style={styles.round}>
                    <Animated.View
                      accessibilityElementsHidden={hasText}
                      importantForAccessibility={
                        hasText ? "no-hide-descendants" : "auto"
                      }
                      pointerEvents={hasText ? "none" : "auto"}
                      style={[StyleSheet.absoluteFill, micStyle]}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Voice message"
                        onPress={() => void startRecording()}
                        hitSlop={6}
                        style={[styles.round, { backgroundColor: theme.chip }]}
                      >
                        <SFIcon name="mic.fill" size={18} color={theme.label} />
                      </Pressable>
                    </Animated.View>
                    <Animated.View
                      accessibilityElementsHidden={!hasText}
                      importantForAccessibility={
                        hasText ? "auto" : "no-hide-descendants"
                      }
                      pointerEvents={hasText ? "auto" : "none"}
                      style={[StyleSheet.absoluteFill, sendStyle]}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Send"
                        hitSlop={6}
                        onPress={submit}
                        style={[styles.round, { backgroundColor: theme.outgoing }]}
                      >
                        <SFIcon name="arrow.up" size={17} color={theme.outgoingText} />
                      </Pressable>
                    </Animated.View>
                  </View>
                </View>
                {emojiOpen && (
                  <Animated.View
                    entering={FadeInDown.duration(220).easing(EASE_OUT.factory())}
                    exiting={FadeOutDown.duration(160)}
                  >
                    <EmojiPanel onPick={insertEmoji} />
                  </Animated.View>
                )}
              </>
            )}
          </Glass>
        </Animated.View>
      </View>
    </KeyboardStickyView>
  );
}

const styles = StyleSheet.create({
  sticky: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  root: {
    paddingHorizontal: Space[4],
    paddingTop: Space[2],
  },
  lift: {
    borderRadius: Radius.card,
    borderCurve: "continuous",
  },
  card: {
    borderRadius: Radius.card,
    paddingHorizontal: Space[3],
    paddingTop: 2,
    paddingBottom: Space[3],
  },
  replyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: Space[2],
    paddingTop: 10,
    paddingBottom: 4,
  },
  replyBar: {
    width: 3,
    alignSelf: "stretch",
    borderRadius: 1.5,
  },
  replyTextWrap: {
    flex: 1,
    gap: 1,
  },
  replyClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    maxHeight: 138,
    paddingHorizontal: Space[2],
    paddingTop: 15,
    paddingBottom: 12,
    lineHeight: 23,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  spacer: {
    flex: 1,
  },
  round: {
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
