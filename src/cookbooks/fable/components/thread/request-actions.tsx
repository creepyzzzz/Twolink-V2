import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useTheme } from "../../hooks/use-theme";
import { Glass } from "../ui/glass";
import { Radius, Space } from "../../constants/theme";

/**
 * Accept / Decline / Block bar. Floats bottom-anchored in the exact slot
 * of the composer — same sticky positioning, same glass pill treatment —
 * and is replaced by the composer (with animation) once accepted.
 */
export function RequestActions({
  requesterId,
  requesterName,
  insetBottom,
  onAccept,
  onDecline,
  onBlock,
  onLayoutHeight,
}: {
  requesterId: string;
  requesterName: string;
  insetBottom: number;
  onAccept: () => Promise<void> | void;
  onDecline: () => Promise<void> | void;
  onBlock: () => Promise<void> | void;
  onLayoutHeight?: (height: number) => void;
}) {
  const theme = useTheme();
  const [busy, setBusy] = useState<"accept" | "decline" | "block" | null>(null);

  const run = async (
    which: "accept" | "decline" | "block",
    fn: () => Promise<void> | void,
  ) => {
    if (busy) return;
    setBusy(which);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const onLayout = (e: LayoutChangeEvent) =>
    onLayoutHeight?.(e.nativeEvent.layout.height);

  return (
    <KeyboardStickyView
      offset={{ closed: 0, opened: insetBottom }}
      style={styles.sticky}
    >
      <View
        onLayout={onLayout}
        style={[styles.root, { paddingBottom: insetBottom + Space[2] }]}
      >
        <Text style={[styles.title, { color: theme.secondary }]}>
          {requesterName} wants to message you
        </Text>
        <View style={[styles.pill, { boxShadow: theme.lift }]}>
          <Glass style={styles.card}>
            <View style={styles.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Decline request"
                onPress={() => run("decline", onDecline)}
                style={[styles.btn, { backgroundColor: theme.chip }]}
              >
                {busy === "decline" ? (
                  <ActivityIndicator size="small" color={theme.secondary} />
                ) : (
                  <Text style={[styles.label, { color: theme.label }]}>
                    Decline
                  </Text>
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Block user"
                onPress={() => run("block", onBlock)}
                style={[styles.btn, { backgroundColor: theme.chip }]}
              >
                {busy === "block" ? (
                  <ActivityIndicator size="small" color="#FF3B30" />
                ) : (
                  <Text style={[styles.label, { color: "#FF3B30" }]}>Block</Text>
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Accept request"
                onPress={() => run("accept", onAccept)}
                style={[styles.btn, styles.accept, { backgroundColor: "#3394FA" }]}
              >
                {busy === "accept" ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.label, { color: "#fff" }]}>Accept</Text>
                )}
              </Pressable>
            </View>
          </Glass>
        </View>
      </View>
    </KeyboardStickyView>
  );
}

const styles = StyleSheet.create({
  sticky: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  root: {
    paddingHorizontal: Space[4],
    paddingTop: Space[2],
  },
  title: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 10,
    opacity: 0.7,
  },
  pill: {
    borderRadius: Radius.card,
    borderCurve: "continuous",
  },
  card: {
    borderRadius: Radius.card,
    padding: 6,
  },
  row: {
    flexDirection: "row",
    gap: 6,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  accept: {
    flex: 1.4,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
});
