import { BlurView } from "expo-blur";
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

import { EASE_OUT, SNAP } from "../../constants/motion";
import { Radius } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";

const BLUR_MAX = 60;
const ABlurView = Animated.createAnimatedComponent(BlurView);

const NativeGestureContext = createContext<GestureType | null>(null);
const ScrollYContext = createContext<SharedValue<number> | null>(null);

/**
 * A ScrollView that cooperates with the Sheet: vertical drags scroll it,
 * but a downward drag while it sits at the top moves the sheet instead,
 * exactly like an iOS sheet.
 */
export function SheetScrollView({
  children,
  ...rest
}: ScrollViewProps & { children: ReactNode }) {
  const native = useContext(NativeGestureContext);
  const scrollY = useContext(ScrollYContext);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      // Shared values are designed to be written from worklets; the
      // immutability rule can't see through context.
      // eslint-disable-next-line react-hooks/immutability
      if (scrollY) scrollY.value = e.contentOffset.y;
    },
  });
  const body = (
    <Animated.ScrollView
      onScroll={onScroll}
      scrollEventThrottle={16}
      overScrollMode="never"
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
 * corners, and a live blur backdrop (0% closed → 60% fully open) tracking
 * the sheet instead of a dark scrim.
 *
 * Drag anywhere on the sheet: up expands to full, down settles to the
 * detent, fling or far-drag dismisses. The inner scroll view keeps working —
 * a downward drag only grabs the sheet once the content is at its top.
 */
export function Sheet({ children, detent = 0.85 }: Props) {
  const router = useRouter();
  const theme = useTheme();
  const { height: H } = useWindowDimensions();

  const restTy = H * (1 - detent);
  const ty = useSharedValue(H);
  const grabTy = useSharedValue(H);
  const grabY = useSharedValue(0);
  const draggingSheet = useSharedValue(false);
  const kb = useSharedValue(0);
  const dismissed = useSharedValue(false);
  const scrollY = useSharedValue(0);
  const native = useMemo(() => Gesture.Native(), []);

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
    .activeOffsetY([-12, 12])
    .simultaneousWithExternalGesture(native)
    .onUpdate((e) => {
      // Downward drags belong to the sheet only while the content is at its
      // top; upward drags always belong to the scroll view.
      if (e.translationY > 0 && scrollY.value <= 1) {
        if (!draggingSheet.value) {
          // Take over mid-gesture without a jump.
          draggingSheet.value = true;
          grabTy.value = ty.value;
          grabY.value = e.translationY;
        }
        ty.value = Math.min(
          H,
          Math.max(0, grabTy.value + (e.translationY - grabY.value)),
        );
      }
    })
    .onEnd((e) => {
      if (dismissed.value || !draggingSheet.value) return;
      draggingSheet.value = false;
      const y = ty.value;
      const vy = e.velocityY;
      if ((vy > 700 && y > restTy + 20) || y > restTy + H * 0.14) {
        runOnJS(dismiss)();
      } else if (vy < -700 || y < restTy / 2) {
        ty.value = withSpring(0, SNAP);
      } else {
        ty.value = withSpring(restTy, SNAP);
      }
    })
    .onFinalize(() => {
      draggingSheet.value = false;
    });

  // Rise in on mount — a calm ease, no bounce.
  useEffect(() => {
    ty.value = withTiming(restTy, { duration: 340, easing: EASE_OUT });
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
      <NativeGestureContext.Provider value={native}>
        <ScrollYContext.Provider value={scrollY}>
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
