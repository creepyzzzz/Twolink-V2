import { Image, type ImageProps } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { memo, useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SNAP } from "../../constants/motion";
import { GlassButton } from "../ui/glass-button";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

type Props = {
  source: ImageProps["source"];
  onClose: () => void;
};

/**
 * Fullscreen photo viewer in the iOS Photos language: black room, the photo
 * floating in it, pinch or double-tap to zoom, swipe down (or tap X) to
 * leave. Transient like the reaction bar — no chrome survives it.
 */
export const PhotoViewer = memo(function PhotoViewer({
  source,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(MIN_SCALE);
  const baseScale = useSharedValue(MIN_SCALE);
  const dismissY = useSharedValue(0);

  // The native glass X must mount after the viewer's fade-in completes: the
  // AGSL effect initializes against whatever is behind it, and mounting
  // mid-fade leaves it flat until the next redraw (e.g. a press).
  const [closeReady, setCloseReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setCloseReady(true), 240);
    return () => clearTimeout(t);
  }, []);

  const onCloseRef = { current: onClose };
  onCloseRef.current = onClose;

  const reset = () => {
    "worklet";
    baseScale.value = MIN_SCALE;
    scale.value = withSpring(MIN_SCALE, SNAP);
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(
        Math.max(baseScale.value * e.scale, MIN_SCALE),
        MAX_SCALE,
      );
    })
    .onEnd(() => {
      baseScale.value = scale.value;
      if (scale.value < 1.08) reset();
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.08) reset();
      else {
        baseScale.value = DOUBLE_TAP_SCALE;
        scale.value = withSpring(DOUBLE_TAP_SCALE, SNAP);
      }
    });

  const dismiss = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .activeOffsetY(18)
    .failOffsetX([-24, 24])
    .onUpdate((e) => {
      if (scale.value > 1.08) return; // zoomed: the photo owns the gesture
      if (e.translationY > 0) dismissY.value = e.translationY;
    })
    .onEnd((e) => {
      if (scale.value <= 1.08 && e.translationY > 110)
        runOnJS(onCloseRef.current)();
      else dismissY.value = withSpring(0, SNAP);
    });

  const photoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dismissY.value }, { scale: scale.value }],
  }));
  const bgStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(dismissY.value / 320, 0.85),
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={[StyleSheet.absoluteFill, styles.root]}
    >
      <StatusBar style="light" />
      <Animated.View style={[StyleSheet.absoluteFill, styles.bg, bgStyle]} />
      <GestureDetector gesture={Gesture.Simultaneous(pinch, doubleTap, dismiss)}>
        <Animated.View style={[styles.stage, photoStyle]}>
          <Image
            source={source}
            contentFit="contain"
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </GestureDetector>
      {closeReady && (
        <Animated.View
          entering={FadeIn.duration(180)}
          style={[styles.close, { top: insets.top + 12 }]}
        >
          <GlassButton
            symbol="xmark"
            iconSize={15}
            size={40}
            tint="#FFFFFF"
            accessibilityLabel="Close"
            onPress={onClose}
          />
        </Animated.View>
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  root: {
    zIndex: 60,
  },
  bg: {
    backgroundColor: "#000000",
  },
  stage: {
    flex: 1,
  },
  close: {
    position: "absolute",
    right: 18,
  },
});
