import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import { Pressable, Text, TextInput, View } from "react-native";

import { SFIcon } from "../../../ui/SFIcon";
import { Avatar } from "../components/ui/avatar";
import { Glass } from "../components/ui/glass";
import { GlassButton } from "../components/ui/glass-button";
import { PEOPLE } from "../data/people";
import { getGroup, useFable } from "../data/store";
import { Accent } from "../constants/theme";
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

/** Pick people who aren't in the group yet and add them. */
function AddMembersScreen({ id }: { id: string }) {
  const group = useFable((state) => getGroup(state.groups, id));
  const addGroupMembers = useFable((state) => state.addGroupMembers);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const theme = useTheme();

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
    <View style={{ flex: 1, paddingTop: 28 }}>
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 24,
          alignItems: "center",
          gap: 16,
        }}
      >
        <Text
          style={{
            flex: 1,
            fontSize: 26,
            fontFamily: "SFProText-Semibold",
            color: theme.label,
          }}
        >
          Add members
        </Text>
        <GlassButton
          symbol="xmark"
          accessibilityLabel="Close add members"
          onPress={() => router.back()}
        />
      </View>

      <Text
        style={{
          color: theme.secondary,
          fontSize: 13,
          marginHorizontal: 28,
          marginTop: 8,
        }}
      >
        {selected.length === 0
          ? `Adding to ${group.name}`
          : `${selected.length} member${selected.length === 1 ? "" : "s"} selected`}
      </Text>

      <View style={{ marginHorizontal: 24, marginTop: 12, marginBottom: 8 }}>
        <Glass
          style={{
            height: 44,
            borderRadius: 22,
            paddingHorizontal: 16,
            flexDirection: "row",
            gap: 10,
            alignItems: "center",
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
            style={{
              flex: 1,
              height: 44,
              paddingVertical: 0,
              textAlignVertical: "center",
              fontSize: 17,
              fontFamily: "SFProText-Regular",
              color: theme.label,
            }}
          />
          {query.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setQuery("")}
              hitSlop={8}
            >
              <SFIcon name="xmark.circle.fill" size={17} color={theme.secondary} />
            </Pressable>
          ) : null}
        </Glass>
      </View>

      <FlashList
        data={filtered}
        keyExtractor={(person) => person.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }}
        renderItem={({ item }) => {
          const isSelected = selected.includes(item.id);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${isSelected ? "Remove" : "Add"} ${item.name} ${isSelected ? "from" : "to"} the selection`}
              onPress={() => toggle(item.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 16,
                paddingVertical: 12,
              }}
            >
              <Avatar source={item.avatar} size={52} />
              <Text style={{ flex: 1, color: theme.label, fontSize: 17 }}>
                {item.name}
              </Text>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  borderWidth: 1.5,
                  borderColor: isSelected ? Accent : theme.tertiary,
                  backgroundColor: isSelected ? Accent : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isSelected && (
                  <SFIcon name="checkmark" size={14} color="#FFFFFF" />
                )}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text
            style={{
              color: theme.secondary,
              paddingVertical: 32,
              textAlign: "center",
            }}
          >
            {candidates.length === 0
              ? "Everyone's already in this group."
              : "No friends with that name."}
          </Text>
        }
      />

      <View
        style={{
          position: "absolute",
          left: 24,
          right: 24,
          bottom: 32,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add members to group"
          disabled={selected.length === 0}
          onPress={add}
          style={{
            height: 56,
            borderRadius: 28,
            borderCurve: "continuous",
            backgroundColor: selected.length === 0 ? theme.chip : Accent,
            alignItems: "center",
            justifyContent: "center",
            opacity: selected.length === 0 ? 0.5 : 1,
          }}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 17,
              fontFamily: "SFProText-Semibold",
            }}
          >
            {selected.length === 0
              ? "Add members"
              : `Add ${selected.length} member${selected.length === 1 ? "" : "s"}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
