import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Space, Type } from "../../constants/theme";
import { useFable } from "../../data/store";
import { useTheme } from "../../hooks/use-theme";
import { PinPad } from "./pin-pad";

/**
 * Full-screen app lock gate. Opaque — nothing behind it peeks through.
 * The app re-locks whenever it leaves the foreground (see the root layout).
 */
export function LockScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const appPin = useFable((s) => s.appPin);
  const setAppUnlocked = useFable((s) => s.setAppUnlocked);
  const [shakeKey, setShakeKey] = useState(0);
  const [wrong, setWrong] = useState(false);

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.bg, paddingTop: insets.top },
      ]}
    >
      <Text style={[Type.body, { color: theme.secondary }]}>
        {wrong ? "Wrong PIN — try again" : "Enter your PIN"}
      </Text>
      <View style={{ marginTop: Space[6] }}>
        <PinPad
          shakeKey={shakeKey}
          onSubmit={(pin) => {
            if (pin === appPin) {
              setWrong(false);
              setAppUnlocked(true);
            } else {
              setWrong(true);
              setShakeKey((k) => k + 1);
            }
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
});
