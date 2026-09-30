import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "../../cookbooks/fable/hooks/use-theme";

export const unstable_settings = { initialRouteName: "index" };
export default function FableLayout() {
  const theme = useTheme();
  const nav = DefaultTheme;
  return (
    <ThemeProvider
      value={{
        ...nav,
        colors: { ...nav.colors, background: theme.bg, card: theme.bg },
      }}
    >
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen
          name="compose"
          options={{
            presentation: "formSheet",
            sheetAllowedDetents: [0.75, 1],
            sheetGrabberVisible: true,
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
      </Stack>
    </ThemeProvider>
  );
}
