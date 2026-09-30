import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { AndroidGlassToggle } from "expo-android-glass-view";
import { useMemo, useState } from "react";
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
import { GroupAvatar } from "../components/chats/group-row";
import { Avatar } from "../components/ui/avatar";
import { Glass } from "../components/ui/glass";
import { SharedLinks } from "../components/ui/shared-links";
import { SharedDocuments } from "../components/ui/shared-documents";
import { Sheet, SheetScrollView } from "../components/ui/sheet";
import { Accent, Radius, Space, Type } from "../constants/theme";
import { PEOPLE_BY_ID } from "../data/people";
import { useFable, getGroup } from "../data/store";
import { useTheme } from "../hooks/use-theme";
import { NotFound } from "../../NotFound";

export default function GroupProfileRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groups = useFable((state) => state.groups);
  return getGroup(groups, id) ? (
    <ProfileScreen id={id} />
  ) : (
    <NotFound home="/fable" />
  );
}

/** The group card: identity, mute, members, and the thread's shared photos. */
function ProfileScreen({ id }: { id: string }) {
  const groups = useFable((state) => state.groups);
  const group = getGroup(groups, id);
  const muted = useFable((state) => !!state.muted[id]);
  const toggleMute = useFable((state) => state.toggleMute);
  const stored = useFable((state) => state.threads[id]);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const messages = useMemo(() => stored ?? [], [stored]);
  const photos = useMemo(
    () => messages.filter((m) => m.photo),
    [messages],
  );
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  if (!group) return null;

  const gap = 3;
  const cell = (width - Space[4] * 2 - gap * 2) / 3;
  const viewerPhoto =
    viewerIndex != null ? photos[viewerIndex] : undefined;

  return (
    <Sheet detent={0.75}>
      <SheetScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Space[8] },
        ]}
      >
        <GroupAvatar memberIds={group.memberIds} size={96} />
        <Text style={[styles.name, { color: theme.label }]}>{group.name}</Text>
        <Text style={[Type.caption, { color: theme.secondary, marginTop: 4 }]}>
          {group.memberIds.length} member
          {group.memberIds.length === 1 ? "" : "s"}
        </Text>

        <Glass style={styles.card}>
          <View style={styles.row}>
            <Text style={[Type.body, { color: theme.label }]}>Mute</Text>
            <AndroidGlassToggle
              accessibilityLabel={`Mute ${group.name}`}
              value={muted}
              onValueChange={() => toggleMute(id)}
              accentColor={Accent}
            />
          </View>
        </Glass>

        <DisappearingRow threadId={id} />

        <Text style={[Type.caption, styles.section, { color: theme.secondary }]}>
          Members
        </Text>
        <Glass style={[styles.card, { marginTop: 0, paddingVertical: Space[2] }]}>
          {group.memberIds.map((memberId) => {
            const person = PEOPLE_BY_ID[memberId];
            if (!person) return null;
            return (
              <Pressable
                key={memberId}
                accessibilityRole="button"
                accessibilityLabel={`View ${person.name}`}
                onPress={() =>
                  router.push({
                    pathname: "/fable/contact/[id]",
                    params: { id: memberId },
                  })
                }
                style={styles.memberRow}
              >
                <Avatar source={person.avatar} size={44} />
                <Text style={[Type.body, { color: theme.label }]}>
                  {person.name}
                </Text>
              </Pressable>
            );
          })}
        </Glass>

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
                  source={m.photoUri ? { uri: m.photoUri } : undefined}
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

      {viewerPhoto?.photoUri && (
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
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space[3],
    paddingVertical: Space[2],
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
