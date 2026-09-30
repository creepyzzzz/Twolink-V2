import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";

import { SFIcon } from "../../../../ui/SFIcon";
import { EASE_OUT } from "../../constants/motion";
import { Accent, Space, Type } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";
import { Glass } from "../ui/glass";
import { GlassButton } from "../ui/glass-button";

type Props = {
  /** Distance from the screen top — sits just under the thread header. */
  top: number;
  query: string;
  onQuery: (q: string) => void;
  matchCount: number;
  /** 0-based index of the selected match. */
  matchIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
};

/**
 * iOS-style in-conversation search: a glass field drops in below the header,
 * matches highlight inside the bubbles, and the chevrons walk through them.
 */
export function SearchBar({
  top,
  query,
  onQuery,
  matchCount,
  matchIndex,
  onPrev,
  onNext,
  onClose,
}: Props) {
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);
  // Let the drop-in animation land before the keyboard rises.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

  const trimmed = query.trim();

  return (
    <Animated.View
      entering={FadeInDown.duration(220).easing(EASE_OUT.factory())}
      exiting={FadeOutUp.duration(160)}
      pointerEvents="box-none"
      style={[styles.root, { top }]}
    >
      <View style={styles.row}>
        <Glass style={styles.field}>
          <SFIcon name="magnifyingglass" size={16} color={theme.secondary} />
          <TextInput
            ref={inputRef}
            accessibilityLabel="Search in conversation"
            value={query}
            onChangeText={onQuery}
            placeholder="Search"
            placeholderTextColor={theme.placeholder}
            returnKeyType="search"
            selectionColor={Accent}
            style={[Type.body, styles.input, { color: theme.label }]}
          />
          {query.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
              onPress={() => onQuery("")}
            >
              <SFIcon name="xmark.circle.fill" size={17} color={theme.tertiary} />
            </Pressable>
          )}
        </Glass>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel search"
          hitSlop={8}
          onPress={onClose}
        >
          <Text style={[Type.body, { color: Accent }]}>Cancel</Text>
        </Pressable>
      </View>
      {trimmed.length > 0 && (
        <View style={styles.navRow}>
          {matchCount > 0 ? (
            <>
              <Text style={[Type.caption, { color: theme.secondary }]}>
                {matchIndex + 1} of {matchCount}
              </Text>
              <View style={styles.chevrons}>
                <GlassButton
                  symbol="chevron.up"
                  size={34}
                  iconSize={14}
                  accessibilityLabel="Previous match"
                  onPress={onPrev}
                />
                <GlassButton
                  symbol="chevron.down"
                  size={34}
                  iconSize={14}
                  accessibilityLabel="Next match"
                  onPress={onNext}
                />
              </View>
            </>
          ) : (
            <Text style={[Type.caption, { color: theme.secondary }]}>
              No Results
            </Text>
          )}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: Space[4],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space[3],
  },
  field: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 18,
    borderCurve: "continuous",
    paddingHorizontal: Space[3],
    paddingVertical: 9,
  },
  input: {
    flex: 1,
    paddingVertical: 0,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Space[3],
    paddingTop: Space[2],
  },
  chevrons: {
    flexDirection: "row",
    gap: 8,
  },
});
