import { Asset } from "expo-asset";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { preloadOrbImages } from "../cookbooks/fable/components/ui/orb-images";
import { StoryHost } from "../cookbooks/fable/components/stories/story-viewer";
import { LockScreen } from "../cookbooks/fable/components/lock/lock-screen";
import { useFable } from "../cookbooks/fable/data/store";
import { ME, FABLE_TEAM, PEOPLE } from "../cookbooks/fable/data/people";

void SplashScreen.preventAutoHideAsync();

export const unstable_settings = { initialRouteName: "index" };

/**
 * App lock gate. Renders the PIN screen over everything while locked and
 * re-locks whenever the app leaves the foreground.
 */
function AppLockGate() {
  const appPin = useFable((s) => s.appPin);
  const appUnlocked = useFable((s) => s.appUnlocked);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" && useFable.getState().appPin != null) {
        useFable.getState().setAppUnlocked(false);
      }
    });
    return () => sub.remove();
  }, []);
  if (appPin == null || appUnlocked) return null;
  return <LockScreen />;
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  // Wait for the persisted store (and the app-lock PIN) before revealing
  // the app, so a locked app never flashes its content on launch.
  const [hydrated, setHydrated] = useState(() =>
    useFable.persist.hasHydrated(),
  );
  useEffect(() => {
    if (hydrated) return;
    return useFable.persist.onFinishHydration(() => setHydrated(true));
  }, [hydrated]);
  // SF Pro (testing only — not licensed for distribution). Each weight is
  // its own family; text styles reference the weight directly via fontFamily.
  const [fontsLoaded] = useFonts({
    "SFProText-Regular": require("../../assets/fonts/SF-Pro-Text-Regular.otf"),
    "SFProText-Medium": require("../../assets/fonts/SF-Pro-Text-Medium.otf"),
    "SFProText-Semibold": require("../../assets/fonts/SF-Pro-Text-Semibold.otf"),
    "SFProText-Bold": require("../../assets/fonts/SF-Pro-Text-Bold.otf"),
  });
  useEffect(() => {
    let mounted = true;
    const people = [ME, FABLE_TEAM, ...PEOPLE];
    Promise.allSettled([
      preloadOrbImages(people.map((person) => person.avatar)),
      Asset.loadAsync([...people.map((person) => person.story)]),
    ]).then(() => {
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (ready && fontsLoaded && hydrated) void SplashScreen.hideAsync();
  }, [ready, fontsLoaded, hydrated]);
  if (!ready || !fontsLoaded || !hydrated) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <KeyboardProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="fable" />
            {/* My Profile: a transparent modal at root level so it presents
                over any stack (chat list, conversation, …) with the chat
                visible behind the blur. */}
            <Stack.Screen
              name="me"
              options={{
                presentation: "transparentModal",
                animation: "none",
                contentStyle: { backgroundColor: "transparent" },
              }}
            />
          </Stack>
          {/* Story viewer: mounted once, above the navigator, so it sits on
              top of every flow (tabs and fable stack alike). */}
          <StoryHost />
          <AppLockGate />
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
