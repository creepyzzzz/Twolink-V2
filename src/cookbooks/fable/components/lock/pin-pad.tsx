import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Space } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";
import { Glass } from "../ui/glass";

const PIN_LENGTH = 4;
const KEY_SIZE = 76;

type KeyProps = {
  label: string;
  onPress: () => void;
  icon?: boolean;
  testID?: string;
};

/** One liquid-glass numeric key. */
function Key({ label, onPress, icon, testID }: KeyProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={icon ? "Delete" : `Number ${label}`}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.key,
        { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] },
      ]}
    >
      <Glass style={styles.keyGlass}>
        {icon ? (
          <Text style={[styles.keyLabel, { color: theme.label }]}>⌫</Text>
        ) : (
          <Text style={[styles.keyLabel, { color: theme.label }]}>{label}</Text>
        )}
      </Glass>
    </Pressable>
  );
}

export { PIN_LENGTH };

/**
 * Liquid-glass numeric PIN pad with entry dots. Submits the PIN when the
 * last digit lands, then clears. Bump `shakeKey` to shake and clear on a
 * rejected PIN.
 */
export function PinPad({
  onSubmit,
  shakeKey,
}: {
  onSubmit: (pin: string) => void;
  shakeKey: number;
}) {
  const theme = useTheme();
  const [pin, setPin] = useState("");
  const shakeX = useSharedValue(0);

  useEffect(() => {
    if (shakeKey === 0) return;
    shakeX.value = withSequence(
      withTiming(-12, { duration: 55 }),
      withRepeat(withTiming(12, { duration: 55 }), 3, true),
      withTiming(0, { duration: 55 }),
    );
  }, [shakeKey, shakeX]);

  const dotsStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const press = (digit: string) => {
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + digit;
    if (next.length === PIN_LENGTH) {
      // Clear immediately; a rejection replays as a shake via shakeKey.
      setPin("");
      onSubmit(next);
    } else {
      setPin(next);
    }
  };

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.dots, dotsStyle]}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor:
                  i < pin.length ? theme.label : "transparent",
                borderColor: theme.tertiary,
              },
            ]}
          />
        ))}
      </Animated.View>
      <View style={styles.grid}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key key={d} label={d} onPress={() => press(d)} testID={`pin-${d}`} />
        ))}
        <View style={styles.key} />
        <Key label="0" onPress={() => press("0")} testID="pin-0" />
        <Key
          label=""
          icon
          onPress={() => setPin((p) => p.slice(0, -1))}
          testID="pin-delete"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    gap: Space[6],
  },
  dots: {
    flexDirection: "row",
    gap: Space[4],
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: Space[4],
    width: KEY_SIZE * 3 + Space[4] * 2,
  },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
  },
  keyGlass: {
    flex: 1,
    borderRadius: KEY_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  keyLabel: {
    fontSize: 30,
    fontFamily: "SFProText-Semibold",
  },
});
