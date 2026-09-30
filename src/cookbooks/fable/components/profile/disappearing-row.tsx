import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SFIcon } from "../../../../ui/SFIcon";
import { Accent, Radius, Space, Type } from "../../constants/theme";
import { DISAPPEARING_OPTIONS, useFable } from "../../data/store";
import { useTheme } from "../../hooks/use-theme";

/**
 * WhatsApp-style per-chat disappearing-message timer. The header row shows
 * the current setting; tapping expands the four presets inline.
 * Only messages sent after enabling expire — history is never touched.
 */
export function DisappearingRow({ threadId }: { threadId: string }) {
  const theme = useTheme();
  const ms = useFable((s) => s.disappearing[threadId] ?? 0);
  const setDisappearing = useFable((s) => s.setDisappearing);
  const [open, setOpen] = useState(false);
  const current =
    DISAPPEARING_OPTIONS.find((o) => o.ms === ms) ?? DISAPPEARING_OPTIONS[0];

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Disappearing messages"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={styles.row}
      >
        <View style={{ flex: 1 }}>
          <Text style={[Type.body, { color: theme.label }]}>
            Disappearing messages
          </Text>
          <Text
            style={[Type.caption, { color: theme.secondary, marginTop: 2 }]}
          >
            {ms === 0
              ? "Off"
              : `New messages disappear after ${current.label.toLowerCase()}`}
          </Text>
        </View>
        <SFIcon
          name={open ? "chevron.up" : "chevron.down"}
          size={14}
          color={theme.tertiary}
        />
      </Pressable>
      {open && (
        <View style={styles.options}>
          {DISAPPEARING_OPTIONS.map((option) => {
            const selected = option.ms === ms;
            return (
              <Pressable
                key={option.label}
                accessibilityRole="button"
                accessibilityLabel={`${option.label}${
                  selected ? ", selected" : ""
                }`}
                onPress={() => {
                  setDisappearing(threadId, option.ms);
                  setOpen(false);
                }}
                style={styles.option}
              >
                <Text
                  style={[
                    Type.body,
                    {
                      color: theme.label,
                      fontFamily: selected
                        ? "SFProText-Semibold"
                        : "SFProText-Regular",
                    },
                  ]}
                >
                  {option.label}
                </Text>
                {selected && (
                  <SFIcon name="checkmark" size={16} color={Accent} />
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: "stretch",
    borderRadius: Radius.card,
    borderCurve: "continuous",
    paddingHorizontal: Space[4],
    paddingVertical: Space[3],
    marginTop: Space[4],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space[2],
  },
  options: {
    marginTop: Space[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(120,120,128,0.25)",
    paddingTop: Space[1],
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Space[2] + 2,
  },
});
