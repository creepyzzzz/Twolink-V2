import { Asset } from "expo-asset";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { preloadOrbImages } from "../cookbooks/fable/components/ui/orb-images";
import { StoryHost } from "../cookbooks/fable/components/stories/story-viewer";
import { ME, FABLE_TEAM, PEOPLE } from "../cookbooks/fable/data/people";
import { portraits, coast } from "../cookbooks/astra/data";

void SplashScreen.preventAutoHideAsync();

export const unstable_settings = { initialRouteName: "index" };

export default function RootLayout() {
  const [ready, setReady] = useState(false);
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
      Asset.loadAsync([
        ...people.map((person) => person.story),
        ...portraits,
        coast,
      ]),
    ]).then(() => {
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (ready && fontsLoaded) void SplashScreen.hideAsync();
  }, [ready, fontsLoaded]);
  if (!ready || !fontsLoaded) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <KeyboardProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="chat" />
            <Stack.Screen name="fable" />
            <Stack.Screen name="astra" />
          </Stack>
          {/* Story viewer: mounted once, above the navigator, so it sits on
              top of every flow (tabs and fable stack alike). */}
          <StoryHost />
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
