import { StyleSheet, Text, View, ActivityIndicator } from "react-native";

import { SFIcon } from "../../../../ui/SFIcon";
import { Space, Type } from "../../constants/theme";
import type { Message } from "../../data/messages";
import { useTheme } from "../../hooks/use-theme";

import { Image } from "expo-image";

/** "12 bytes", "340 KB", "1.2 MB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} bytes`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

function getDocIconSource(mimeType: string, name: string) {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (mimeType === "application/pdf" || ext === "pdf") {
    return require("../../../../../assets/icons/docs/pdf-color.svg");
  }
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || ext === "xls" || ext === "xlsx" || ext === "csv") {
    return require("../../../../../assets/icons/docs/excel-color.svg");
  }
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint") || ext === "ppt" || ext === "pptx") {
    return require("../../../../../assets/icons/docs/ppt-color.svg");
  }
  if (mimeType.includes("word") || ext === "doc" || ext === "docx") {
    return require("../../../../../assets/icons/docs/word-color.svg");
  }
  if (mimeType.includes("video") || ext === "mp4" || ext === "mov") {
    return require("../../../../../assets/icons/docs/video-color.svg");
  }
  if (mimeType.includes("audio") || ext === "mp3" || ext === "wav" || ext === "m4a") {
    return require("../../../../../assets/icons/docs/audio-color.svg");
  }
  if (mimeType.includes("zip") || mimeType.includes("tar") || ext === "zip" || ext === "rar" || ext === "7z") {
    return require("../../../../../assets/icons/docs/zip-color.svg");
  }
  return require("../../../../../assets/icons/docs/default-color.svg");
}

/**
 * The inside of a document attachment bubble: an SF doc glyph in a tinted
 * squircle, the file name, and its size. The press/long-press handling lives
 * on the bubble itself (open on tap once the picker supplies a URI, the
 * reaction bar on long-press) so this stays pure content.
 */
export function DocumentContent({
  message,
  mine,
}: {
  message: Message;
  mine: boolean;
}) {
  const theme = useTheme();
  const doc = message.document;
  if (!doc) return null;
  const docSource = getDocIconSource(doc.mimeType, doc.name);

  return (
    <View style={styles.content}>
      <View style={[styles.iconWrap, { backgroundColor: "transparent" }]}>
        {mine && message.status === "sending" ? (
          <ActivityIndicator color={mine ? "#FFFFFF" : theme.label} />
        ) : mine && message.status === "failed" ? (
          <SFIcon name="exclamationmark.circle" size={24} color="#FF6B6B" />
        ) : (
          <Image source={docSource} style={{ width: 44, height: 44 }} contentFit="contain" />
        )}
      </View>
      <View style={styles.meta}>
        <Text
          numberOfLines={1}
          style={[
            Type.body,
            { color: mine ? theme.outgoingText : theme.label },
          ]}
        >
          {doc.name}
        </Text>
        <Text
          style={[
            Type.caption,
            {
              color: mine ? theme.outgoingText : theme.secondary,
              opacity: mine ? 0.8 : 1,
            },
          ]}
        >
          {formatBytes(doc.size)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space[3],
    minWidth: 180,
    maxWidth: 260,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  meta: {
    flex: 1,
    gap: 2,
  },
});
