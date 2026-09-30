import { useRouter } from "expo-router";
import {
  createContext,
  useContext,
  useEffect,
  useState,
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
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedReaction,
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

const ScrollYContext = createContext<SharedValue<number> | null>(null);
/**
 * The sheet's scroll view is only interactive when the sheet is fully open.
 * This makes the sheet-vs-content arbitration deterministic: while the sheet
 * is moving, the pan owns the gesture alone — no mid-gesture enable/disable
 * races, no cancelled pans snapping the sheet out from under the finger.
 */
const ScrollEnabledContext = createContext<boolean>(true);

/**
 * A ScrollView that cooperates with the Sheet, iOS-style:
 * it only scrolls once the sheet is fully open; otherwise the sheet takes
 * the drag. A downward drag at the content's top always takes the sheet.
 */
export function SheetScrollView({
  children,
  ...rest
}: ScrollViewProps & { children: ReactNode }) {
  const scrollY = useContext(ScrollYContext);
  const scrollEnabled = useContext(ScrollEnabledContext);
  const trackScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      // Shared values are designed to be written from worklets; the
      // immutability rule can't see through context.
      // eslint-disable-next-line react-hooks/immutability
      if (scrollY) scrollY.value = e.contentOffset.y;
    },
  });
  return (
    <Animated.ScrollView
      onScroll={trackScroll}
      scrollEventThrottle={16}
      overScrollMode="never"
      scrollEnabled={scrollEnabled}
      {...rest}
    >
      {children}
    </Animated.ScrollView>
  );
}

type Props = {
  children: ReactNode;
  /** Resting height of the sheet as a fraction of the screen. */
  detent?: number;
};

/**
 * A bottom sheet drawn by us instead of the system formSheet: rounded top
 * corners and a liquid-glass card, so the chat stays visible through it
 * instead of hiding behind a solid container.
 *
 * Gesture rules (iOS):
 * - grab anywhere: the sheet follows the finger 1:1 and stays where it is
 *   while held; on release it settles to the nearest detent, a fling or a
 *   far drag dismisses;
 * - upward drags expand the sheet (content locked until fully open), then
 *   the content scrolls;
 * - downward drags at the content's top move the sheet; otherwise the
 *   content scrolls;
 * - direction reversals mid-drag never jump — the sheet is driven by
 *   incremental deltas, not an absolute grab point.
 */
export function Sheet({ children, detent = 0.85 }: Props) {
  const router = useRouter();
  const theme = useTheme();
  const { height: H } = useWindowDimensions();

  const restTy = H * (1 - detent);
  const ty = useSharedValue(H);
  const lastDy = useSharedValue(0);
  const movedByGesture = useSharedValue(false);
  const kb = useSharedValue(0);
  const dismissed = useSharedValue(false);
  const scrollY = useSharedValue(0);
  const [isFull, setIsFull] = useState(false);

  // The scroll view wakes up exactly when the sheet reaches full height.
  useAnimatedReaction(
    () => ty.value <= 2,
    (full, prev) => {
      if (prev !== null && full !== prev) runOnJS(setIsFull)(full);
    },
  );

  const goBack = () => {
    router.back();
  };

  // JS thread only. `Keyboard` (a native module object) must never be
  // captured by a worklet — worklets cannot copy it to the UI runtime.
  const startExit = () => {
    Keyboard.dismiss();
    ty.value = withTiming(H, { duration: 260 }, (fin) => {
      if (fin) runOnJS(goBack)();
    });
  };

  // Back button / system back. The gesture path sets `dismissed`
  // synchronously on the UI thread before hopping here, so a back-press
  // racing a fling-dismiss can't pop two routes.
  const dismiss = () => {
    if (dismissed.value) return;
    dismissed.value = true;
    startExit();
  };

  const pan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onStart((e) => {
      // Anchor deltas to activation so the sheet never jumps on grab.
      lastDy.value = e.translationY;
    })
    .onUpdate((e) => {
      if (dismissed.value) return;
      const dy = e.translationY;
      const delta = dy - lastDy.value;
      lastDy.value = dy;
      if (delta === 0) return;
      const atTop = scrollY.value <= 1;
      const full = ty.value <= 1;
      // Own the drag only when the sheet should move; otherwise the scroll
      // view (enabled exactly when full) handles it. Incremental deltas
      // keep reversals mid-drag jump-free.
      const grab = (delta > 0 && atTop) || (delta < 0 && !full);
      if (grab) {
        ty.value = Math.min(H, Math.max(0, ty.value + delta));
        movedByGesture.value = true;
      }
    })
    .onEnd((e) => {
      if (dismissed.value || !movedByGesture.value) return;
      movedByGesture.value = false;
      const y = ty.value;
      const vy = e.velocityY;
      if (vy > 800 || y > restTy + H * 0.14) {
        dismissed.value = true;
        runOnJS(startExit)();
      } else if (vy < -700 || y < restTy / 2) {
        ty.value = withSpring(0, SNAP);
      } else {
        ty.value = withSpring(restTy, SNAP);
      }
    })
    .onFinalize(() => {
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

  return (
    <View style={styles.root}>
      <ScrollYContext.Provider value={scrollY}>
        <ScrollEnabledContext.Provider value={isFull}>
          <GestureDetector gesture={pan}>
            <Animated.View style={[styles.panel, panelStyle]}>
              {/* The card is glass, not a solid container: the chat stays
                  visible through it, blurred — the iOS 26 material. The
                  panel's rounded top clips the glass; its bottom edge is
                  always off-screen. */}
              <AdaptiveGlassView
                blurRadius={40}
                tintColor="rgba(255, 255, 255, 0.6)"
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
        </ScrollEnabledContext.Provider>
      </ScrollYContext.Provider>
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
