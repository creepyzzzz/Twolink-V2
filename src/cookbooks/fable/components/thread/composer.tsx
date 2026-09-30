import { SFIcon } from "../../../../ui/SFIcon";
import { useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

import { Glass } from "../ui/glass";
import { EASE_OUT } from "../../constants/motion";
import { Accent, Radius, Space, Type } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";

const BTN = 44;

export type ReplyPreview = {
  name: string;
  text: string;
  photo: boolean;
};

type Props = {
  insetBottom: number;
  onSend: (text: string) => void;
  onAttach: () => void;
  onLayoutHeight: (h: number) => void; // full height incl. safe-area padding
  /** When set, a slim iMessage-style "replying to" strip sits above the input. */
  replyPreview?: ReplyPreview | null;
  onCancelReply?: () => void;
};

/**
 * The floating composer card in liquid glass: the text line on top,
 * a row of round actions beneath. It rides the keyboard, including the
 * interactive drag-to-dismiss. Emoji come from the device keyboard.
 */
export function Composer({
  insetBottom,
  onSend,
  onAttach,
  onLayoutHeight,
  replyPreview,
  onCancelReply,
}: Props) {
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);
  const draft = useRef("");
  const [menuOpen, setMenuOpen] = useState(false);

  const onChangeText = (t: string) => {
    draft.current = t;
  };

  const submit = () => {
    const text = draft.current.trim();
    if (!text) return;
    inputRef.current?.clear();
    draft.current = "";
    onSend(text);
  };

  /** The menu's one working item today; camera and files slot in here with
   *  the native one-shot build. */
  const choosePhoto = () => {
    setMenuOpen(false);
    onAttach();
  };

  const onLayout = (e: LayoutChangeEvent) =>
    onLayoutHeight(e.nativeEvent.layout.height);

  return (
    <KeyboardStickyView
      offset={{ closed: 0, opened: insetBottom }}
      style={styles.sticky}
    >
      <View
        onLayout={onLayout}
        style={[styles.root, { paddingBottom: insetBottom + Space[2] }]}
      >
        {menuOpen && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss attachment menu"
            onPress={() => setMenuOpen(false)}
            style={styles.backdrop}
          />
        )}
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
                    {replyPreview.photo ? "Photo" : replyPreview.text}
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
            <TextInput
              ref={inputRef}
              accessibilityLabel="Message"
              testID="fable-message-input"
              multiline
              placeholder="Message"
              placeholderTextColor={theme.placeholder}
              onChangeText={onChangeText}
              onFocus={() => setMenuOpen(false)}
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
                accessibilityLabel="Attachments"
                onPress={() => setMenuOpen((v) => !v)}
                hitSlop={6}
                style={[
                  styles.round,
                  {
                    backgroundColor: menuOpen ? theme.outgoing : theme.chip,
                  },
                ]}
              >
                <SFIcon
                  name="plus"
                  size={19}
                  color={menuOpen ? theme.outgoingText : theme.label}
                />
              </Pressable>
              <View style={styles.spacer} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send"
                hitSlop={6}
                onPress={submit}
                style={[styles.round, { backgroundColor: theme.outgoing }]}
              >
                <SFIcon name="arrow.up" size={17} color={theme.outgoingText} />
              </Pressable>
            </View>
          </Glass>
        </Animated.View>
        {menuOpen && (
          <Animated.View
            entering={FadeIn.duration(160).easing(EASE_OUT.factory())}
            exiting={FadeOut.duration(120)}
            style={styles.menu}
          >
            <Glass style={styles.menuCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose from photo library"
                onPress={choosePhoto}
                style={({ pressed }) => [
                  styles.item,
                  { backgroundColor: pressed ? theme.chip : "transparent" },
                ]}
              >
                <View
                  style={[styles.itemIcon, { backgroundColor: theme.chip }]}
                >
                  <SFIcon name="photo" size={18} color={theme.label} />
                </View>
                <Text style={[Type.body, { color: theme.label }]}>
                  Photo Library
                </Text>
              </Pressable>
            </Glass>
          </Animated.View>
        )}
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
  backdrop: {
    position: "absolute",
    top: -3000,
    left: -500,
    right: -500,
    bottom: -3000,
  },
  menu: {
    position: "absolute",
    left: 0,
    bottom: "100%",
    marginBottom: 10,
    minWidth: 230,
  },
  menuCard: {
    borderRadius: 20,
    borderCurve: "continuous",
    padding: 6,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space[3],
    paddingHorizontal: Space[3],
    paddingVertical: 10,
    borderRadius: 14,
    borderCurve: "continuous",
  },
  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
});
