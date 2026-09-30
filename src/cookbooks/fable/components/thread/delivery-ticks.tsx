import { StyleSheet, Text, View } from "react-native";

import type { Message, MessageStatus } from "../../data/messages";

/**
 * WhatsApp-style delivery ticks for outgoing messages: one tick sent, two
 * delivered, two blue read — plus an "Edited" marker when the text changed
 * after sending. Kept in its own file: this file's sibling components trip
 * the v6 hooks linter when they share a file with Bubble's gesture hooks.
 */
export function DeliveryTicks({ message }: { message: Message }) {
  const status: MessageStatus = message.status ?? "sent";
  const read = status === "read";
  return (
    <View style={styles.statusRow}>
      {message.edited && <Text style={styles.editedLabel}>Edited</Text>}
      <Text
        style={[
          styles.ticks,
          { color: read ? "#34B7F1" : "rgba(255,255,255,0.6)" },
        ]}
      >
        {status === "sent" ? "✓" : "✓✓"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  ticks: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -1,
  },
  editedLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
  },
});
