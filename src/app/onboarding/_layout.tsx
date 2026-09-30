import { Stack } from "expo-router";
import { GlassAlertHost } from "../../cookbooks/fable/components/ui/glass-alert";

/**
 * Onboarding (welcome + login). The in-window glass alert is mounted here
 * so the "coming soon" notices match the rest of the app's iOS 26 styling.
 */
export default function OnboardingLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="welcome" />
        <Stack.Screen
          name="login"
          options={{ animation: "slide_from_right" }}
        />
      </Stack>
      <GlassAlertHost />
    </>
  );
}
