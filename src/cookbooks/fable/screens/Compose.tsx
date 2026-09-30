import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import { Pressable, Text, TextInput, View } from "react-native";
import { SFIcon } from "../../../ui/SFIcon";
import { Avatar } from "../components/ui/avatar";
import { Glass } from "../components/ui/glass";
import { GlassButton } from "../components/ui/glass-button";
import { PEOPLE, PEOPLE_BY_ID } from "../data/people";
import { useFable } from "../data/store";
import { Accent, Type } from "../constants/theme";
import { useTheme } from "../hooks/use-theme";

export default function Compose() {
  const [query, setQuery] = useState("");
  const [groupMode, setGroupMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const theme = useTheme();

  const filtered = useMemo(
    () =>
      PEOPLE.filter((person) =>
        person.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );

  const toggleMember = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );

  const create = () => {
    if (selected.length === 0) return;
    const store = useFable.getState();
    const autoName =
      selected
        .slice(0, 2)
        .map((id) => PEOPLE_BY_ID[id]?.first ?? "")
        .filter(Boolean)
        .join(", ") + (selected.length > 2 ? ` +${selected.length - 2}` : "");
    const name = groupName.trim() || autoName || "New group";
    const id = store.createGroup(name, selected);
    // A couple of hellos so the new thread feels alive.
    store.append(id, "Hey everyone! 🙌", "them", false, {
      senderId: selected[0],
    });
    if (selected[1])
      store.append(id, "Finally, a group chat", "them", false, {
        senderId: selected[1],
      });
    router.replace({ pathname: "/fable/chat/[id]", params: { id } });
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
        data={filtered}
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
                groupMode
                  ? toggleMember(item.id)
                  : router.replace({
                      pathname: "/fable/chat/[id]",
                      params: { id: item.id },
                    })
              }
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
            No friends with that name.
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
            disabled={selected.length === 0}
            onPress={create}
            style={{
              flex: 1,
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
                paddingVertical: 14,
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
