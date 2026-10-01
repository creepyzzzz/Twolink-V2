import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassButton } from "../components/ui/glass-button";
import { useFable } from "../data/store";
import { NotFound, LoadingRoute } from "../../NotFound";

export default function Photo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const person = useFable((state) => state.people[id]);
  const stories = useFable((state) => state.stories);
  const bootstrapped = useFable((state) => state.bootstrapped);
  useEffect(() => {
    if (!bootstrapped) void useFable.getState().bootstrap();
  }, [bootstrapped]);
  const story = stories.find((s) => s.userId === id);
  if (!person || !story) {
    if (!bootstrapped) return <LoadingRoute />;
    return <NotFound home="/fable" />;
  }
  return (
    <View style={{ flex: 1, backgroundColor: "#101012" }}>
      <StatusBar style="light" />
      <Image source={{ uri: story.mediaUrl }} contentFit="contain" style={{ flex: 1 }} />
      <View style={{ position: "absolute", right: 20, top: insets.top + 12 }}>
        <GlassButton
          symbol="xmark"
          tint="#FFFFFF"
          accessibilityLabel="Close photo"
          onPress={() => router.back()}
        />
      </View>
    </View>
  );
}
