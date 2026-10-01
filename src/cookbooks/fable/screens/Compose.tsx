import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import { Pressable, Text, TextInput, View } from "react-native";
import { SFIcon } from "../../../ui/SFIcon";
import { Avatar } from "../components/ui/avatar";
import { Glass } from "../components/ui/glass";
import { GlassButton } from "../components/ui/glass-button";
import { avatarSource, type Person } from "../data/people";
import { dbProfileToPerson, useFable } from "../data/store";
import { getOrCreateDirectChat, searchUsers } from "../../../lib/chat";
import { Accent, Type } from "../constants/theme";
import { useTheme } from "../hooks/use-theme";

export default function Compose() {
  const [query, setQuery] = useState("");
  const [groupMode, setGroupMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [creating, setCreating] = useState(false);
  const theme = useTheme();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live user search against profiles (debounced).
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      void searchUsers(query)
        .then((found) => setResults(found.map(dbProfileToPerson)))
        .catch(() => setResults([]));
    }, 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query]);

  const toggleMember = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );

  const create = async () => {
    if (selected.length === 0 || creating) return;
    setCreating(true);
    try {
      const store = useFable.getState();
      // Only a name the user typed is stored — a blank field lets the chat
      // row and header fall back to member names via groupDisplayName().
      const name = groupName.trim();
      const id = await store.createGroup(name, selected);
      router.replace({ pathname: "/fable/chat/[id]", params: { id } });
    } finally {
      setCreating(false);
    }
  };

  const openDirect = async (person: Person) => {
    try {
      const id = await getOrCreateDirectChat(person.id);
      router.replace({ pathname: "/fable/chat/[id]", params: { id } });
    } catch (e) {
      if (__DEV__) console.log("[DIAG] openDirect failed:", JSON.stringify(e, null, 2));
      useFable.getState().showAlert({
        title: "Couldn't open chat",
        message: "Check your connection and try again.",
        actions: [{ text: "OK", style: "default" }],
      });
    }
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
          {groupMode ? "New group" : "New message"}
        </Text>
        <GlassButton
          symbol="xmark"
          accessibilityLabel="Close new message"
          onPress={() => router.back()}
        />
      </View>

      {!groupMode ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create a new group"
          onPress={() => setGroupMode(true)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 16,
            marginHorizontal: 24,
            marginTop: 20,
            paddingVertical: 12,
          }}
        >
          <Glass
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SFIcon name="person.2" size={24} color={theme.label} />
          </Glass>
          <Text style={{ color: theme.label, fontSize: 17 }}>New group</Text>
        </Pressable>
      ) : (
        <View style={{ marginHorizontal: 24, marginTop: 12 }}>
          <Glass
            style={{
              height: 44,
              borderRadius: 22,
              paddingHorizontal: 16,
              justifyContent: "center",
            }}
          >
            <TextInput
              accessibilityLabel="Group name"
              placeholder="Group name (optional)"
              placeholderTextColor={theme.secondary}
              value={groupName}
              onChangeText={setGroupName}
              autoCorrect={false}
              maxLength={40}
              style={{
                height: 44,
                paddingVertical: 0,
                textAlignVertical: "center",
                fontSize: 17,
                fontFamily: "SFProText-Regular",
                color: theme.label,
              }}
            />
          </Glass>
          <Text
            style={[
              Type.caption,
              { color: theme.secondary, marginTop: 10, marginLeft: 4 },
            ]}
          >
            {selected.length === 0
              ? "Add members"
              : `${selected.length} member${selected.length === 1 ? "" : "s"} selected`}
          </Text>
        </View>
      )}

      <View
        style={{
          marginHorizontal: 24,
          marginTop: groupMode ? 12 : 24,
          marginBottom: 8,
        }}
      >
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
              <SFIcon
                name="xmark.circle.fill"
                size={17}
                color={theme.secondary}
              />
            </Pressable>
          ) : null}
        </Glass>
      </View>
      <FlashList
        data={results}
        keyExtractor={(person) => person.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }}
        renderItem={({ item }) => {
          const isSelected = selected.includes(item.id);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                groupMode
                  ? `${isSelected ? "Remove" : "Add"} ${item.name} ${isSelected ? "from" : "to"} the group`
                  : `Message ${item.name}`
              }
              onPress={() =>
                groupMode ? toggleMember(item.id) : void openDirect(item)
              }
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 16,
                paddingVertical: 12,
              }}
            >
              <Avatar source={avatarSource(item)} size={52} />
              <Text style={{ flex: 1, color: theme.label, fontSize: 17 }}>
                {item.name}
              </Text>
              {groupMode && (
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
              )}
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
            {query.trim() ? "No people found." : "Search for people by name."}
          </Text>
        }
      />

      {groupMode && (
        <View
          style={{
            position: "absolute",
            left: 24,
            right: 24,
            bottom: 32,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <GlassButton
            symbol="chevron.left"
            accessibilityLabel="Back to new message"
            onPress={() => {
              setGroupMode(false);
              setSelected([]);
              setGroupName("");
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create group"
            disabled={selected.length === 0 || creating}
            onPress={() => void create()}
            style={{
              flex: 1,
              height: 56,
              borderRadius: 28,
              borderCurve: "continuous",
              backgroundColor:
                selected.length === 0 ? theme.chip : Accent,
              alignItems: "center",
              justifyContent: "center",
              opacity: selected.length === 0 || creating ? 0.5 : 1,
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 17,
                fontFamily: "SFProText-Semibold",
              }}
            >
              Create group
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
