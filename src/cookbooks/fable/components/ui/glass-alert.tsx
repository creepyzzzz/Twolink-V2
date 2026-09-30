import {
  AndroidGlassButton,
  AndroidGlassView,
} from "expo-android-glass-view";
import { useEffect, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Accent, Type } from "../../constants/theme";
import { useFable } from "../../data/store";
import { useTheme } from "../../hooks/use-theme";

const DESTRUCTIVE = "#FF3B30";

/**
 * iOS 26-style alert: a frosted liquid-glass card with native glass buttons.
 *
 * Rendered in the same window as the screen (NOT a React Native Modal — the
 * library docs note glass inside a Modal can only see the modal's content),
 * so the card actually blurs the chat behind it, like the ••• menu does.
 * Mount once near the top of the fable layout; trigger with
 * useFable.getState().showAlert(...).
 */
export function GlassAlertHost() {
  const theme = useTheme();
  const alert = useFable((s) => s.alert);
  const dismissAlert = useFable((s) => s.dismissAlert);
  const [fade] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (alert) {
      fade.setValue(0);
      Animated.timing(fade, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }).start();
    }
  }, [alert, fade]);

  if (!alert) return null;

  return (
    <Animated.View
      style={[styles.host, { opacity: fade }]}
      pointerEvents="box-none"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss dialog"
        onPress={dismissAlert}
        style={styles.backdrop}
      />
      <View style={styles.center} pointerEvents="box-none">
        <AndroidGlassView
          tintColor="rgba(255, 255, 255, 0.5)"
          blurRadius={40}
          cornerRadius={28}
          style={styles.card}
        >
          <Text style={[Type.navTitle, styles.title, { color: theme.label }]}>
            {alert.title}
          </Text>
          {alert.message ? (
            <Text
              style={[Type.meta, styles.message, { color: theme.secondary }]}
            >
              {alert.message}
            </Text>
          ) : null}
          <View style={styles.actions}>
            {alert.actions.map((action) => (
              <AndroidGlassButton
                key={action.text}
                tintColor="rgba(255, 255, 255, 0.25)"
                onPress={() => {
                  dismissAlert();
                  action.onPress?.();
                }}
                style={styles.action}
              >
                {/* Rendered as a child (not the title prop) so the label is
                    guaranteed single-line: it shrinks to fit instead of
                    wrapping onto a second line. */}
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[
                    styles.actionTitle,
                    action.style === "destructive" && { color: DESTRUCTIVE },
                    action.style === "default" && { color: Accent },
                    action.style === "cancel" && { color: theme.label },
                  ]}
                >
                  {action.text}
                </Text>
              </AndroidGlassButton>
            ))}
          </View>
        </AndroidGlassView>
      </View>
    </Animated.View>
  );
}

const FILL = {
  position: "absolute" as const,
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
};

const styles = StyleSheet.create({
  host: {
    ...FILL,
    zIndex: 50,
    elevation: 50,
  },
  backdrop: {
    ...FILL,
    // Transparent: the chat stays fully bright behind the dialog, like the
    // ••• menu. Still catches taps outside the card to dismiss.
    backgroundColor: "transparent",
  },
  center: {
    flex: 1,
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
