import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassButton } from "../components/ui/glass-button";
import { Space, Type } from "../constants/theme";
import { useFable } from "../data/store";
import { useTheme } from "../hooks/use-theme";
import { PinPad, PIN_LENGTH } from "../components/lock/pin-pad";

type Step = "verify" | "create" | "confirm";

const TITLES: Record<Step, string> = {
  verify: "Enter your current PIN",
  create: "Create an app PIN",
  confirm: "Confirm your PIN",
};

/**
 * Create / change / remove the app lock PIN. Reuses the glass PIN pad.
 */
export default function AppLockSetup() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const appPin = useFable((s) => s.appPin);
  const setAppPin = useFable((s) => s.setAppPin);
  const setAppUnlocked = useFable((s) => s.setAppUnlocked);
  const [step, setStep] = useState<Step>(appPin ? "verify" : "create");
  const [pending, setPending] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [error, setError] = useState(false);

  const reject = () => {
    setError(true);
    setShakeKey((k) => k + 1);
  };

  const finish = (pin: string | null) => {
    setAppPin(pin);
    // The user just proved they know the PIN — stay unlocked.
    setAppUnlocked(true);
    router.back();
  };

  const onSubmit = (pin: string) => {
    setError(false);
    if (step === "verify") {
      if (pin === appPin) setStep("create");
      else reject();
    } else if (step === "create") {
      setPending(pin);
      setStep("confirm");
    } else {
      if (pin === pending) finish(pin);
      else {
        setPending("");
        setStep("create");
        reject();
      }
    }
  };

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.bg, paddingTop: insets.top + Space[2] },
      ]}
    >
      <View style={styles.header}>
        <GlassButton
          symbol="xmark"
          accessibilityLabel="Close app lock settings"
          onPress={() => router.back()}
        />
      </View>
      <Text style={[styles.title, { color: theme.label }]}>
        {TITLES[step]}
      </Text>
      <Text
        style={[
          Type.body,
          {
            color: error ? "#FF3B30" : theme.secondary,
            marginTop: 6,
            marginBottom: Space[6],
          },
        ]}
      >
        {error
          ? "PINs didn't match — try again"
          : step === "create" && appPin
            ? "You'll use this every time TwoLink opens"
            : `${PIN_LENGTH} digits`}
      </Text>
      <PinPad shakeKey={shakeKey} onSubmit={onSubmit} />
      {step === "verify" && (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setAppPin(null);
            setAppUnlocked(true);
            router.back();
          }}
          style={{ marginTop: Space[8] }}
        >
          <Text style={[Type.body, { color: "#FF3B30" }]}>
            Turn off App Lock
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: Space[6],
  },
  header: {
    alignSelf: "stretch",
    alignItems: "flex-end",
    marginBottom: Space[4],
  },
  title: {
    fontSize: 26,
    fontFamily: "SFProText-Bold",
    letterSpacing: -0.4,
  },
});
