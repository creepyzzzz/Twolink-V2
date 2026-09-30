import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { SFIcon } from "../../../../ui/SFIcon";
import { Type } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";

export function extractUrls(text: string): string[] {
  return splitUrlSegments(text)
    .filter((s) => s.url)
    .map((s) => s.text);
}

export type UrlSegment = { text: string; url: boolean };

/** Split text into plain and URL segments, preserving every character. */
export function splitUrlSegments(text: string): UrlSegment[] {
  const segs: UrlSegment[] = [];
  let i = 0;
  const re = /https?:\/\/[^\s<>"')\]]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    const trimmed = raw.replace(/[,.;!?]+$/, "");
    if (m.index > i) segs.push({ text: text.slice(i, m.index), url: false });
    if (trimmed.length > 0) segs.push({ text: trimmed, url: true });
    const punct = raw.slice(trimmed.length);
    if (punct.length > 0) segs.push({ text: punct, url: false });
    i = m.index + raw.length;
  }
  if (i < text.length) segs.push({ text: text.slice(i), url: false });
  return segs.filter((s) => s.text.length > 0);
}

type Preview = { title?: string; image?: string };

const cache = new Map<string, Preview | null>();

function metaContent(head: string, prop: string): string | undefined {
  const a =
    head.match(
      new RegExp(
        `<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)`,
        "i",
      ),
    ) ??
    head.match(
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`,
        "i",
      ),
    );
  return a?.[1];
}

/**
 * Best-effort OpenGraph fetch for a chat link, cached per URL. Runs on the
 * device (no proxy at this scale); failures quietly fall back to the domain
 * card. Never throws.
 */
async function fetchPreview(url: string): Promise<Preview | null> {
  const hit = cache.get(url);
  if (hit !== undefined) return hit;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "text/html" },
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error("bad status");
    const head = (await res.text()).slice(0, 60000);
    const title =
      metaContent(head, "og:title") ??
      head.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
    let image = metaContent(head, "og:image");
    if (image?.startsWith("/")) image = new URL(image, url).href;
    const preview: Preview | null =
      title || image ? { title, image } : null;
    cache.set(url, preview);
    return preview;
  } catch {
    cache.set(url, null);
    return null;
  }
}

function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * iMessage-style rich link card, rendered inside the bubble under the text.
 * Shows the domain immediately, then upgrades to the page title and image
 * once the OpenGraph fetch lands. Tapping opens the link.
 */
export function LinkPreview({ url, mine }: { url: string; mine: boolean }) {
  const theme = useTheme();
  const [preview, setPreview] = useState<Preview | null | undefined>();
  const domain = domainOf(url);

  useEffect(() => {
    let live = true;
    fetchPreview(url).then((p) => {
      if (live) setPreview(p);
    });
    return () => {
      live = false;
    };
  }, [url]);

  if (!domain) return null;
  const title = preview?.title ?? domain;
  const titleColor = mine ? "#FFFFFF" : theme.label;
  const domainColor = mine ? "rgba(255,255,255,0.75)" : theme.secondary;
  const cardBg = mine ? "rgba(255,255,255,0.28)" : "rgba(120,120,128,0.14)";
  const iconBg = mine ? "rgba(255,255,255,0.35)" : "rgba(120,120,128,0.18)";

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open link: ${title}`}
      onPress={() => void Linking.openURL(url)}
      style={[styles.card, { backgroundColor: cardBg }]}
    >
      {preview?.image ? (
        <Image
          source={{ uri: preview.image }}
          style={styles.thumb}
          contentFit="cover"
        />
      ) : null}
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: iconBg }]}>
          <SFIcon
            name="link"
            size={16}
            color={mine ? "#FFFFFF" : theme.secondary}
          />
        </View>
        <View style={styles.texts}>
          <Text
            numberOfLines={2}
            style={[Type.body, styles.title, { color: titleColor }]}
          >
            {title}
          </Text>
          <Text
            numberOfLines={1}
            style={[Type.caption, { color: domainColor }]}
          >
            {domain}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
    borderRadius: 12,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  thumb: {
    width: "100%",
    aspectRatio: 1.91,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: "SFProText-Semibold" as const,
  },
});
