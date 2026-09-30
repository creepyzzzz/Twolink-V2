import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SFIcon } from "../../../../ui/SFIcon";
import { Accent, Radius, Space, Type } from "../../constants/theme";
import type { Message } from "../../data/messages";
import { useScheme, useTheme } from "../../hooks/use-theme";

/**
 * A group poll rendered as a bubble-sized card. Tapping an option casts a
 * single-choice vote; tapping another option moves the vote. Bars show the
 * live share, mirroring the bubble geometry and motion language.
 */
export const PollCard = memo(function PollCard({
  message,
  mine,
  senderName,
  onVote,
}: {
  message: Message;
  mine: boolean;
  senderName?: string;
  onVote: (optionId: string) => void;
}) {
  const theme = useTheme();
  const scheme = useScheme();
  const poll = message.poll;
  if (!poll) return null;
  const total = poll.options.reduce((n, o) => n + o.votes.length, 0);
  const myVote = poll.options.find((o) => o.votes.includes("me"))?.id;
  const textColor = mine ? theme.outgoingText : theme.label;
  const subColor = mine ? "rgba(255,255,255,0.75)" : theme.secondary;

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: mine ? theme.outgoing : theme.surface,
            boxShadow:
              mine || scheme === "dark"
                ? undefined
                : "0 4px 18px rgba(16, 16, 18, 0.05)",
          },
        ]}
      >
        {!!senderName && !mine && (
          <Text numberOfLines={1} style={[styles.sender, { color: Accent }]}>
            {senderName}
          </Text>
        )}
        <Text style={[Type.body, styles.question, { color: textColor }]}>
          {poll.question}
        </Text>
        {poll.options.map((option) => {
          const pct = total === 0 ? 0 : Math.round((option.votes.length / total) * 100);
          const voted = myVote === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={`Vote for ${option.text}, ${option.votes.length} votes`}
              onPress={() => onVote(option.id)}
              style={({ pressed }) => [
                styles.option,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View
                style={[
                  styles.bar,
                  {
                    width: `${pct}%`,
                    backgroundColor: mine
                      ? "rgba(255,255,255,0.28)"
                      : "rgba(10,132,255,0.16)",
                  },
                ]}
              />
              <View style={styles.optionRow}>
                <View
                  style={[
                    styles.check,
                    {
                      borderColor: voted
                        ? mine
                          ? "#fff"
                          : Accent
                        : subColor,
                      backgroundColor: voted
                        ? mine
                          ? "#fff"
                          : Accent
                        : "transparent",
                    },
                  ]}
                >
                  {voted && (
                    <SFIcon
                      name="checkmark"
                      size={11}
                      color={mine ? theme.outgoing : "#fff"}
                    />
                  )}
                </View>
                <Text
                  numberOfLines={2}
                  style={[Type.body, styles.optionText, { color: textColor }]}
                >
                  {option.text}
                </Text>
                <Text style={[styles.pct, { color: subColor }]}>{pct}%</Text>
              </View>
            </Pressable>
          );
        })}
        <Text style={[Type.caption, styles.total, { color: subColor }]}>
          {total === 0
            ? "No votes yet — tap an option"
            : `${total} vote${total === 1 ? "" : "s"}`}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    paddingHorizontal: Space[4],
  },
  rowMine: {
    justifyContent: "flex-end",
  },
  rowTheirs: {
    justifyContent: "flex-start",
  },
  card: {
    maxWidth: "78%",
    borderRadius: Radius.bubble,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sender: {
    fontSize: 13,
    fontFamily: "SFProText-Semibold",
    marginBottom: 4,
  },
  question: {
    fontWeight: "600",
    marginBottom: 4,
  },
  option: {
    marginTop: 8,
    borderRadius: 14,
    borderCurve: "continuous",
    overflow: "hidden",
    minHeight: 42,
    justifyContent: "center",
  },
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: {
    flex: 1,
    fontSize: 14,
  },
  pct: {
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  total: {
    marginTop: 10,
  },
});
