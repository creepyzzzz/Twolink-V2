import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassButton } from "../../cookbooks/fable/components/ui/glass-button";

/**
 * Screen 1 — the first screen of the app. Tariq's 9:16 whale artwork fills
 * the screen edge-to-edge with no borders, and a single liquid-glass
 * button is the only control. Nothing else: no wordmark, no tagline.
 */
export default function Welcome() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Image
        source={require("../../../assets/auth/welcome-whale.png")}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        accessibilityLabel="Poffu the whale"
      />
      <View
        style={[styles.buttonWrap, { bottom: insets.bottom + 44 }]}
        pointerEvents="box-none"
      >
        <GlassButton
          symbol="chevron.right"
          size={68}
          iconSize={26}
          accessibilityLabel="Get started"
          onPress={() => router.push("/onboarding/login")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  buttonWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
});
