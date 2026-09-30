import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import {
  BackHandler,
  Keyboard,
  StyleSheet,
  View,
  useWindowDimensions,
  type ScrollViewProps,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  type GestureType,
} from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { AdaptiveGlassView } from "../../../../ui/GlassView";
import { EASE_OUT, SNAP } from "../../constants/motion";
import { Radius } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";

const NativeGestureContext = createContext<GestureType | null>(null);
const ScrollYContext = createContext<SharedValue<number> | null>(null);
const ScrollLockContext = createContext<SharedValue<boolean> | null>(null);

/**
 * A ScrollView that cooperates with the Sheet, iOS-style:
 * - downward drags scroll it back to its top, then hand the gesture to
 *   the sheet;
 * - upward drags scroll it, unless the sheet isn't fully open yet — then
 *   the sheet expands and the content is locked in place.
 */
export function SheetScrollView({
  children,
  ...rest
}: ScrollViewProps & { children: ReactNode }) {
  const native = useContext(NativeGestureContext);
  const scrollY = useContext(ScrollYContext);
  const scrollLock = useContext(ScrollLockContext);
  const trackScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      // Shared values are designed to be written from worklets; the
      // immutability rule can't see through context.
      // eslint-disable-next-line react-hooks/immutability
      if (scrollY) scrollY.value = e.contentOffset.y;
    },
  });
  // Driven on the UI thread so the content freezes the instant the sheet
  // takes an upward drag — no JS round-trip, no double motion.
  const lockProps = useAnimatedProps(() => ({
    scrollEnabled: scrollLock ? !scrollLock.value : true,
  }));
  const body = (
    <Animated.ScrollView
      onScroll={trackScroll}
      scrollEventThrottle={16}
      overScrollMode="never"
      animatedProps={lockProps}
      {...rest}
    >
      {children}
    </Animated.ScrollView>
  );
  return native ? (
    <GestureDetector gesture={native}>{body}</GestureDetector>
  ) : (
    body
  );
}

type Props = {
  children: ReactNode;
  /** Resting height of the sheet as a fraction of the screen. */
  detent?: number;
};

/**
 * A bottom sheet drawn by us instead of the system formSheet: rounded top
 * corners, and a live native-glass backdrop that crossfades 0 → full with
 * the sheet's opening progress (same engine as the reaction modal).
 *
 * Gesture rules (iOS):
 * - grab anywhere: up expands to full, down settles to the detent,
 *   fling or far-drag dismisses;
 * - the inner scroll view keeps working — a downward drag only takes the
 *   sheet once the content rests at its top; an upward drag takes the
 *   sheet until it is fully open, then the content scrolls;
 * - reversing direction mid-drag re-grabs without a jump; a cancelled
 *   gesture always settles to the nearest detent, never mid-air.
 */
export function Sheet({ children, detent = 0.85 }: Props) {
  const router = useRouter();
  const theme = useTheme();
  const { height: H } = useWindowDimensions();

  const restTy = H * (1 - detent);
  const ty = useSharedValue(H);
  const grabTy = useSharedValue(H);
  const grabY = useSharedValue(0);
  const grabActive = useSharedValue(false);
  const movedByGesture = useSharedValue(false);
  const kb = useSharedValue(0);
  const dismissed = useSharedValue(false);
  const scrollY = useSharedValue(0);
  const scrollLock = useSharedValue(false);
  const native = useMemo(() => Gesture.Native(), []);

  const goBack = () => {
    router.back();
  };

  // Back button / system back. The gesture path sets `dismissed`
  // synchronously on the UI thread first, so a back-press racing a
  // fling-dismiss can't pop two routes.
  const dismiss = () => {
    if (dismissed.value) return;
    dismissed.value = true;
    Keyboard.dismiss();
    ty.value = withTiming(H, { duration: 260 }, (fin) => {
      if (fin) goBack();
    });
  };

  const exitUI = () => {
    "worklet";
    if (dismissed.value) return;
    dismissed.value = true;
    runOnJS(Keyboard.dismiss)();
    ty.value = withTiming(H, { duration: 260 }, (fin) => {
      if (fin) runOnJS(goBack)();
    });
  };

  const pan = Gesture.Pan()
    .activeOffsetY([-12, 12])
    .simultaneousWithExternalGesture(native)
    .onUpdate((e) => {
      if (dismissed.value) return;
      const dy = e.translationY;
      const atTop = scrollY.value <= 1;
      const full = ty.value <= 1;
      const grab = (dy > 0 && atTop) || (dy < 0 && !full);
      if (grab) {
        if (!grabActive.value) {
          // (Re-)grab here so reversing direction mid-drag never jumps.
          grabActive.value = true;
          grabTy.value = ty.value;
          grabY.value = dy;
          if (dy < 0) scrollLock.value = true;
        }
        ty.value = Math.min(
          H,
          Math.max(0, grabTy.value + (dy - grabY.value)),
        );
        movedByGesture.value = true;
      } else {
        grabActive.value = false;
        scrollLock.value = false;
      }
    })
    .onEnd((e) => {
      grabActive.value = false;
      scrollLock.value = false;
      if (dismissed.value || !movedByGesture.value) return;
      movedByGesture.value = false;
      const y = ty.value;
      const vy = e.velocityY;
      if (vy > 800 || y > restTy + H * 0.14) {
        exitUI();
      } else if (vy < -700 || y < restTy / 2) {
        ty.value = withSpring(0, SNAP);
      } else {
        ty.value = withSpring(restTy, SNAP);
      }
    })
    .onFinalize(() => {
      grabActive.value = false;
      scrollLock.value = false;
      if (dismissed.value || !movedByGesture.value) return;
      movedByGesture.value = false;
      ty.value = withSpring(ty.value < restTy / 2 ? 0 : restTy, SNAP);
    });

  // Rise in on mount — a calm ease, no bounce.
  useEffect(() => {
    ty.value = withTiming(restTy, { duration: 340, easing: EASE_OUT });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // System back runs the same exit animation.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      dismiss();
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

  // The native glass can't animate its own blur radius per-frame, so the
  // 0→full blur follows the sheet as a crossfade — exactly like the
  // reaction modal's backdrop. Opacity lives on the wrapper: the glass
  // view itself never sees opacity 0 (that silently disables it).
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ty.value, [H, 0], [0, 1], "clamp"),
  }));

  return (
    <View style={styles.root}>
      <Animated.View
        style={[StyleSheet.absoluteFill, backdropStyle]}
        pointerEvents="none"
      >
        <AdaptiveGlassView
          blurRadius={22}
          tintColor="rgba(255, 255, 255, 0.10)"
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <NativeGestureContext.Provider value={native}>
        <ScrollYContext.Provider value={scrollY}>
          <ScrollLockContext.Provider value={scrollLock}>
            <GestureDetector gesture={pan}>
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
                <View style={styles.grabberZone}>
                  <View
                    style={[styles.grabber, { backgroundColor: theme.grabber }]}
                  />
                </View>
                {children}
              </Animated.View>
            </GestureDetector>
          </ScrollLockContext.Provider>
        </ScrollYContext.Provider>
      </NativeGestureContext.Provider>
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
