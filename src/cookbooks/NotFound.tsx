import { router } from "expo-router";
import { ActivityIndicator, Pressable, Text, View, useColorScheme } from "react-native";

/**
 * Neutral loading state for deep-link routes while the store is still
 * bootstrapping (chat list not yet loaded). Rendered instead of NotFound
 * so a cold start never flashes "not found" for a valid target.
 */
export function LoadingRoute() {
  const dark = useColorScheme() === "dark";
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: dark ? "#171819" : "#F2F2F4",
      }}
    >
      <ActivityIndicator size="small" color={dark ? "#91BFFF" : "#0060C9"} />
    </View>
  );
}

export function NotFound({ home = "/" }: { home?: "/" | "/fable" }) {
  const dark = useColorScheme() === "dark";
  return (
    <View
      style={{
        flex: 1,
        padding: 32,
        gap: 24,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: dark ? "#171819" : "#F2F2F4",
      }}
    >
      <Text
        style={{
          fontSize: 24,
          fontFamily: "SFProText-Semibold",
          color: dark ? "#F5F5F7" : "#17191B",
        }}
      >
        Conversation not found
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.replace(home)}
        style={{ padding: 16 }}
      >
        <Text style={{ fontSize: 17, color: dark ? "#91BFFF" : "#0060C9" }}>
          Go back
        </Text>
      </Pressable>
    </View>
  );
}
