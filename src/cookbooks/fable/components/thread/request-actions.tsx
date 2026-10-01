import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../hooks/use-theme";

/**
 * Accept / Decline / Block bar shown in place of the composer
 * when the open chat is an incoming friend request.
 */
export function RequestActions({
  requesterId,
  requesterName,
  insetBottom,
  onAccept,
  onDecline,
  onBlock,
}: {
  requesterId: string;
  requesterName: string;
  insetBottom: number;
  onAccept: () => Promise<void> | void;
  onDecline: () => Promise<void> | void;
  onBlock: () => Promise<void> | void;
}) {
  const theme = useTheme();
  const [busy, setBusy] = useState<"accept" | "decline" | "block" | null>(null);

  const run = async (which: "accept" | "decline" | "block", fn: () => Promise<void> | void) => {
    if (busy) return;
    setBusy(which);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insetBottom, 12) }]}>
      <Text style={[styles.title, { color: theme.secondary }]}>
        {requesterName} wants to message you
      </Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Decline request"
          onPress={() => run("decline", onDecline)}
          style={[styles.btn, { backgroundColor: theme.surface }]}
        >
          {busy === "decline" ? (
            <ActivityIndicator size="small" color={theme.secondary} />
          ) : (
            <Text style={[styles.label, { color: theme.label }]}>Decline</Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Block user"
          onPress={() => run("block", onBlock)}
          style={[styles.btn, { backgroundColor: theme.surface }]}
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  title: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 10,
    opacity: 0.7,
  },
  row: {
    flexDirection: "row",
    gap: 8,
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
