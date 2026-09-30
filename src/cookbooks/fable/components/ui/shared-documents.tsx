import { useCallback, useMemo } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { SFIcon } from "../../../../ui/SFIcon";
import { Radius, Space, Type } from "../../constants/theme";
import type { DocumentAttachment, Message } from "../../data/messages";
import { useTheme } from "../../hooks/use-theme";
import { formatBytes } from "../thread/document-bubble";

/** Unique document attachments in a thread, newest first. */
export function extractDocuments(messages: Message[]): DocumentAttachment[] {
  const seen = new Set<string>();
  const found: DocumentAttachment[] = [];
  for (const m of messages) {
    if (!m.document) continue;
    const key = `${m.document.name}|${m.document.size}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(m.document);
  }
  return found.reverse();
}

/**
 * "Shared Documents" section for contact/group cards, mirroring Shared Links.
 * Renders nothing when empty. Tapping a row opens the file; the URI comes
 * from the document picker (cached copy), so it opens while the file lives.
 */
export function SharedDocuments({ messages }: { messages: Message[] }) {
  const theme = useTheme();
  const docs = useMemo(() => extractDocuments(messages), [messages]);
  const openDoc = useCallback((uri: string) => {
    if (uri) Linking.openURL(uri).catch(() => {});
  }, []);
  if (docs.length === 0) return null;
  return (
    <>
      <Text style={[Type.caption, styles.section, { color: theme.secondary }]}>
        Shared Documents
      </Text>
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            marginTop: 0,
            paddingVertical: Space[2],
          },
        ]}
      >
        {docs.map((doc) => (
          <Pressable
            key={`${doc.name}|${doc.size}`}
            accessibilityRole="button"
            accessibilityLabel={`Open ${doc.name}`}
            onPress={() => openDoc(doc.uri)}
            style={styles.row}
          >
            <View
              style={[
                styles.icon,
                { backgroundColor: "rgba(120,120,128,0.16)" },
              ]}
            >
              <SFIcon name="doc.fill" size={17} color={theme.secondary} />
            </View>
            <View style={styles.body}>
              <Text
                numberOfLines={1}
                style={[Type.body, { color: theme.label }]}
              >
                {doc.name}
              </Text>
              <Text
                numberOfLines={1}
                style={[Type.caption, { color: theme.secondary }]}
              >
                {formatBytes(doc.size)}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    alignSelf: "flex-start",
    marginTop: Space[6],
    marginBottom: Space[2],
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  card: {
    alignSelf: "stretch",
    borderRadius: Radius.card,
    borderCurve: "continuous",
    paddingHorizontal: Space[4],
    paddingVertical: Space[3],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space[3],
    paddingVertical: Space[2],
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 1 },
});
