import { useEffect } from "react";
import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { AndroidGlassMenuProvider } from "expo-android-glass-view";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { useTheme } from "../../cookbooks/fable/hooks/use-theme";
import { GlassAlertHost } from "../../cookbooks/fable/components/ui/glass-alert";
import { useFable } from "../../cookbooks/fable/data/store";

/**
 * Sends due scheduled messages wherever the user is in the app: once on
 * mount, then every 15 seconds. The queue itself is persisted, so messages
 * scheduled before a restart still send. Expired disappearing messages are
 * swept on the same tick.
 */
function ScheduledFlusher() {
  useEffect(() => {
    const tick = () => {
      const state = useFable.getState();
      state.flushScheduled();
      state.sweepExpired();
    };
    tick();
    const t = setInterval(tick, 15000);
    return () => clearInterval(t);
  }, []);
  return null;
}

export const unstable_settings = { initialRouteName: "index" };
export default function FableLayout() {
  const theme = useTheme();
  const nav = DefaultTheme;
  return (
    <AndroidGlassMenuProvider>
      <ThemeProvider
      value={{
        ...nav,
        colors: { ...nav.colors, background: theme.bg, card: theme.bg },
      }}
    >
      <StatusBar style="dark" />
      <View style={{ flex: 1 }}>
        <ScheduledFlusher />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.bg },
          }}
        >
        <Stack.Screen name="index" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen
          name="contact/[id]"
          options={{
            presentation: "transparentModal",
            animation: "none",
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
        <Stack.Screen
          name="group/[id]"
          options={{
            presentation: "transparentModal",
            animation: "none",
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
        <Stack.Screen
          name="compose"
          options={{
            presentation: "formSheet",
            sheetAllowedDetents: [0.75, 1],
            sheetGrabberVisible: true,
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            presentation: "formSheet",
            sheetAllowedDetents: [0.65, 1],
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen
          name="photo"
          options={{ presentation: "fullScreenModal" }}
        />
        <Stack.Screen
          name="wallpaper"
          options={{ presentation: "fullScreenModal" }}
        />
        </Stack>
        {/* In-window glass alert host: renders above every fable screen so the
            card's glass can blur the content behind it. */}
        <GlassAlertHost />
      </View>
    </ThemeProvider>
    </AndroidGlassMenuProvider>
  );
}
