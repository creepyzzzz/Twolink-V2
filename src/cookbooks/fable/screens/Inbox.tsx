import { router } from "expo-router";
import { useMinimizeOnScrollHandler } from "expo-android-glass-view";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  FadeInDown,
  runOnJS,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedProps,
  useAnimatedScrollHandler,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChatRow } from "../components/chats/chat-row";
import {
  NAV_H,
  STORIES_H,
  StoriesHeader,
} from "../components/chats/stories-header";
import { EASE_OUT } from "../constants/motion";
import { Space } from "../constants/theme";
import { CHATS } from "../data/chats";
import { PEOPLE_BY_ID, STORIES, type Person } from "../data/people";
import { openStory, pickAndPostStory } from "../data/story-state";
import { useFable } from "../data/store";
import { useTheme } from "../hooks/use-theme";
import { SFIcon } from "../../../ui/SFIcon";

/** A drag that begins this far below the closed title locks the rail zone out. */
const LOCK_BELOW = STORIES_H + 40;

/**
 * The stories rail is the first 104pt of the list's content, hidden under the
 * title when the list rests at 104. Pulling from there draws the orbs out of
 * the title and a release snaps to whichever end is nearer.
 *
 * A drag that starts anywhere further down first locks that zone away with a
 * negative top inset, so a fling can only ever land on the closed title (with
 * the scroll view's own bounce). The lock lifts once the list comes to rest at
 * the title again. The inset only changes at those quiet moments, never while
 * a snap or a bounce is in flight.
 */
