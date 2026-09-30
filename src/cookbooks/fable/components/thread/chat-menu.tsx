import { AndroidGlassMenu } from "expo-android-glass-view";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";

import { SFIcon } from "../../../../ui/SFIcon";
import { useFable } from "../../data/store";
import { useTheme } from "../../hooks/use-theme";
import { GlassButton } from "../ui/glass-button";
import { GlassAlert, type GlassAlertAction } from "../ui/glass-alert";

const DESTRUCTIVE_RED = "#FF545B";

type AlertSpec = {
  title: string;
  message?: string;
  actions: GlassAlertAction[];
};

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
  const [alert, setAlert] = useState<AlertSpec | null>(null);
  const wallpaper = useFable((s) => s.wallpapers[threadId]);

  const pickWallpaper = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setAlert({
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

  const onWallpaper = () => {
    if (wallpaper) {
      setAlert({
        title: "Wallpaper",
        message: "Change or remove this chat's wallpaper?",
        actions: [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => useFable.getState().setWallpaper(threadId, null),
          },
          { text: "Change", onPress: () => void pickWallpaper() },
        ],
      });
    } else {
      void pickWallpaper();
    }
  };

  const onClear = () => {
    setAlert({
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
      <GlassAlert
        visible={alert !== null}
        title={alert?.title ?? ""}
        message={alert?.message}
        actions={alert?.actions ?? []}
        onDismiss={() => setAlert(null)}
      />
    </>
  );
}
