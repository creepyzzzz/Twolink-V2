import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import {
  BackHandler,
  Keyboard,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Radius } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";

const BLUR_MAX = 60;
const SPRING = { damping: 34, stiffness: 300 } as const;

const ABlurView = Animated.createAnimatedComponent(BlurView);

type Props = {
  children: React.ReactNode;
  /** Resting height of the sheet as a fraction of the screen. */
  detent?: number;
};

/**
 * A bottom sheet drawn by us instead of the system formSheet, so the sheet
 * itself has rounded top corners and the backdrop is a live blur that tracks
 * the sheet: 0% when closed, ramping to 60% at full expansion.
 *
 * Drag the grabber up to expand, down to settle back, fling or drag far down
 * to dismiss. The sheet also lifts above the keyboard.
 */
export function Sheet({ children, detent = 0.85 }: Props) {
  const router = useRouter();
  const theme = useTheme();
  const { height: H } = useWindowDimensions();

  const restTy = H * (1 - detent);
  const ty = useSharedValue(H);
  const startTy = useSharedValue(H);
  const kb = useSharedValue(0);
  const dismissed = useSharedValue(false);

  const dismiss = () => {
    if (dismissed.value) return;
    dismissed.value = true;
    Keyboard.dismiss();
    ty.value = withTiming(
      H,
      { duration: 260 },
      (done) => done && runOnJS(router.back)(),
    );
  };

  const pan = Gesture.Pan()
    .onBegin(() => {
      startTy.value = ty.value;
    })
    .onUpdate((e) => {
      ty.value = Math.min(H, Math.max(0, startTy.value + e.translationY));
    })
    .onEnd((e) => {
      if (dismissed.value) return;
      const y = ty.value;
      const vy = e.velocityY;
      if ((vy > 700 && y > restTy + 20) || y > restTy + H * 0.14) {
        runOnJS(dismiss)();
      } else if (vy < -700 || y < restTy / 2) {
        ty.value = withSpring(0, SPRING);
      } else {
        ty.value = withSpring(restTy, SPRING);
      }
    });

  // Rise in on mount.
  useEffect(() => {
    ty.value = withSpring(restTy, SPRING);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // System back runs the same exit animation.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      runOnJS(dismiss)();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lift the sheet above the keyboard.
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      kb.value = e.endCoordinates.height;
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      kb.value = 0;
    });
    return () => {
      show.remove();
      hide.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value - kb.value }],
  }));

  const blurProps = useAnimatedProps(() => ({
    intensity: interpolate(ty.value, [H, 0], [0, BLUR_MAX], "clamp"),
  }));

  return (
    <View style={styles.root}>
      <ABlurView
        tint="light"
        intensity={0}
        animatedProps={blurProps}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        style={[
          styles.panel,
          { backgroundColor: theme.surface },
          panelStyle,
        ]}
      >
        <LinearGradient
          pointerEvents="none"
          colors={[theme.surface, theme.panelEnd]}
          locations={[0, 1]}
          style={StyleSheet.absoluteFill}
        />
        <GestureDetector gesture={pan}>
          <View style={styles.grabberZone}>
            <View
              style={[styles.grabber, { backgroundColor: theme.grabber }]}
            />
          </View>
        </GestureDetector>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  panel: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: Radius.panel,
    borderTopRightRadius: Radius.panel,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  grabberZone: {
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
  },
});
