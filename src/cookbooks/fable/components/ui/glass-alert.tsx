import {
  AndroidGlassButton,
  AndroidGlassView,
} from "expo-android-glass-view";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Accent, Type } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";

export type GlassAlertAction = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

const DESTRUCTIVE = "#FF3B30";

/**
 * iOS 26-style alert: a frosted liquid-glass card with native glass buttons.
 * Replaces the platform Alert wherever we want the TwoLink look.
 */
export function GlassAlert({
  visible,
  title,
  message,
  actions,
  onDismiss,
}: {
  visible: boolean;
  title: string;
  message?: string;
  actions: GlassAlertAction[];
  onDismiss: () => void;
}) {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss dialog"
          onPress={onDismiss}
          style={StyleSheet.absoluteFill}
        />
        <AndroidGlassView
          tintColor="rgba(255, 255, 255, 0.5)"
          blurRadius={40}
          cornerRadius={28}
          style={styles.card}
        >
            <Text style={[Type.navTitle, styles.title, { color: theme.label }]}>
              {title}
            </Text>
            {message ? (
              <Text
                style={[Type.meta, styles.message, { color: theme.secondary }]}
              >
                {message}
              </Text>
            ) : null}
            <View style={styles.actions}>
              {actions.map((action) => (
                <AndroidGlassButton
                  key={action.text}
                  title={action.text}
                  titleStyle={[
                    styles.actionTitle,
                    action.style === "destructive" && { color: DESTRUCTIVE },
                    action.style === "default" && { color: Accent },
                    action.style === "cancel" && { color: theme.label },
                  ]}
                  tintColor="rgba(255, 255, 255, 0.25)"
                  onPress={() => {
                    onDismiss();
                    action.onPress?.();
                  }}
                  style={styles.action}
                />
              ))}
            </View>
          </AndroidGlassView>
        </View>
      </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 48,
  },
  card: {
    width: "100%",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  title: {
    textAlign: "center",
  },
  message: {
    textAlign: "center",
    marginTop: 6,
  },
  actions: {
    marginTop: 14,
    gap: 8,
  },
  action: {
    alignSelf: "stretch",
    height: 44,
  },
  actionTitle: {
    fontFamily: "SFProText-Semibold",
    fontSize: 16,
  },
});
