import { EmojiKeyboard, type EmojiType } from "rn-emoji-keyboard";
import { StyleSheet, View } from "react-native";

import { Accent } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";

type Props = {
  onPick: (emoji: string) => void;
};

/**
 * The iOS-style emoji board, themed to Fable's light glass: white field,
 * blue active category, no search chrome — it behaves like the iOS emoji
 * keyboard that swaps in above the composer.
 */
export function EmojiPanel({ onPick }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <EmojiKeyboard
        onEmojiSelected={(e: EmojiType) => onPick(e.emoji)}
        hideHeader
        enableSearchBar={false}
        categoryPosition="bottom"
        emojiSize={30}
        theme={{
          container: "transparent",
          header: theme.secondary,
          category: {
            icon: theme.tertiary,
            iconActive: Accent,
            container: "transparent",
            containerActive: theme.chip,
          },
        }}
        styles={{
          container: {
            borderRadius: 0,
          },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 288,
    overflow: "hidden",
  },
});
