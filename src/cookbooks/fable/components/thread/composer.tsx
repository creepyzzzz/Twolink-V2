import { SFIcon } from "../../../../ui/SFIcon";
import { useMemo, useRef, useState } from "react";
import { getGroup, useFable } from "../../data/store";
import { PEOPLE_BY_ID, type Person } from "../../data/people";
import { schedulePresets } from "../../data/scheduled";
import { Avatar } from "../ui/avatar";
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
import { MenuCard } from "../ui/menu-card";
import { EASE_OUT } from "../../constants/motion";
import { Accent, Radius, Space, Type } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";

const SEND = 52;

export type ReplyPreview = {
  name: string;
  text: string;
  photo: boolean;
};

type Props = {
  threadId: string;
  insetBottom: number;
  onSend: (text: string) => void;
  onAttach: () => void;
  /** Group threads only: opens the poll composer sheet. */
  onCreatePoll: () => void;
  onLayoutHeight: (h: number) => void; // full height incl. safe-area padding
  /** When set, a slim iMessage-style "replying to" strip sits above the input. */
  replyPreview?: ReplyPreview | null;
  onCancelReply?: () => void;
  /** Queue the text to send at a later time (long-press the send button). */
  onSchedule: (text: string, at: number) => void;
};

/**
 * The floating composer in liquid glass: a single input pill with the "+"
 * tucked inside it on the left, and the send button as its own circle just
 * outside the pill on the right (Astra-style), bottom-anchored as the pill
 * grows. It rides the keyboard, including the interactive drag-to-dismiss.
 * Emoji come from the device keyboard.
 */
