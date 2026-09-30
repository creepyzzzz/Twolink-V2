import React from "react";
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { router } from "expo-router";
import { useChat } from "../data";
import { useTheme } from "../theme";
import { GlassButton, Icon } from "../ui";
export default function Settings() {
  const t = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 24, paddingTop: 28, paddingBottom: 48 }}
    >
      <View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          },
          { paddingBottom: 28, gap: 20 },
        ]}
      >
        <Text
          style={{
            flex: 1,
            fontSize: 26,
            fontFamily: "SFProText-Semibold",
            letterSpacing: -0.8,
            color: t.text,
          }}
        >
          {"Make yourself\nat home."}
        </Text>
        <GlassButton
          name="xmark"
          label="Close settings"
          testID="close-settings"
          onPress={() => router.back()}
        />
      </View>
      <View style={{ gap: 12, paddingTop: 28 }}>
        <Text style={{ fontSize: 18, fontFamily: "SFProText-Semibold", color: t.text }}>
          Good company. Less noise.
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 21, color: t.muted }}>
          Astra is a little space for your people. This local preview keeps
          messages on your device.
        </Text>
      </View>
      <Pressable
        testID="reset-preview"
        accessibilityLabel="Reset sample conversations"
        onPress={() =>
          Alert.alert(
            "Start fresh?",
            "This resets only the sample conversations stored in Astra.",
            [
              { text: "Keep them", style: "cancel" },
              {
                text: "Reset preview",
                style: "destructive",
                onPress: () => {
                  useChat.getState().reset();
                  router.back();
                },
              },
            ],
          )
        }
        style={{
          paddingVertical: 24,
          flexDirection: "row",
          gap: 10,
          alignItems: "center",
        }}
      >
        <Icon name="arrow.counterclockwise" size={17} />
        <Text style={{ fontSize: 14, color: t.text }}>
          Reset sample conversations
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        testID="all-cookbooks"
        onPress={() => router.dismissTo("/")}
        style={{ paddingVertical: 16 }}
      >
        <Text style={{ color: t.text, fontSize: 17, fontFamily: "SFProText-Semibold" }}>
          All cookbooks
        </Text>
      </Pressable>
    </ScrollView>
  );
}
