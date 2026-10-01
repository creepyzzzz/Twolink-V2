import { router } from "expo-router";
import { Image } from "expo-image";
import {
  AndroidGlassMenu,
  useMinimizeOnScrollHandler,
} from "expo-android-glass-view";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { GroupRow } from "../components/chats/group-row";
import { Glass } from "../components/ui/glass";
import {
  NAV_H,
  STORIES_H,
  StoriesHeader,
  type RailStory,
} from "../components/chats/stories-header";
import { EASE_OUT } from "../constants/motion";
import { Accent } from "../constants/theme";
import { AVATAR_FACES } from "../data/people";
import { unreadCount } from "../data/unread";
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

  const onPressStory = useCallback((item: RailStory) => {
    // Your cell: with no posted stories the + tile goes straight to the
    // library; once you've posted, it opens the viewer like everyone else.
    if (item.isMe && !item.hasStory) {
      void pickAndPostStory();
      return;
    }
    openStory(item.userId);
  }, []);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"All" | "Unread" | "Groups">("All");
  /** Long-press context menu on a row: the same native glass menu as the
      chat ••• button — vertical icon + label rows, same opening animation. */
  const [menuId, setMenuId] = useState<string | null>(null);
  const menuAnchorRef = useRef<View | null>(null);
  const rowViews = useRef(new Map<string, View | null>());
  const deleted = useFable((state) => state.deleted);
  const togglePin = useFable((state) => state.togglePin);
  const toggleMute = useFable((state) => state.toggleMute);
  const toggleRead = useFable((state) => state.toggleRead);
  const muted = useFable((state) => state.muted);
  const deleteThread = useFable((state) => state.deleteThread);
  const showAlert = useFable((state) => state.showAlert);
  const openMenu = useCallback((id: string) => {
    menuAnchorRef.current = rowViews.current.get(id) ?? null;
    setMenuId(id);
  }, []);
  const onDeletePress = useCallback(
    (id: string, name: string) => {
      setMenuId(null);
      showAlert({
        title: `Delete chat with ${name}?`,
        message: "This removes the conversation from your inbox.",
        actions: [
          { text: "Cancel", style: "cancel", onPress: () => {} },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => void deleteThread(id),
          },
        ],
      });
    },
    [deleteThread, showAlert],
  );
  const threads = useFable((state) => state.threads);
  const lastRead = useFable((state) => state.lastRead);
  const chats = useFable((state) => state.chats);
  const chatsLoaded = useFable((state) => state.chatsLoaded);
  const people = useFable((state) => state.people);
  const myId = useFable((state) => state.myId);
  const profile = useFable((state) => state.profile);
  const stories = useFable((state) => state.stories);
  const groupsRecord = useFable((state) => state.groups);

  // Make sure the live chat list is loading (idempotent), and stop showing
  // the spinner if the load stalls — the empty state takes over instead.
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  useEffect(() => {
    const s = useFable.getState();
    if (!s.bootstrapped) void s.bootstrap();
    if (s.chatsLoaded) return;
    const t = setTimeout(() => setLoadTimedOut(true), 15000);
    return () => clearTimeout(t);
  }, []);

  /** Stories rail cells: you first, then one cell per person with a live story. */
  const railStories = useMemo<RailStory[]>(() => {
    const items: RailStory[] = [
      {
        userId: myId ?? "me",
        first: "You",
        isMe: true,
        avatar: AVATAR_FACES[profile.face],
        photoUrl: profile.photoUri ?? null,
        state: "none",
        hasStory:
          myId != null && stories.some((s) => s.userId === myId),
      },
    ];
    const seen = new Set<string>();
    for (const s of stories) {
      if (s.userId === myId || seen.has(s.userId)) continue;
      seen.add(s.userId);
      const person = people[s.userId];
      if (!person) continue;
      items.push({
        userId: s.userId,
        first: person.first,
        isMe: false,
        avatar: person.avatar,
        photoUrl: person.photoUrl ?? null,
        state: s.viewed ? "seen" : "unread",
        hasStory: true,
      });
    }
    return items;
  }, [stories, people, profile, myId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chats.filter((chat) => {
      if (deleted.includes(chat.id)) return false;
      if (filter === "Groups" && chat.type !== "group") return false;
      if (filter === "Unread" && chat.unread === 0) return false;
      if (!q) return true;
      return (
        chat.name.toLowerCase().includes(q) ||
        chat.preview.toLowerCase().includes(q)
      );
    });
  }, [chats, query, filter, deleted]);

  // The long-press menu mirrors the chat ••• menu: vertical icon + label
  // rows on the same native glass surface, with the same opening animation.
  const pinned = useFable((state) => state.pinned);
  const menuPinned = menuId != null && pinned.includes(menuId);
  const menuMuted = menuId != null && !!muted[menuId];
  const menuMarkedRead =
    menuId != null &&
    unreadCount(threads[menuId] ?? [], lastRead[menuId]) === 0;
  const menuItems =
    menuId == null
      ? []
      : [
          {
            id: "pin",
            title: menuPinned ? "Unpin" : "Pin",
            icon: (
              <SFIcon
                name={menuPinned ? "pin.slash" : "pin.fill"}
                size={19}
                color={theme.label}
                rotation={menuPinned ? 0 : 45}
              />
            ),
          },
          {
            id: "mute",
            title: menuMuted ? "Unmute" : "Mute",
            icon: (
              <SFIcon
                name={menuMuted ? "speaker.slash.fill" : "speaker.fill"}
                size={19}
                color={theme.label}
              />
            ),
          },
          {
            id: "read",
            title: menuMarkedRead ? "Mark as unread" : "Mark as read",
            icon: (
              <SFIcon
                name={
                  menuMarkedRead ? "envelope.badge.fill" : "envelope.open.fill"
                }
                size={19}
                color={theme.label}
              />
            ),
          },
          {
            id: "delete",
            title: "Delete",
            separator: true,
            destructive: true,
            icon: <SFIcon name="trash" size={19} color="#FF545B" />,
          },
        ];
  const onMenuSelect = (actionId: string) => {
    if (menuId == null) return;
    if (actionId === "pin") void togglePin(menuId);
    else if (actionId === "mute") void toggleMute(menuId);
    else if (actionId === "read") void toggleRead(menuId);
    else if (actionId === "delete") {
      const chat = chats.find((c) => c.id === menuId);
      onDeletePress(menuId, chat?.name ?? "this chat");
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <Animated.ScrollView
        ref={listRef}
        onScroll={onScroll}
        onScrollBeginDrag={() => setMenuId(null)}
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
          // Clear the floating tab bar (64pt + offset) so the last row —
          // including the empty-state CTA — can scroll fully into view.
          paddingBottom: insets.bottom + 120,
        }}
      >
        <View style={{ height: STORIES_H }} />
        {/* Search sits at the top of the list flow, just under the title at
            rest — the iOS pattern. It scrolls with the list. The 28pt top
            margin clears the header's 28pt fade tail, so the pill's top edge
            is never washed out by it. */}
        <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
          <Glass
            style={{
              height: 44,
              borderRadius: 22,
              paddingHorizontal: 16,
              flexDirection: "row",
              gap: 10,
              alignItems: "center",
            }}
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
              style={{
                flex: 1,
                height: 44,
                paddingVertical: 0,
                textAlignVertical: "center",
                fontSize: 17,
                fontFamily: "SFProText-Regular",
                color: theme.label,
              }}
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
          </Glass>
        </View>

        {/* Filter tabs */}
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 4,
          }}
        >
          {(["All", "Unread", "Groups"] as const).map((tab) => {
            const selected = tab === filter;
            return (
              <Pressable
                key={tab}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`${tab} conversations`}
                onPress={() => setFilter(tab)}
                style={{ height: 34 }}
              >
                <Glass
                  interactive
                  effect={selected ? "regular" : "clear"}
                  style={{
                    paddingHorizontal: 16,
                    height: 34,
                    borderRadius: 17,
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: selected
                        ? "SFProText-Semibold"
                        : "SFProText-Medium",
                      color: selected ? Accent : theme.secondary,
                    }}
                  >
                    {tab}
                  </Text>
                </Glass>
              </Pressable>
            );
          })}
        </View>
        {filtered.map((chat, i) => (
          <Animated.View
            key={chat.id}
            entering={FadeInDown.delay(Math.min(i, 8) * 34)
              .duration(300)
              .easing(EASE_OUT.factory())}
          >
            <View
              ref={(v) => {
                if (v) rowViews.current.set(chat.id, v);
                else rowViews.current.delete(chat.id);
              }}
              collapsable={false}
            >
              {chat.type === "group" && groupsRecord[chat.id] ? (
                <GroupRow
                  group={groupsRecord[chat.id]}
                  onLongPressRow={openMenu}
                />
              ) : (
                <ChatRow chat={chat} onLongPressRow={openMenu} />
              )}
            </View>
          </Animated.View>
        ))}
        {filtered.length === 0 ? (
          !chatsLoaded && !loadTimedOut ? (
            <View style={styles.loading}>
              <ActivityIndicator size="small" color={theme.tertiary} />
            </View>
          ) : query.trim() ? (
            <Text style={[styles.empty, { color: theme.secondary }]}>
              {`No chats match “${query.trim()}”.`}
            </Text>
          ) : filter === "Unread" ? (
            <Text style={[styles.empty, { color: theme.secondary }]}>
              You’re all caught up.
            </Text>
          ) : filter === "Groups" ? (
            <Text style={[styles.empty, { color: theme.secondary }]}>
              No groups yet. Create one from the compose button.
            </Text>
          ) : (
            <View style={styles.emptyWrap}>
              <Image
                source={require("../../../../assets/cookbooks/fable/empty-whale.png")}
                style={styles.emptyWhale}
                contentFit="contain"
              />
              <Text style={[styles.emptyTitle, { color: theme.label }]}>
                No chats yet
              </Text>
              <Text style={[styles.emptySub, { color: theme.secondary }]}>
                Start a conversation — your chats will show up here.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Start a chat"
                onPress={() => router.push("/fable/compose")}
                style={({ pressed }) => [
                  styles.emptyCta,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.emptyCtaText}>Start a chat</Text>
              </Pressable>
            </View>
          )
        ) : null}
      </Animated.ScrollView>

      <StoriesHeader
        progress={progress}
        stretch={stretch}
        stories={railStories}
        width={width}
        insetTop={insets.top}
        isOpen={isOpen}
        onPressCluster={openStories}
        onPressStory={onPressStory}
        onPressCompose={() => router.push("/fable/compose")}
        onPressMe={() => router.push("/me")}
      />

      <AndroidGlassMenu
        visible={menuId != null}
        anchorRef={menuAnchorRef}
        placement="below"
        items={menuItems}
        onSelect={onMenuSelect}
        onDismiss={() => setMenuId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  empty: {
    textAlign: "center",
    fontSize: 15,
    marginTop: 32,
    paddingHorizontal: 40,
  },
  loading: {
    alignItems: "center",
    marginTop: 48,
  },
  emptyWrap: {
    alignItems: "center",
    marginTop: 40,
    paddingHorizontal: 48,
  },
  emptyWhale: {
    width: 140,
    aspectRatio: 771 / 642,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "SFProText-Semibold",
    marginTop: 20,
  },
  emptySub: {
    fontSize: 15,
    fontFamily: "SFProText-Regular",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 21,
  },
  emptyCta: {
    marginTop: 20,
    height: 48,
    paddingHorizontal: 28,
    borderRadius: 24,
    backgroundColor: Accent,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCtaText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "SFProText-Semibold",
  },
});
