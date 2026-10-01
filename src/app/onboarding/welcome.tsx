import { router } from "expo-router";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Glass } from "../../cookbooks/fable/components/ui/glass";
import { EASE_OUT, PRESS_MS } from "../../cookbooks/fable/constants/motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Screen 1 — the first screen of the app. Tariq's 9:16 whale artwork fills
 * the screen edge-to-edge with no borders, and a single minimal
 * liquid-glass "Continue" pill is the only control. Nothing else.
 */
export default function Welcome() {
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Image
        source={require("../../../assets/auth/welcome-whale.jpg")}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        accessibilityLabel="Poffu the whale"
      />
      <View
        style={[styles.buttonWrap, { bottom: insets.bottom + 44 }]}
        pointerEvents="box-none"
      >
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel="Continue"
          onPress={() => router.push("/onboarding/login")}
          onPressIn={() =>
            scale.set(withTiming(0.97, { duration: PRESS_MS, easing: EASE_OUT }))
          }
          onPressOut={() =>
            scale.set(withTiming(1, { duration: 200, easing: EASE_OUT }))
          }
          style={[styles.pillSize, animatedStyle]}
        >
          <Glass
            interactive
            tint="rgba(51,148,250,0.72)"
            style={styles.pill}
          >
            <Text style={styles.pillText}>Continue</Text>
          </Glass>
        </AnimatedPressable>
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
  pillSize: {
    width: 160,
    height: 48,
  },
  pill: {
    flex: 1,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    fontSize: 15,
    fontFamily: "SFProText-Semibold",
    letterSpacing: -0.2,
    color: "#FFFFFF",
  },
});
