import { AndroidGlassSlider } from "expo-android-glass-view";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
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

/** Must match the scrim logic in Conversation so the preview is WYSIWYG. */
const MAX_BLUR_RADIUS = 25;
/**
 * Readability veil that gets out of the way: full-strength at 0% opacity,
 * completely gone at 100% so the photo shows untouched.
 */
const scrimFor = (opacity: number) =>
  `rgba(242, 242, 244, ${(0.5 * (1 - opacity)).toFixed(3)})`;

/** Re-blurring a full photo every slider tick stutters on Android. */
const BLUR_SETTLE_MS = 90;

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
  // Capture the editing session once at mount. Clearing pendingWallpaper on
  // done/cancel/remove must not re-trigger navigation or blank the screen —
  // that double router.back() is what used to drop back to the chat list.
  const [session] = useState(() => pending);
  const existingRaw = useFable((s) =>
    session ? s.wallpapers[session.threadId] : undefined,
  );
  const existing = normalizeWallpaper(existingRaw);

  const [opacity, setOpacity] = useState(() => existing?.opacity ?? 1);
  // The % label follows the drag live; the image re-blurs 90ms after the
  // thumb settles so a fast drag doesn't hammer the native blur pass.
  const [blur, setBlur] = useState(() => existing?.blur ?? 0);
  const [appliedBlur, setAppliedBlur] = useState(() => existing?.blur ?? 0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!session) router.back();
  }, [session]);

  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    [],
  );

  if (!session) return null;

  const onBlurChange = (v: number) => {
    setBlur(v);
    if (blurTimer.current) clearTimeout(blurTimer.current);
    blurTimer.current = setTimeout(() => setAppliedBlur(v), BLUR_SETTLE_MS);
  };

  const finish = (wallpaper: { uri: string; opacity: number; blur: number } | null) => {
    useFable.getState().setWallpaper(session.threadId, wallpaper);
    useFable.getState().setPendingWallpaper(null);
    router.back();
  };
  const done = () =>
    finish({ uri: session.uri, opacity, blur });
  const remove = () => finish(null);
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
            source={{ uri: session.uri }}
            resizeMode="cover"
            blurRadius={appliedBlur * MAX_BLUR_RADIUS}
            style={[StyleSheet.absoluteFill, { opacity }]}
          />
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: scrimFor(opacity) }]}
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
        <SliderRow label="Blur" value={blur} onChange={onBlurChange} />
        {existing ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove wallpaper"
            onPress={remove}
            hitSlop={12}
            style={styles.removeRow}
          >
            <Text
              style={[
                Type.body,
                { color: "#FF3B30", fontFamily: "SFProText-Semibold" },
              ]}
            >
              Remove wallpaper
            </Text>
          </Pressable>
        ) : null}
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
  removeRow: {
    alignItems: "center",
    paddingVertical: 12,
  },
});