export default function ChatsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const listRef = useAnimatedRef<Animated.ScrollView>();
  const [isOpen, setIsOpen] = useState(false);
  const positioned = useRef(false);

  const y = useSharedValue(STORIES_H);
  const lockedSV = useSharedValue(false);
  const dragStart = useSharedValue(STORIES_H);
  const settling = useSharedValue(false); // a snap we issued is in flight
  // Shrinks the tab bar to its compact pill while the chat list scrolls.
  const minimizeOnScroll = useMinimizeOnScrollHandler();

  // While locked, the only way into the rail zone is the scroll view's bounce
  // after a fling to the top; show it as a hint, not a half-open rail.
  const progress = useDerivedValue(() => {
    const p = 1 - Math.min(1, Math.max(0, y.get() / STORIES_H));
    return lockedSV.get() ? p * 0.25 : p;
  });
  const stretch = useDerivedValue(() => Math.max(0, -y.get()));

  // JS state exactly once per crossing of the midpoint.
  useAnimatedReaction(
    () => progress.get() > 0.5,
    (open, prev) => {
      if (prev !== null && open !== prev) {
        runOnJS(setIsOpen)(open);
      }
    },
  );

  // The lock is a UI-thread prop: flipping it never re-renders the screen mid-scroll.
  const lock = (on: boolean) => {
    "worklet";
    if (lockedSV.get() === on) return;
    lockedSV.set(on);
  };
  const lockProps = useAnimatedProps(() => ({
    contentInset: {
      top: lockedSV.get() ? -STORIES_H : 0,
      left: 0,
      bottom: 0,
      right: 0,
    },
  }));

  const snap = (yy: number, pulledDown: boolean) => {
    "worklet";
    const target = pulledDown
      ? yy < STORIES_H * 0.8
        ? 0
        : STORIES_H
      : yy > STORIES_H * 0.2
        ? STORIES_H
        : 0;
    settling.set(true);
    scrollTo(listRef, 0, target, true);
  };

  const onScroll = useAnimatedScrollHandler({
    onBeginDrag: (e) => {
      dragStart.set(e.contentOffset.y);
      settling.set(false);
    },
    onScroll: (e) => {
      const yy = e.contentOffset.y;
      y.set(yy);
      // Lock as soon as the list is well below the title, long before any fling back up.
      if (yy > LOCK_BELOW) lock(true);
      // Feed the tab-bar minimize handler a rail-relative offset: the list
      // rests at STORIES_H (rail tucked under the title), so resting counts
      // as "top" and the bar stays expanded there.
      const minimize = minimizeOnScroll;
      if (minimize) {
        const adjY = Math.max(0, yy - STORIES_H);
        runOnJS(minimize)({
          nativeEvent: {
            contentOffset: { x: 0, y: adjY },
            // The handler only clamps y into [0, contentH - layoutH]; pin the
            // range open so the adjusted offset passes through untouched.
            contentSize: { width: 0, height: Number.MAX_SAFE_INTEGER },
            layoutMeasurement: { width: 0, height: 0 },
          },
        } as never);
      }
    },
    onEndDrag: (e) => {
      const yy = e.contentOffset.y;
      if (lockedSV.get()) {
        if (yy <= STORIES_H + 1 && Math.abs(e.velocity?.y ?? 0) < 0.01)
          lock(false);
        return;
      }
      if (yy <= 0 || yy >= STORIES_H) return;
      snap(yy, yy < dragStart.get());
    },
    onMomentumEnd: (e) => {
      const yy = e.contentOffset.y;
      if (settling.get()) {
        settling.set(false);
        return;
      }
      if (lockedSV.get()) {
        if (yy <= STORIES_H + 1) lock(false);
        return;
      }
      if (yy > 0 && yy < STORIES_H) snap(yy, yy < dragStart.get());
    },
  });

  const openStories = useCallback(() => {
    lockedSV.set(false);
    requestAnimationFrame(() =>
      listRef.current?.scrollTo({ x: 0, y: 0, animated: true }),
    );
  }, [listRef, lockedSV]);

  const onPressStory = useCallback(
    (person: Person) => {
      // Your cell: with no posted stories the + tile goes straight to the
      // library; once you've posted, it opens the viewer like everyone else.
      if (
        person.id === "me" &&
        useFable.getState().myStories.length === 0
      ) {
        pickAndPostStory();
        return;
      }
      openStory(person);
    },
    [],
  );

  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CHATS;
    return CHATS.filter((chat) => {
      const person = PEOPLE_BY_ID[chat.personId];
      const name = person ? person.name.toLowerCase() : "";
      return (
        name.includes(q) || chat.preview.toLowerCase().includes(q)
      );
    });
  }, [query]);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <Animated.ScrollView
        ref={listRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        animatedProps={lockProps}
        contentInsetAdjustmentBehavior="never"
        scrollIndicatorInsets={{ top: insets.top + NAV_H }}
        onContentSizeChange={(_, h) => {
          // Start closed. The contentOffset prop is clamped before content exists, so do it here, once.
          if (!positioned.current && h > 0) {
            positioned.current = true;
            listRef.current?.scrollTo({ x: 0, y: STORIES_H, animated: false });
          }
        }}
        contentContainerStyle={{
          paddingTop: insets.top + NAV_H,
          paddingBottom: insets.bottom + Space[6],
        }}
      >
        <View style={{ height: STORIES_H }} />
        {/* Search sits at the top of the list flow, just under the title at
            rest — the iOS pattern. It scrolls with the list. */}
        <View style={styles.searchWrap}>
          <View
            style={[styles.searchBox, { backgroundColor: theme.surface }]}
          >
            <SFIcon name="magnifyingglass" size={17} color={theme.secondary} />
            <TextInput
              accessibilityLabel="Search chats"
              placeholder="Search"
              placeholderTextColor={theme.secondary}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              returnKeyType="search"
              style={[styles.searchInput, { color: theme.label }]}
            />
            {query.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setQuery("")}
                hitSlop={8}
              >
                <SFIcon
                  name="xmark.circle.fill"
                  size={17}
                  color={theme.secondary}
                />
              </Pressable>
            ) : null}
          </View>
        </View>
        {filtered.map((chat, i) => (
          <Animated.View
            key={chat.id}
            entering={FadeInDown.delay(Math.min(i, 8) * 34)
              .duration(300)
              .easing(EASE_OUT.factory())}
          >
            <ChatRow chat={chat} />
          </Animated.View>
        ))}
        {filtered.length === 0 ? (
          <Text style={[styles.empty, { color: theme.secondary }]}>
            No chats match “{query.trim()}”.
          </Text>
        ) : null}
      </Animated.ScrollView>

      <StoriesHeader
        progress={progress}
        stretch={stretch}
        stories={STORIES}
        width={width}
        insetTop={insets.top}
        isOpen={isOpen}
        onPressCluster={openStories}
        onPressStory={onPressStory}
        onPressCompose={() => router.push("/fable/compose")}
        onPressMe={() => router.push("/me")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  searchWrap: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderCurve: "continuous",
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  empty: {
    textAlign: "center",
    fontSize: 15,
    marginTop: 32,
    paddingHorizontal: 40,
  },
});
