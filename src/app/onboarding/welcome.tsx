import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ink, Space } from "../../cookbooks/fable/constants/theme";

/**
 * Screen 1 — full-screen whale visual, one Next button. Nothing else.
 */
export default function Welcome() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Image
        source={require("../../../assets/auth/welcome-whale.webp")}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={300}
      />
      <View
        style={[styles.cta, { paddingBottom: insets.bottom + Space[6] }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next"
          onPress={() => router.push("/onboarding/login")}
          style={({ pressed }) => [
            styles.next,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.nextText}>Next</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0E3A5D",
  },
  cta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Space[6],
  },
  next: {
    height: 56,
    borderRadius: 28,
    backgroundColor: Ink,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.85,
  },
  nextText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontFamily: "SFProText-Semibold",
    letterSpacing: -0.2,
  },
});
