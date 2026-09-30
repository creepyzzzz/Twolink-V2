import { AndroidGlassSlider } from "expo-android-glass-view";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Accent, Type } from "../constants/theme";
import { normalizeWallpaper, useFable } from "../data/store";
import { useTheme } from "../hooks/use-theme";

/** Must match the scrim used in Conversation so the preview is WYSIWYG. */
const SCRIM = "rgba(242, 242, 244, 0.55)";
const MAX_BLUR_RADIUS = 25;

function SliderRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.sliderBlock}>
      <View style={styles.sliderHeader}>
        <Text style={[Type.body, { color: theme.label }]}>{label}</Text>
        <Text style={[Type.body, { color: theme.secondary }]}>
          {Math.round(value * 100)}%
        </Text>
      </View>
      <AndroidGlassSlider
        value={value}
        minimumValue={0}
        maximumValue={1}
        onValueChange={onChange}
        accentColor={Accent}
      />
    </View>
  );
}

/**
 * Wallpaper editor, opened right after picking an image from the ••• menu.
 * Live preview with the same opacity/blur/scrim the conversation renders,
 * tuned with the settings-style glass sliders.
 */
export default function WallpaperEditor() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pending = useFable((s) => s.pendingWallpaper);
  const existingRaw = useFable((s) =>
    pending ? s.wallpapers[pending.threadId] : undefined,
  );
  const existing = normalizeWallpaper(existingRaw);

  const [opacity, setOpacity] = useState(() => existing?.opacity ?? 1);
  const [blur, setBlur] = useState(() => existing?.blur ?? 0);

  useEffect(() => {
    if (!pending) router.back();
  }, [pending]);

  if (!pending) return null;

  const done = () => {
    useFable
      .getState()
      .setWallpaper(pending.threadId, {
        uri: pending.uri,
        opacity,
        blur,
      });
    useFable.getState().setPendingWallpaper(null);
    router.back();
  };
  const cancel = () => {
    useFable.getState().setPendingWallpaper(null);
    router.back();
  };

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.bg, paddingTop: insets.top },
      ]}
    >
      {/* Nav */}
      <View style={styles.nav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel wallpaper editing"
          onPress={cancel}
          hitSlop={12}
        >
          <Text style={[Type.body, { color: theme.label }]}>Cancel</Text>
        </Pressable>
        <Text style={[Type.navTitle, { color: theme.label }]}>Wallpaper</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Set wallpaper"
          onPress={done}
          hitSlop={12}
        >
          <Text
            style={[Type.body, { color: Accent, fontFamily: "SFProText-Semibold" }]}
          >
            Set
          </Text>
        </Pressable>
      </View>

      {/* Live preview */}
      <View style={styles.previewWrap}>
        <View style={styles.preview}>
          <Image
            source={{ uri: pending.uri }}
            resizeMode="cover"
            blurRadius={blur * MAX_BLUR_RADIUS}
            style={[StyleSheet.absoluteFill, { opacity }]}
          />
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]}
          />
          <View style={styles.sampleBubbles} pointerEvents="none">
            <View
              style={[
                styles.sample,
                styles.sampleIn,
                { backgroundColor: "#FFFFFF" },
              ]}
            >
              <Text style={[Type.body, { color: theme.label }]}>
                This is how it will look
              </Text>
            </View>
            <View
              style={[
                styles.sample,
                styles.sampleOut,
                { backgroundColor: theme.outgoing },
              ]}
            >
              <Text style={[Type.body, { color: theme.outgoingText }]}>
                Tune it below
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Controls */}
      <View
        style={[
          styles.controls,
          { paddingBottom: Math.max(insets.bottom, 20) },
        ]}
      >
        <SliderRow label="Opacity" value={opacity} onChange={setOpacity} />
        <SliderRow label="Blur" value={blur} onChange={setBlur} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  previewWrap: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  preview: {
    flex: 1,
    borderRadius: 28,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  sampleBubbles: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 10,
  },
  sample: {
    maxWidth: "75%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderCurve: "continuous",
  },
  sampleIn: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 6,
  },
  sampleOut: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 6,
  },
  controls: {
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 4,
  },
  sliderBlock: {
    paddingVertical: 8,
  },
  sliderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
});
