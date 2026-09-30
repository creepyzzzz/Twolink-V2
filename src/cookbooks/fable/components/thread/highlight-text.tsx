import { useMemo } from "react";
import { Text } from "react-native";

import { Type } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";

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
 * Bubble text with search matches highlighted, highlighter-style.
 * On outgoing blue the match inverts to blue-on-white so it stays legible;
 * on incoming frosted white it takes the familiar yellow marker.
 */
export function MessageText({
  text,
  query,
  active,
  mine,
  color,
}: {
  text: string;
  query?: string;
  active?: boolean;
  mine: boolean;
  color: string;
}) {
  const theme = useTheme();
  const parts = useMemo(() => splitParts(text, query ?? ""), [text, query]);
  const base = [Type.body, { color }];
  if (!parts.some((p) => p.match)) return <Text style={base}>{text}</Text>;
  return (
    <Text style={base}>
      {parts.map((p, i) =>
        p.match ? (
          <Text
            key={i}
            style={
              mine
                ? {
                    backgroundColor: active
                      ? "#FFFFFF"
                      : "rgba(255, 255, 255, 0.45)",
                    color: theme.outgoing,
                  }
                : {
                    backgroundColor: active
                      ? "rgba(255, 190, 0, 0.95)"
                      : "rgba(255, 204, 0, 0.5)",
                  }
            }
          >
            {p.text}
          </Text>
        ) : (
          <Text key={i}>{p.text}</Text>
        ),
      )}
    </Text>
  );
}
