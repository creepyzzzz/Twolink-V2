import { router } from "expo-router";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { GlassButton } from "../components/ui/glass-button";
import { useFable } from "../data/store";
import { useTheme } from "../hooks/use-theme";

export default function Settings() {
  const theme = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: 24, paddingTop: 28, paddingBottom: 48 }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          marginBottom: 28,
        }}
      >
        <Text
          style={{
            flex: 1,
            fontSize: 26,
            fontWeight: "600",
            color: theme.label,
          }}
        >
          Make it yours.
        </Text>
        <GlassButton
          symbol="xmark"
          accessibilityLabel="Close settings"
          onPress={() => router.back()}
        />
      </View>
      <Text
        style={{
          marginTop: 28,
          fontSize: 17,
          fontWeight: "600",
          color: theme.label,
        }}
      >
        Your people, a little closer.
      </Text>
      <Text
        style={{
          marginTop: 12,
          fontSize: 15,
          lineHeight: 22,
          color: theme.secondary,
        }}
      >
        Fable is a local chat preview. Sample messages stay on this device.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          Alert.alert(
            "Start fresh?",
            "Reset the sample conversations in Fable?",
            [
              { text: "Keep them", style: "cancel" },
              {
                text: "Reset preview",
                style: "destructive",
                onPress: () => {
                  useFable.getState().reset();
                  router.back();
                },
              },
            ],
          )
        }
        style={{ paddingVertical: 24 }}
      >
        <Text style={{ color: theme.label, fontSize: 15 }}>
          Reset sample conversations
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        testID="all-cookbooks"
        onPress={() => router.dismissTo("/")}
        style={{ paddingVertical: 16 }}
      >
        <Text style={{ fontSize: 17, fontWeight: "600", color: theme.label }}>
          All cookbooks
        </Text>
      </Pressable>
    </ScrollView>
  );
}
