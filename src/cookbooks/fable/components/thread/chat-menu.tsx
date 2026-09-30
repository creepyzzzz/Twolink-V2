import { AndroidGlassMenu } from "expo-android-glass-view";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";

import { SFIcon } from "../../../../ui/SFIcon";
import { useFable } from "../../data/store";
import { useTheme } from "../../hooks/use-theme";
import { GlassButton } from "../ui/glass-button";

const DESTRUCTIVE_RED = "#FF545B";

/**
 * The ••• button in a chat header. Opens kagantemizkan's native glass menu
 * (expo-android-glass-view) with Search, Wallpaper, and Clear chat.
 */
export function ChatMenu({
  threadId,
  onSearch,
}: {
  threadId: string;
  onSearch: () => void;
}) {
  const theme = useTheme();
  const anchorRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const showAlert = useFable((s) => s.showAlert);

  const pickWallpaper = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert({
        title: "Photos",
        message: "Allow photo access to choose a chat wallpaper.",
        actions: [{ text: "OK", style: "default" }],
      });
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (res.canceled || res.assets.length === 0) return;
    useFable
      .getState()
      .setPendingWallpaper({ threadId, uri: res.assets[0].uri });
    router.push("/fable/wallpaper");
  };

  // Tapping Wallpaper always means picking a new one — the editor that
  // opens next already offers "Remove wallpaper" when one is set.
  const onWallpaper = () => {
    void pickWallpaper();
  };

  const onClear = () => {
    showAlert({
      title: "Clear chat?",
      message: "All messages in this conversation will be deleted.",
      actions: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => useFable.getState().clearThread(threadId),
        },
      ],
    });
  };

  return (
    <>
      <View ref={anchorRef} collapsable={false}>
        <GlassButton
          symbol="ellipsis"
          iconSize={18}
          accessibilityLabel="More options"
          onPress={() => setOpen(true)}
        />
      </View>
      <AndroidGlassMenu
        visible={open}
        anchorRef={anchorRef}
        placement="below"
        items={[
          {
            id: "search",
            title: "Search",
            icon: (
              <SFIcon
                name="magnifyingglass"
                size={19}
                color={theme.label}
              />
            ),
          },
          {
            id: "wallpaper",
            title: "Wallpaper",
            icon: <SFIcon name="photo" size={19} color={theme.label} />,
          },
          {
            id: "clear",
            title: "Clear chat",
            separator: true,
            destructive: true,
            icon: (
              <SFIcon name="trash" size={19} color={DESTRUCTIVE_RED} />
            ),
          },
        ]}
        onSelect={(id) => {
          if (id === "search") onSearch();
          else if (id === "wallpaper") onWallpaper();
          else if (id === "clear") onClear();
        }}
        onDismiss={() => setOpen(false)}
      />
    </>
  );
}
