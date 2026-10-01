import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ink, Space, Type } from "../../cookbooks/fable/constants/theme";
import { useTheme } from "../../cookbooks/fable/hooks/use-theme";

/**
 * Screen 1 — the first screen of the app. Tariq's picked whale mascot is
 * the hero (used exactly as supplied, no restyle), presented in a white
 * iOS card on the app's light background, with the Poffu wordmark and a
 * single Get started pill leading into the login screen.
 */
export default function Welcome() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <StatusBar style="dark" />
      <View style={styles.hero}>
        <View style={styles.card}>
          <Image
            source={require("../../../assets/auth/poffu-whale.webp")}
            style={styles.whale}
            resizeMode="contain"
            accessibilityLabel="Poffu the whale"
          />
        </View>
        <Text style={[styles.wordmark, { color: theme.label }]}>Poffu</Text>
        <Text style={[Type.body, { color: theme.secondary, marginTop: 6 }]}>
          Chat with the people who matter.
        </Text>
      </View>
      <View
        style={[styles.cta, { paddingBottom: insets.bottom + Space[6] }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Get started"
          onPress={() => router.push("/onboarding/login")}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>Get started</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Space[6],
  },
  card: {
    width: 264,
    aspectRatio: 1,
    borderRadius: 40,
    backgroundColor: "#FFFFFF",
    padding: Space[4],
    // Soft iOS card shadow so the white card lifts off the light bg.
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  whale: {
    width: "100%",
    height: "100%",
  },
  wordmark: {
    fontSize: 44,
    fontFamily: "SFProText-Bold",
    letterSpacing: -1.5,
    marginTop: Space[6],
  },
  cta: {
    paddingHorizontal: Space[6],
  },
  button: {
    height: 56,
    borderRadius: 28,
    backgroundColor: Ink,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 17,
    fontFamily: "SFProText-Medium",
    letterSpacing: -0.2,
    color: "#FFFFFF",
  },
});
