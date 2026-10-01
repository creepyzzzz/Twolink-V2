import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { AndroidGlassToggle } from "expo-android-glass-view";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PhotoViewer } from "../components/thread/photo-viewer";
import { DisappearingRow } from "../components/profile/disappearing-row";
import { Avatar } from "../components/ui/avatar";
import { SharedLinks } from "../components/ui/shared-links";
import { SharedDocuments } from "../components/ui/shared-documents";
import { Sheet, SheetScrollView } from "../components/ui/sheet";
import { Accent, Radius, Space, Type } from "../constants/theme";
import type { Message } from "../data/messages";
import { avatarSource } from "../data/people";
import { useFable } from "../data/store";
import { useTheme } from "../hooks/use-theme";
import { NotFound, LoadingRoute } from "../../NotFound";

export default function ContactProfileRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const person = useFable((state) => state.people[id]);
  const bootstrapped = useFable((state) => state.bootstrapped);
  useEffect(() => {
    if (!bootstrapped) void useFable.getState().bootstrap();
  }, [bootstrapped]);
  if (!person) {
    if (!bootstrapped) return <LoadingRoute />;
    return <NotFound home="/fable" />;
  }
  return <ProfileScreen id={id} />;
}

/**
 * The contact card, iOS-style: a big identity on top, then grouped rows —
 * a real mute toggle and the thread's shared photos.
 */
function ProfileScreen({ id }: { id: string }) {
  const person = useFable((state) => state.people[id]);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Live threads/mute are keyed by chat id; resolve this person's direct chat.
  const directChat = useFable((state) =>
    state.chats.find((c) => c.type === "direct" && c.otherUserId === id),
  );
  const chatId = directChat?.id ?? "";
  const muted = useFable((state) => !!state.muted[chatId]);
  const toggleMute = useFable((state) => state.toggleMute);
  const stored = useFable((state) => state.threads[chatId]);
  const stories = useFable((state) => state.stories);
  const messages = useMemo(() => stored ?? [], [stored]);
  const photos = useMemo(
    () =>
      messages.filter(
        (m): m is Message & { photoUri: string } => !!m.photo && !!m.photoUri,
      ),
    [messages],
  );
  const latestStory = stories.find((s) => s.userId === id);

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (!person) return null;

  const gap = 3;
  const cell = (width - Space[4] * 2 - gap * 2) / 3;
  const viewerPhoto =
    viewerIndex != null ? photos[viewerIndex] : undefined;
  const storyCaption = latestStory
    ? latestStory.ago === "Yesterday"
      ? "Story yesterday"
      : `Story ${latestStory.ago} ago`
    : "No recent story";

  return (
    <Sheet detent={0.75}>
      <SheetScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Space[8] },
        ]}
      >
        <View
          style={[styles.identityCard, { backgroundColor: theme.surface }]}
        >
          <Avatar source={avatarSource(person)} size={96} />
          <Text style={[styles.name, { color: theme.label }]}>
            {person.name}
          </Text>
          <Text style={[Type.caption, { color: theme.secondary, marginTop: 4 }]}>
            {storyCaption}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <View style={styles.row}>
            <Text style={[Type.body, { color: theme.label }]}>Mute</Text>
            <AndroidGlassToggle
              accessibilityLabel={`Mute ${person.first}`}
              value={muted}
              onValueChange={() => {
                void toggleMute(chatId);
              }}
              accentColor={Accent}
            />
          </View>
        </View>

        <DisappearingRow threadId={id} />

        <Text style={[Type.caption, styles.section, { color: theme.secondary }]}>
          Shared Photos
        </Text>
        {photos.length > 0 ? (
          <View style={[styles.grid, { gap }]}>
            {photos.map((m, i) => (
              <Pressable
                key={m.id}
                accessibilityRole="button"
                accessibilityLabel="Open shared photo"
                onPress={() => setViewerIndex(i)}
                style={{ width: cell, height: cell }}
              >
                <Image
                  source={{ uri: m.photoUri }}
                  style={styles.thumb}
                  contentFit="cover"
                />
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={[Type.preview, { color: theme.tertiary }]}>
            No shared photos yet.
          </Text>
        )}

        <SharedLinks messages={messages} />
        <SharedDocuments messages={messages} />
      </SheetScrollView>

      {viewerPhoto && (
        <PhotoViewer
          source={{ uri: viewerPhoto.photoUri }}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Space[4],
    paddingTop: Space[2],
    alignItems: "center",
  },
  identityCard: {
    alignSelf: "stretch",
    alignItems: "center",
    borderRadius: Radius.card,
    borderCurve: "continuous",
    paddingVertical: Space[5],
    paddingHorizontal: Space[4],
    marginTop: Space[2],
  },
  name: {
    fontSize: 24,
    fontFamily: "SFProText-Semibold" as const,
    letterSpacing: -0.4,
    marginTop: Space[3],
  },
  card: {
    alignSelf: "stretch",
    borderRadius: Radius.card,
    borderCurve: "continuous",
    paddingHorizontal: Space[4],
    paddingVertical: Space[3],
    marginTop: Space[6],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  section: {
    alignSelf: "flex-start",
    marginTop: Space[6],
    marginBottom: Space[2],
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  grid: {
    alignSelf: "stretch",
    flexDirection: "row",
    flexWrap: "wrap",
  },
  thumb: {
    flex: 1,
    borderRadius: 10,
    borderCurve: "continuous",
    overflow: "hidden",
  },
});
