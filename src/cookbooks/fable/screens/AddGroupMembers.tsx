import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SFIcon } from "../../../ui/SFIcon";
import { Avatar } from "../components/ui/avatar";
import { MenuCard } from "../components/ui/menu-card";
import { Sheet, SheetScrollView } from "../components/ui/sheet";
import { PEOPLE } from "../data/people";
import { getGroup, useFable } from "../data/store";
import { Accent, Space, Type } from "../constants/theme";
import { useTheme } from "../hooks/use-theme";
import { NotFound } from "../../NotFound";

export default function AddGroupMembersRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groups = useFable((state) => state.groups);
  return getGroup(groups, id) ? (
    <AddMembersScreen id={id} />
  ) : (
    <NotFound home="/fable" />
  );
}

/** Pick people who aren't in the group yet and add them — profile-sheet style. */
function AddMembersScreen({ id }: { id: string }) {
  const group = useFable((state) => getGroup(state.groups, id));
  const addGroupMembers = useFable((state) => state.addGroupMembers);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const candidates = useMemo(() => {
    const memberIds = group?.memberIds ?? [];
    return PEOPLE.filter((person) => !memberIds.includes(person.id));
  }, [group]);
  const filtered = useMemo(
    () =>
      candidates.filter((person) =>
        person.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [candidates, query],
  );
  if (!group) return null;

  const toggle = (personId: string) =>
    setSelected((prev) =>
      prev.includes(personId)
        ? prev.filter((m) => m !== personId)
        : [...prev, personId],
    );

  const add = () => {
    if (selected.length === 0) return;
    addGroupMembers(id, selected);
    router.back();
  };

  return (
    <Sheet detent={0.85}>
      <SheetScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 96 },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.label }]}>
            Add members
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close add members"
            onPress={() => router.back()}
            hitSlop={6}
          >
            <MenuCard
              style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" }}
            >
              <SFIcon name="xmark" size={15} color="#FFFFFF" />
            </MenuCard>
          </Pressable>
        </View>

        <Text style={[Type.caption, { color: theme.secondary }]}>
          {selected.length === 0
            ? `Adding to ${group.name}`
            : `${selected.length} member${selected.length === 1 ? "" : "s"} selected`}
        </Text>

        <MenuCard
          style={{
            height: 44,
            borderRadius: 22,
            paddingHorizontal: 16,
            flexDirection: "row",
            gap: 10,
            alignItems: "center",
            marginTop: Space[3],
          }}
        >
          <SFIcon name="magnifyingglass" size={17} color={theme.secondary} />
          <TextInput
            accessibilityLabel="Find a friend"
            placeholder="Find a friend"
            placeholderTextColor={theme.secondary}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
            style={[styles.searchInput, { color: theme.label }]}
          />
          {query.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setQuery("")}
              hitSlop={8}
            >
              <SFIcon
                name="xmark.circle.fill"
                size={17}
                color={theme.secondary}
              />
            </Pressable>
          ) : null}
        </MenuCard>

        {filtered.map((person) => {
          const isSelected = selected.includes(person.id);
          return (
            <Pressable
              key={person.id}
              accessibilityRole="button"
              accessibilityLabel={`${isSelected ? "Remove" : "Add"} ${person.name} ${isSelected ? "from" : "to"} the selection`}
              onPress={() => toggle(person.id)}
              style={styles.row}
            >
              <Avatar source={person.avatar} size={52} />
              <Text style={[styles.rowName, { color: theme.label }]}>
                {person.name}
              </Text>
              <View
                style={[
                  styles.check,
                  {
                    borderColor: isSelected ? Accent : theme.tertiary,
                    backgroundColor: isSelected ? Accent : "transparent",
                  },
                ]}
              >
                {isSelected && (
                  <SFIcon name="checkmark" size={14} color="#FFFFFF" />
                )}
              </View>
            </Pressable>
          );
        })}
        {filtered.length === 0 && (
          <Text
            style={[styles.empty, { color: theme.secondary }]}
          >
            {candidates.length === 0
              ? "Everyone's already in this group."
              : "No friends with that name."}
          </Text>
        )}
      </SheetScrollView>

      <View style={[styles.footer, { bottom: insets.bottom + Space[4] }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add members to group"
          disabled={selected.length === 0}
          onPress={add}
          style={[
            styles.addButton,
            {
              backgroundColor: selected.length === 0 ? theme.chip : Accent,
              opacity: selected.length === 0 ? 0.5 : 1,
            },
          ]}
        >
          <Text style={styles.addLabel}>
            {selected.length === 0
              ? "Add members"
              : `Add ${selected.length} member${selected.length === 1 ? "" : "s"}`}
          </Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Space[4],
    paddingTop: Space[2],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Space[1],
  },
  title: {
    fontSize: 26,
    fontFamily: "SFProText-Semibold" as const,
  },
  searchInput: {
    flex: 1,
    height: 44,
    paddingVertical: 0,
    textAlignVertical: "center",
    fontSize: 17,
    fontFamily: "SFProText-Regular" as const,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space[4],
    paddingVertical: Space[3],
  },
  rowName: {
    flex: 1,
    fontSize: 17,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    paddingVertical: Space[8],
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    left: Space[4],
    right: Space[4],
  },
  addButton: {
    height: 56,
    borderRadius: 28,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  addLabel: {
    color: "#FFFFFF",
    fontSize: 17,
    fontFamily: "SFProText-Semibold" as const,
  },
});
