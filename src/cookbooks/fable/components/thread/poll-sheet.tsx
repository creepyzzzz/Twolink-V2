import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { SFIcon } from "../../../../ui/SFIcon";
import { Accent, Radius, Space, Type } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";
import { Sheet } from "../ui/sheet";

const MAX_OPTIONS = 5;

/** Group poll composer: question + up to five options, in a sheet. */
export function PollSheet({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (question: string, options: string[]) => void;
}) {
  const theme = useTheme();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);

  const setOption = (i: number, text: string) =>
    setOptions((prev) => prev.map((o, j) => (j === i ? text : o)));

  const filled = options.filter((o) => o.trim()).length;
  const valid = question.trim().length > 0 && filled >= 2;

  return (
    <Sheet detent={0.62}>
      <View style={styles.head}>
        <Text style={[Type.name, { color: theme.label }]}>New Poll</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close poll composer"
          onPress={onClose}
          hitSlop={10}
          style={[styles.close, { backgroundColor: theme.chip }]}
        >
          <SFIcon name="xmark" size={13} color={theme.secondary} />
        </Pressable>
      </View>
      <TextInput
        accessibilityLabel="Poll question"
        placeholder="Ask a question"
        placeholderTextColor={theme.placeholder}
        value={question}
        onChangeText={setQuestion}
        autoFocus
        returnKeyType="next"
        selectionColor={Accent}
        style={[
          Type.body,
          styles.input,
          { color: theme.label, backgroundColor: theme.chip },
        ]}
      />
      {options.map((option, i) => (
        <TextInput
          key={i}
          accessibilityLabel={`Option ${i + 1}`}
          placeholder={`Option ${i + 1}`}
          placeholderTextColor={theme.placeholder}
          value={option}
          onChangeText={(t) => setOption(i, t)}
          returnKeyType={i === options.length - 1 ? "done" : "next"}
          selectionColor={Accent}
          style={[
            Type.body,
            styles.input,
            { color: theme.label, backgroundColor: theme.chip },
          ]}
        />
      ))}
      {options.length < MAX_OPTIONS && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add option"
          onPress={() => setOptions((prev) => [...prev, ""])}
          style={styles.addRow}
        >
          <SFIcon name="plus" size={14} color={Accent} />
          <Text style={[Type.body, { color: Accent }]}>Add option</Text>
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create poll"
        disabled={!valid}
        onPress={() => valid && onCreate(question.trim(), options)}
        style={[
          styles.create,
          {
            backgroundColor: theme.outgoing,
            opacity: valid ? 1 : 0.35,
          },
        ]}
      >
        <Text style={[Type.body, styles.createText, { color: theme.outgoingText }]}>
          Create Poll
        </Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Space[5],
    paddingTop: Space[2],
    marginBottom: Space[3],
  },
  close: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    marginHorizontal: Space[5],
    marginBottom: Space[2],
    borderRadius: 16,
    borderCurve: "continuous",
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Space[5],
    paddingVertical: Space[2],
  },
  create: {
    marginHorizontal: Space[5],
    marginTop: Space[4],
    borderRadius: Radius.pill,
    paddingVertical: 14,
    alignItems: "center",
  },
  createText: {
    fontWeight: "600",
  },
});
