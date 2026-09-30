import { useMemo } from "react";
import { Text } from "react-native";

import { Accent, Type } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";
import { splitMentions } from "../../data/mentions";
import { openExternalUrl, splitUrlSegments } from "./link-preview";

type TextPart = { text: string; match: boolean };

/** Case-insensitive split of the text on the query, preserving original case. */
function splitParts(text: string, query: string): TextPart[] {
  const q = query.trim().toLowerCase();
  if (!q) return [{ text, match: false }];
  const lower = text.toLowerCase();
  const parts: TextPart[] = [];
  let i = 0;
  for (;;) {
    const j = lower.indexOf(q, i);
    if (j === -1) {
      parts.push({ text: text.slice(i), match: false });
      break;
    }
    if (j > i) parts.push({ text: text.slice(i, j), match: false });
    parts.push({ text: text.slice(j, j + q.length), match: true });
    i = j + q.length;
    if (i >= text.length) break;
  }
  return parts.filter((p) => p.text.length > 0);
}

/**
 * Bubble text with search matches highlighted, highlighter-style, URLs
 * linkified (tappable, underlined), and @mentions tinted — your own name
 * gets a filled pill so self-mentions pop.
 */
export function MessageText({
  text,
  query,
  active,
  mine,
  color,
  mentions,
}: {
  text: string;
  query?: string;
  active?: boolean;
  mine: boolean;
  color: string;
  /** Group @mentions: member first names plus your own first name. */
  mentions?: { names: string[]; self: string };
}) {
  const theme = useTheme();
  const segments = useMemo(() => splitUrlSegments(text), [text]);
  const q = query ?? "";
  const base = [Type.body, { color }];
  const linkStyle = mine
    ? { textDecorationLine: "underline" as const }
    : { color: Accent, textDecorationLine: "underline" as const };
  const matchStyle = mine
    ? {
        backgroundColor: active ? "#FFFFFF" : "rgba(255, 255, 255, 0.45)",
        color: theme.outgoing,
      }
    : {
        backgroundColor: active
          ? "rgba(255, 190, 0, 0.95)"
          : "rgba(255, 204, 0, 0.5)",
      };
  const mentionStyle = mine
    ? { color: "#FFFFFF", fontWeight: "600" as const }
    : { color: Accent, fontWeight: "600" as const };
  const selfMentionStyle = mine
    ? {
        backgroundColor: "rgba(255,255,255,0.30)",
        color: "#FFFFFF",
        fontWeight: "700" as const,
      }
    : {
        backgroundColor: "rgba(10,132,255,0.16)",
        color: Accent,
        fontWeight: "700" as const,
      };
  const mentionNames = mentions?.names ?? [];
  const selfName = (mentions?.self ?? "").toLowerCase();
  const renderMentionSpans = (t: string, keyPrefix: string) =>
    splitMentions(t, mentionNames).map((sp, j) =>
      sp.name ? (
        <Text
          key={`${keyPrefix}-${j}`}
          style={
            sp.name.toLowerCase() === selfName ? selfMentionStyle : mentionStyle
          }
        >
          {sp.text}
        </Text>
      ) : (
        <Text key={`${keyPrefix}-${j}`}>{sp.text}</Text>
      ),
    );
  return (
    <Text style={base}>
      {segments.map((seg, si) => {
        const parts = splitParts(seg.text, q);
        const open = seg.url ? () => openExternalUrl(seg.text) : undefined;
        return (
          <Text
            key={si}
            style={seg.url ? linkStyle : undefined}
            {...(open
              ? {
                  onPress: open,
                  accessibilityRole: "link" as const,
                  accessibilityLabel: `Open link: ${seg.text}`,
                }
              : {})}
          >
            {parts.map((p, i) =>
              p.match ? (
                <Text key={i} style={matchStyle}>
                  {p.text}
                </Text>
              ) : mentionNames.length > 0 ? (
                <Text key={i}>
                  {renderMentionSpans(p.text, `${si}-${i}`)}
                </Text>
              ) : (
                <Text key={i}>{p.text}</Text>
              ),
            )}
          </Text>
        );
      })}
    </Text>
  );
}
