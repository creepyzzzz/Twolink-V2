import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { AndroidGlassToggle } from "expo-android-glass-view";
import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PhotoViewer } from "../components/thread/photo-viewer";
import { DisappearingRow } from "../components/profile/disappearing-row";
import { GroupAvatar } from "../components/chats/group-row";
import { Avatar } from "../components/ui/avatar";
import { SFIcon } from "../../../ui/SFIcon";
import { SharedLinks } from "../components/ui/shared-links";
import { SharedDocuments } from "../components/ui/shared-documents";
import { Sheet, SheetScrollView } from "../components/ui/sheet";
import { Accent, Radius, Space, Type } from "../constants/theme";
import { PEOPLE_BY_ID } from "../data/people";
import {
  useFable,
  getGroup,
  groupAdminIds,
  groupDisplayName,
  isGroupAdmin,
} from "../data/store";
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
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  if (!group) return null;

  const isAdmin = isGroupAdmin(group, "me");
  const admins = groupAdminIds(group);
  const saveName = () => {
    if (nameDraft.trim()) useFable.getState().setGroupName(id, nameDraft);
    setRenaming(false);
  };
  const onMemberLongPress = (memberId: string) => {
    if (!isAdmin || memberId === "me") return;
    const store = useFable.getState();
    const admin = admins.includes(memberId);
    const person = PEOPLE_BY_ID[memberId];
    store.showAlert({
      title: person?.name ?? "Member",
      actions: [
        { text: "Cancel", style: "cancel" },
        {
          text: admin ? "Remove admin" : "Make admin",
          style: "default",
          onPress: () => store.setGroupAdmin(id, memberId, !admin),
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => store.removeGroupMember(id, memberId),
        },
      ],
    });
  };

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
        <View style={styles.nameRow}>
          {renaming ? (
            <TextInput
              accessibilityLabel="Group name"
              value={nameDraft}
              onChangeText={setNameDraft}
              onSubmitEditing={saveName}
              autoFocus
              returnKeyType="done"
              maxLength={48}
              selectionColor={Accent}
              style={[
                styles.nameInput,
                { color: theme.label, borderColor: theme.hairline },
              ]}
            />
          ) : (
            <Text style={[styles.name, { color: theme.label }]}>
              {groupDisplayName(group)}
            </Text>
          )}
          {isAdmin &&
            (renaming ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save group name"
                onPress={saveName}
                hitSlop={10}
                style={styles.nameEdit}
              >
                <SFIcon name="checkmark" size={18} color={Accent} />
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit group name"
                onPress={() => {
                  setNameDraft(group.name);
                  setRenaming(true);
                }}
                hitSlop={10}
                style={styles.nameEdit}
              >
                <SFIcon name="pencil" size={15} color={theme.secondary} />
              </Pressable>
            ))}
        </View>
        <Text style={[Type.caption, { color: theme.secondary, marginTop: 4 }]}>
          {group.memberIds.length} member
          {group.memberIds.length === 1 ? "" : "s"}
        </Text>

        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <View style={styles.row}>
            <Text style={[Type.body, { color: theme.label }]}>Mute</Text>
            <AndroidGlassToggle
              accessibilityLabel={`Mute ${groupDisplayName(group)}`}
              value={muted}
              onValueChange={() => toggleMute(id)}
              accentColor={Accent}
            />
          </View>
        </View>

        <DisappearingRow threadId={id} />

        <Text style={[Type.caption, styles.section, { color: theme.secondary }]}>
          Members
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
                onLongPress={() => onMemberLongPress(memberId)}
                delayLongPress={350}
                style={styles.memberRow}
              >
                <Avatar source={person.avatar} size={44} />
                <View style={styles.memberNameCol}>
                  <Text style={[Type.body, { color: theme.label }]}>
                    {memberId === "me" ? "You" : person.name}
                  </Text>
                  {admins.includes(memberId) && (
                    <Text
                      style={[
                        Type.caption,
                        styles.adminBadge,
                        { color: theme.secondary },
                      ]}
                    >
                      admin
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}
          {isAdmin && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add members to group"
              onPress={() =>
                router.push({
                  pathname: "/fable/group/add-members/[id]",
                  params: { id },
                })
              }
              style={styles.memberRow}
            >
              <View style={[styles.addCircle, { borderColor: Accent }]}>
                <SFIcon name="plus" size={20} color={Accent} />
              </View>
              <Text style={[Type.body, { color: Accent }]}>Add Members</Text>
            </Pressable>
          )}
        </View>

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
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: Space[3],
  },
  nameEdit: {
    padding: 4,
  },
  nameInput: {
    fontSize: 24,
    fontFamily: "SFProText-Semibold" as const,
    letterSpacing: -0.4,
    borderBottomWidth: 1,
    minWidth: 140,
    textAlign: "center",
    paddingBottom: 2,
  },
  memberNameCol: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  adminBadge: {
    borderWidth: 1,
    borderColor: "rgba(120,120,126,0.4)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
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
  addCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
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
