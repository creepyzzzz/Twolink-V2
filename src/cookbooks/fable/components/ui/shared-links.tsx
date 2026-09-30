import { useMemo } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { SFIcon } from "../../../../ui/SFIcon";
import { Glass } from "./glass";
import { Radius, Space, Type } from "../../constants/theme";
import type { Message } from "../../data/messages";
import { useTheme } from "../../hooks/use-theme";

export type SharedLink = { url: string; host: string };

const URL_RE =
  /(https?:\/\/[^\s]+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s]*)?)/gi;

/** Pulls unique links out of a thread's text messages, newest first. */
export function extractLinks(messages: Message[]): SharedLink[] {
  const seen = new Set<string>();
  const found: SharedLink[] = [];
  for (const m of messages) {
    if (m.photo || !m.text) continue;
    const matches = m.text.match(URL_RE);
    if (!matches) continue;
    for (let raw of matches) {
      raw = raw.replace(/[.,;:!?)]+$/, "");
      const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      const key = url.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      let host = key;
      try {
        host = new URL(url).hostname.replace(/^www\./, "");
      } catch {
        /* keep the raw string */
      }
      found.push({ url, host });
    }
  }
  return found.reverse();
}

async function openLink(url: string) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("Link", "This link can't be opened on this device.");
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert("Link", "Couldn't open that link.");
  }
}

/** "Shared Links" section for contact/group cards. Renders nothing when empty. */
export function SharedLinks({ messages }: { messages: Message[] }) {
  const theme = useTheme();
  const links = useMemo(() => extractLinks(messages), [messages]);
  if (links.length === 0) return null;
  return (
    <>
      <Text style={[Type.caption, styles.section, { color: theme.secondary }]}>
        Shared Links
      </Text>
      <Glass style={[styles.card, { marginTop: 0, paddingVertical: Space[2] }]}>
        {links.map((link) => (
          <Pressable
            key={link.url}
            accessibilityRole="button"
            accessibilityLabel={`Open ${link.host}`}
            onPress={() => openLink(link.url)}
            style={styles.row}
          >
            <View
              style={[
                styles.icon,
                { backgroundColor: "rgba(120,120,128,0.16)" },
              ]}
            >
              <SFIcon name="link" size={17} color={theme.secondary} />
            </View>
            <View style={styles.body}>
              <Text
                numberOfLines={1}
                style={[Type.body, { color: theme.label }]}
              >
                {link.host}
              </Text>
              <Text
                numberOfLines={1}
                style={[Type.caption, { color: theme.secondary }]}
              >
                {link.url}
              </Text>
            </View>
            <SFIcon name="chevron.right" size={14} color={theme.tertiary} />
          </Pressable>
        ))}
      </Glass>
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