export function Composer({
  threadId,
  insetBottom,
  onSend,
  onAttach,
  onCreatePoll,
  onLayoutHeight,
  replyPreview,
  onCancelReply,
  onSchedule,
}: Props) {
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);
  const setDraft = useFable((state) => state.setDraft);
  const group = useFable((s) => getGroup(s.groups, threadId));
  const isGroup = group != null;
  const groupMembers = useMemo(
    () =>
      group
        ? group.memberIds
            .map((m) => PEOPLE_BY_ID[m])
            .filter((m): m is Person => !!m)
        : [],
    [group],
  );
  // @mention autocomplete: trailing "@query" in a group thread.
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const suggestions = useMemo(() => {
    if (mentionQuery == null || groupMembers.length === 0) return [];
    return groupMembers
      .filter((m) => m.first.toLowerCase().startsWith(mentionQuery))
      .slice(0, 5);
  }, [mentionQuery, groupMembers]);
  // Restored once on mount — the input is uncontrolled after that.
  const initialDraft = useFable.getState().drafts[threadId] ?? "";
  const draft = useRef(initialDraft);
  // Drives the send button's empty/filled styling; the input stays uncontrolled.
  const [hasText, setHasText] = useState(initialDraft.trim().length > 0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const onChangeText = (t: string) => {
    draft.current = t;
    setDraft(threadId, t);
    setHasText(t.trim().length > 0);
    if (!isGroup) return;
    const m = t.match(/@([\p{L}\p{N}_]*)$/u);
    setMentionQuery(m ? m[1].toLowerCase() : null);
  };

  const pickMention = (person: Person) => {
    const cur = draft.current;
    const m = cur.match(/@([\p{L}\p{N}_]*)$/u);
    if (!m) return;
    const next = `${cur.slice(0, cur.length - m[0].length)}@${person.first} `;
    draft.current = next;
    inputRef.current?.setNativeProps({ text: next });
    setDraft(threadId, next);
    setMentionQuery(null);
  };

  const submit = () => {
    const text = draft.current.trim();
    if (!text) return;
    inputRef.current?.clear();
    draft.current = "";
    setDraft(threadId, "");
    setHasText(false);
    onSend(text);
  };

  const scheduleText = (at: number) => {
    const text = draft.current.trim();
    setScheduleOpen(false);
    if (!text) return;
    inputRef.current?.clear();
    draft.current = "";
    setDraft(threadId, "");
    setHasText(false);
    onSchedule(text, at);
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
        {(menuOpen || scheduleOpen) && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss menu"
            onPress={() => {
              setMenuOpen(false);
              setScheduleOpen(false);
            }}
            style={styles.backdrop}
          />
        )}
        <View style={styles.row}>
          <Animated.View
            layout={LinearTransition.duration(220).easing(EASE_OUT.factory())}
            style={[styles.lift, { boxShadow: theme.lift, flex: 1 }]}
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
              <View style={styles.inputRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Attachments"
                  onPress={() => {
                    setMentionQuery(null);
                    setMenuOpen((v) => !v);
                  }}
                  hitSlop={6}
                  style={styles.plus}
                >
                  <SFIcon
                    name={menuOpen ? "xmark" : "plus"}
                    size={22}
                    color={menuOpen ? Accent : theme.label}
                  />
                </Pressable>
                <TextInput
                  ref={inputRef}
                  accessibilityLabel="Message"
                  testID="fable-message-input"
                  multiline
                  defaultValue={initialDraft}
                  placeholder="Message"
                  placeholderTextColor={theme.placeholder}
                  onChangeText={onChangeText}
                  onFocus={() => {
                    setMenuOpen(false);
                    setScheduleOpen(false);
                  }}
                  // No returnKeyType/onSubmitEditing: the keyboard keeps its
                  // newline key (multiline default); sending happens through
                  // the on-screen send button.
                  enablesReturnKeyAutomatically
                  selectionColor={Accent}
                  style={[Type.body, styles.input, { color: theme.label }]}
                />
              </View>
            </Glass>
          </Animated.View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            accessibilityHint="Long press to schedule for later"
            hitSlop={6}
            onPress={submit}
            onLongPress={() => {
              if (!draft.current.trim()) return;
              setMentionQuery(null);
              setMenuOpen(false);
              setScheduleOpen(true);
            }}
            delayLongPress={450}
            style={[
              styles.send,
              {
                backgroundColor: hasText ? theme.outgoing : theme.chip,
              },
            ]}
          >
            <SFIcon
              name="arrow.up"
              size={20}
              color={hasText ? theme.outgoingText : theme.tertiary}
            />
          </Pressable>
        </View>
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
              {isGroup && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Create a poll"
                  onPress={() => {
                    setMenuOpen(false);
                    onCreatePoll();
                  }}
                  style={({ pressed }) => [
                    styles.item,
                    { backgroundColor: pressed ? theme.chip : "transparent" },
                  ]}
                >
                  <View
                    style={[styles.itemIcon, { backgroundColor: theme.chip }]}
                  >
                    <SFIcon name="chart.bar" size={18} color={theme.label} />
                  </View>
                  <Text style={[Type.body, { color: theme.label }]}>Poll</Text>
                </Pressable>
              )}
            </Glass>
          </Animated.View>
        )}
        {scheduleOpen && (
          <Animated.View
            entering={FadeIn.duration(160).easing(EASE_OUT.factory())}
            exiting={FadeOut.duration(120)}
            style={styles.menuRight}
          >
            <MenuCard style={styles.menuCard}>
              {schedulePresets().map((preset) => (
                <Pressable
                  key={preset.label}
                  accessibilityRole="button"
                  accessibilityLabel={`Schedule for ${preset.label}`}
                  onPress={() => scheduleText(preset.at)}
                  style={({ pressed }) => [
                    styles.item,
                    {
                      backgroundColor: pressed
                        ? theme.chip
                        : "transparent",
                    },
                  ]}
                >
                  <View
                    style={[styles.itemIcon, { backgroundColor: theme.chip }]}
                  >
                    <SFIcon name="clock" size={19} color={theme.label} />
                  </View>
                  <Text style={[Type.body, { color: theme.label }]}>
                    {preset.label}
                  </Text>
                </Pressable>
              ))}
            </MenuCard>
          </Animated.View>
        )}
        {mentionQuery != null && suggestions.length > 0 && (
          <Animated.View
            entering={FadeIn.duration(160).easing(EASE_OUT.factory())}
            exiting={FadeOut.duration(120)}
            style={styles.menu}
          >
            <MenuCard style={styles.menuCard}>
              {suggestions.map((person) => (
                <Pressable
                  key={person.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Mention ${person.name}`}
                  onPress={() => pickMention(person)}
                  style={({ pressed }) => [
                    styles.item,
                    { backgroundColor: pressed ? theme.chip : "transparent" },
                  ]}
                >
                  <Avatar source={person.avatar} size={36} />
                  <Text style={[Type.body, { color: theme.label }]}>
                    {person.name}
                  </Text>
                </Pressable>
              ))}
            </MenuCard>
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
  /** Pill + external send circle, bottom-anchored as the pill grows. */
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  lift: {
    borderRadius: Radius.card,
    borderCurve: "continuous",
  },
  card: {
    borderRadius: Radius.card,
    paddingLeft: Space[2],
    paddingRight: Space[3],
    paddingVertical: 6,
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
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  plus: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 138,
    paddingTop: 11,
    paddingBottom: 10,
    lineHeight: 23,
  },
  /** The send circle sits just outside the pill, with a clear gap. */
  send: {
    width: SEND,
    height: SEND,
    borderRadius: SEND / 2,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Space[2],
    marginBottom: 2,
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
  /** The Send Later sheet anchors over the external send circle. */
  menuRight: {
    position: "absolute",
    right: 0,
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
