import { StyleSheet, Text, View } from "react-native";

import { Space, Type } from "../../constants/theme";
import type { Message } from "../../data/messages";
import { useTheme } from "../../hooks/use-theme";

/**
 * Centered italic tombstone left by "delete for everyone". Rendered at the
 * call site instead of inside Bubble — that file's gesture/effect hook
 * patterns trip the v6 hooks linter on any conditional return.
 */
export function DeletedTombstone({
  message,
  first,
}: {
  message: Message;
  /** First row of a visual group gets the wider gap. */
  first: boolean;
}) {
  const theme = useTheme();
  const mine = message.from === "me";
  return (
    <View
      style={[
        styles.row,
        { marginTop: first ? Space[5] : Space[2] },
      ]}
    >
      <Text
        style={[Type.caption, { color: theme.secondary, fontStyle: "italic" }]}
      >
        {mine ? "You deleted this message" : "This message was deleted"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: Space[4],
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Space[2],
  },
});
