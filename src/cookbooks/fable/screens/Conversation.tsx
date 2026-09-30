import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { KeyboardChatScrollView } from "react-native-keyboard-controller";
import Animated, { useAnimatedRef } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Bubble } from "../components/thread/bubble";
import { Composer, type ReplyPreview } from "../components/thread/composer";
import { PhotoViewer } from "../components/thread/photo-viewer";
import {
  ReactionOverlay,
  type ReactionTarget,
} from "../components/thread/reaction-picker";
import { SearchBar } from "../components/thread/search-bar";
import { THREAD_NAV_H, ThreadHeader } from "../components/thread/thread-header";
import { GroupHeader } from "../components/thread/group-header";
import { TypingBubble } from "../components/thread/typing";
import { Glass } from "../components/ui/glass";
import { Sheet, SheetScrollView } from "../components/ui/sheet";
import { Avatar } from "../components/ui/avatar";
import { SFIcon } from "../../../ui/SFIcon";
import { Radius, Space, Type } from "../constants/theme";
import { REPLIES, messagesFor, olderMessagesFor, type Message } from "../data/messages";
import { firstUnreadId } from "../data/unread";
import { PEOPLE, PEOPLE_BY_ID, type Person } from "../data/people";
import { useTheme } from "../hooks/use-theme";

import { useFable, getGroup, normalizeWallpaper } from "../data/store";
import { NotFound } from "../../NotFound";

export default function ConversationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groups = useFable((state) => state.groups);
  return PEOPLE_BY_ID[id] || getGroup(groups, id) ? (
    <ThreadScreen key={id} id={id} />
  ) : (
    <NotFound home="/fable" />
  );
}

function ThreadScreen({ id }: { id: string }) {
  const person = PEOPLE_BY_ID[id];
  const groups = useFable((state) => state.groups);
  const group = getGroup(groups, id);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const stored = useFable((state) => state.threads[id]);
  const wallpaperRaw = useFable((state) => state.wallpapers[id]);
  const wallpaper = normalizeWallpaper(wallpaperRaw);
  const initial = useMemo(
    () => (person ? messagesFor(person.id, person.first) : []),
    [person],
  );
  const messages = stored ?? initial;
  // Capture the first unread message before markRead clears it, so opening
  // a thread with unread messages lands there instead of at the bottom.
  const [jumpToUnreadId] = useState(() => {
    const s = useFable.getState();
    const msgs =
      s.threads[id] ?? (person ? messagesFor(person.id, person.first) : []);
    return firstUnreadId(msgs, s.lastRead[id]);
  });
  useEffect(() => {
    const s = useFable.getState();
    s.setOpenThread(id);
    s.markRead(id);
    return () => {
      if (useFable.getState().openThreadId === id)
        useFable.getState().setOpenThread(null);
    };
  }, [id]);
  const [typing, setTyping] = useState(false);
  /** Group threads: which member is "typing" / replying. */
  const [typingPerson, setTypingPerson] = useState<Person | null>(null);
  const [mountedCount] = useState(messages.length);
  // Long-press reaction target: { message, bubble window rect }.
  const [reaction, setReaction] = useState<{
    message: Message;
    target: ReactionTarget;
  } | null>(null);
  // Forwarding: the message being sent to another thread (person picker).
  const [forwarding, setForwarding] = useState<Message | null>(null);
  // Swipe-to-reply target: arms the composer's reply strip.
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  // In-conversation search.
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [matchIdx, setMatchIdx] = useState(0);
  // Fullscreen photo viewer source.
  const [viewerSource, setViewerSource] = useState<
    { uri: string } | number | null
  >(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const positioned = useRef(false);
  const initialFrame = useRef<number | null>(null);
  const listRef = useAnimatedRef<Animated.ScrollView>();
  const [composerHeight, setComposerHeight] = useState(0);
  // Row top offsets (content coordinates) for scrolling to search matches.
  const rowTops = useRef(new Map<string, number>());
  // Scroll-up pagination: how many older-history pages are already in.
  const historyPage = useFable((state) => state.historyPage[id] ?? 0);
  // Groups have no paginated mock history — the thread starts at creation.
  const hasEarlier = person
    ? olderMessagesFor(id, person.first, historyPage).length > 0
    : false;
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  // Geometry bookkeeping so prepending history doesn't move the viewport.
  const contentHeight = useRef(0);
  const scrollY = useRef(0);
  const prependAdjust = useRef<number | null>(null);

  // Include the floating composer in content geometry before the initial scroll.
  // Keyboard Controller supplies only the moving keyboard inset.
  const positionInitially = useCallback(() => {
    if (positioned.current || composerHeight === 0) return;
    positioned.current = true;
    initialFrame.current = requestAnimationFrame(() => {
      // Unread thread: land on the first unread message, parked under the
      // header like in-conversation search hits. Otherwise go to the bottom.
      const top =
        jumpToUnreadId != null
          ? rowTops.current.get(jumpToUnreadId)
          : undefined;
      if (top != null)
        listRef.current?.scrollTo({
          y: Math.max(0, top - 120),
          animated: false,
        });
      else listRef.current?.scrollToEnd({ animated: false });
    });
  }, [composerHeight, listRef, jumpToUnreadId]);

  // Prepends the next older-history page, holding the viewport on the message
  // that was at the top so the list doesn't jump.
  const loadEarlierMessages = useCallback(() => {
    if (loadingEarlier) return;
    setLoadingEarlier(true);
    prependAdjust.current = contentHeight.current;
    const t = setTimeout(() => {
      useFable.getState().loadEarlier(id);
      setLoadingEarlier(false);
    }, 700);
    timers.current.push(t);
  }, [id, loadingEarlier]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      scrollY.current = y;
      if (y <= 48 && !loadingEarlier && hasEarlier) loadEarlierMessages();
    },
    [loadingEarlier, hasEarlier, loadEarlierMessages],
  );

  // One content-size handler: initial bottom positioning, plus the prepend
  // adjustment that keeps the viewport pinned after older messages land.
  const handleContentSizeChange = useCallback(
    (_w: number, h: number) => {
      const prev = contentHeight.current;
      contentHeight.current = h;
      if (prependAdjust.current != null) {
        prependAdjust.current = null;
        const delta = h - prev;
        if (delta > 0) {
          const y = Math.max(0, scrollY.current + delta);
          requestAnimationFrame(() =>
            listRef.current?.scrollTo({ y, animated: false }),
          );
        }
      } else {
        positionInitially();
      }
    },
    [positionInitially, listRef],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);
  useEffect(
    () => () => {
      if (initialFrame.current !== null)
        cancelAnimationFrame(initialFrame.current);
    },
    [],
  );

  const scrollToEnd = useCallback(() => {
    const t = setTimeout(
      () => listRef.current?.scrollToEnd({ animated: true }),
      40,
    );
    timers.current.push(t);
  }, [listRef]);

  const onReact = useCallback(
    (message: Message, target: ReactionTarget) =>
      setReaction({ message, target }),
    [],
  );

  const onPickReaction = useCallback(
    (emoji: string) => {
      if (reaction)
        useFable.getState().toggleReaction(id, reaction.message.id, emoji);
      setReaction(null);
    },
    [id, reaction],
  );

  // Context-menu actions under the reaction bar.
  const onReplyMessage = useCallback(() => {
    if (reaction) setReplyTo(reaction.message);
    setReaction(null);
  }, [reaction]);

  const onForwardMessage = useCallback(() => {
    if (reaction) setForwarding(reaction.message);
    setReaction(null);
  }, [reaction]);

  const onDeleteMessage = useCallback(() => {
    const message = reaction?.message;
    setReaction(null);
    if (!message) return;
    Alert.alert("Delete message?", "This removes it from this conversation.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => useFable.getState().deleteMessage(id, message.id),
      },
    ]);
  }, [id, reaction]);

  const onPickForwardTarget = useCallback(
    (personId: string) => {
      const message = forwarding;
      setForwarding(null);
      if (!message || personId === id) return;
      useFable
        .getState()
        .append(personId, message.text, "me", message.photo, {
          photoUri: message.photoUri,
        });
    },
    [forwarding, id],
  );

  const onSend = useCallback(
    (text: string) => {
      const quote = replyTo
        ? {
            id: replyTo.id,
            from: replyTo.from,
            text: replyTo.text,
            photo: replyTo.photo,
          }
        : undefined;
      useFable.getState().append(id, text, "me", false, { replyTo: quote });
      setReplyTo(null);
      scrollToEnd();
      // Group threads: a rotating member "replies", so their name and face
      // show on the typing bubble and the reply.
      const members = getGroup(useFable.getState().groups, id)?.memberIds;
      const replier = members?.length
        ? members[
            (useFable.getState().threads[id]?.length ?? 0) % members.length
          ]
        : undefined;
      const t1 = setTimeout(() => {
        setTyping(true);
        setTypingPerson(replier ? (PEOPLE_BY_ID[replier] ?? null) : person);
        scrollToEnd();
      }, 600);
      const t2 = setTimeout(() => {
        setTyping(false);
        setTypingPerson(null);
        const reply =
          REPLIES[
            (useFable.getState().threads[id]?.length ?? 0) % REPLIES.length
          ];
        useFable.getState().append(
          id,
          reply,
          "them",
          false,
          replier ? { senderId: replier } : undefined,
        );
        scrollToEnd();
      }, 1800);
      timers.current.push(t1, t2);
    },
    [scrollToEnd, id, replyTo, person],
  );

  const onAttach = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Photos",
        "Allow photo access to share pictures from your gallery.",
      );
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (res.canceled || res.assets.length === 0) return;
    const quote = replyTo
      ? {
          id: replyTo.id,
          from: replyTo.from,
          text: replyTo.text,
          photo: replyTo.photo,
        }
      : undefined;
    useFable
      .getState()
      .append(id, "", "me", true, {
        photoUri: res.assets[0].uri,
        replyTo: quote,
      });
    setReplyTo(null);
    scrollToEnd();
  }, [id, replyTo, scrollToEnd]);

  const onOpenPhoto = useCallback(
    (message: Message) => {
      const src = message.photoUri
        ? { uri: message.photoUri }
        : person?.story;
      if (src) setViewerSource(src);
    },
    [person],
  );

  /** Display name for an incoming message — the sender in groups. */
  const senderName = useCallback(
    (m: Message) =>
      group && m.senderId ? (PEOPLE_BY_ID[m.senderId]?.first ?? "") : "",
    [group],
  );

  const replyPreview: ReplyPreview | null = replyTo
    ? {
        name:
          replyTo.from === "me"
            ? "You"
            : group
              ? senderName(replyTo)
              : (person?.first ?? ""),
        text: replyTo.text,
        photo: !!replyTo.photo,
      }
    : null;

  // Search matches: text messages containing the query, in thread order.
  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      q
        ? messages.filter(
            (m) => !m.photo && m.text.toLowerCase().includes(q),
          )
        : [],
    [messages, q],
  );
  const activeMatchId = matches[matchIdx]?.id;
  const matchesRef = useRef<Message[]>([]);
  useEffect(() => {
    matchesRef.current = matches;
  }, [matches]);

  const jumpTo = useCallback(
    (i: number) => {
      const m = matchesRef.current[i];
      if (!m) return;
      const top = rowTops.current.get(m.id);
      if (top == null) return;
      // Park the row just under the search bar.
      listRef.current?.scrollTo({ y: Math.max(0, top - 120), animated: true });
    },
    [listRef],
  );

  const stepMatch = useCallback(
    (dir: 1 | -1) => {
      const n = matchesRef.current.length;
      if (n === 0) return;
      const next = (matchIdx + dir + n) % n;
      setMatchIdx(next);
      jumpTo(next);
    },
    [matchIdx, jumpTo],
  );

  const handleQuery = useCallback(
    (text: string) => {
      setQuery(text);
      setMatchIdx(0);
      // The match list recomputes on re-render; land on the first hit after.
      const t = setTimeout(() => jumpTo(0), 80);
      timers.current.push(t);
    },
    [jumpTo],
  );

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery("");
    setMatchIdx(0);
  }, []);

  const dayOf = useCallback((at: string) => {
    if (at.startsWith("Yesterday")) return "Yesterday";
    // "Tuesday 14:02" -> "Tuesday"; "9:41" / "now" -> "Today".
    return at.includes(" ") ? at.split(" ")[0] : "Today";
  }, []);

  const rows = useMemo(
    () =>
      messages.map((msg, i) => {
        const prev = messages[i - 1];
        const first = !prev || prev.from !== msg.from;
        const label = dayOf(msg.at);
        const dayBreak = !prev || dayOf(prev.at) !== label;
        return { msg, first, label: dayBreak ? label : null, animate: i >= mountedCount };
      }),
    [messages, mountedCount, dayOf],
  );

  const panelTop = insets.top + THREAD_NAV_H + Space[1];

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      {group ? (
        <GroupHeader
          group={group}
          insetTop={insets.top}
          onSearch={() => setSearchOpen(true)}
        />
      ) : person ? (
        <ThreadHeader
          person={person}
          threadId={id}
          insetTop={insets.top}
          onSearch={() => setSearchOpen(true)}
        />
      ) : null}

      {/* The panel: one big rounded card the conversation lives in. */}
      <View
        style={[
          styles.panel,
          {
            top: panelTop,
            backgroundColor: wallpaper ? "transparent" : theme.surface,
          },
        ]}
      >
        {wallpaper ? (
          <>
            <Image
              source={{ uri: wallpaper.uri }}
              resizeMode="cover"
              blurRadius={wallpaper.blur * 25}
              style={[StyleSheet.absoluteFill, { opacity: wallpaper.opacity }]}
            />
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: `rgba(242, 242, 244, ${(
                    0.5 *
                    (1 - wallpaper.opacity)
                  ).toFixed(3)})`,
                },
              ]}
            />
          </>
        ) : (
          <LinearGradient
            pointerEvents="none"
            colors={[theme.surface, theme.panelEnd]}
            locations={[0, 1]}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View pointerEvents="none" style={styles.grabberWrap}>
          <View style={[styles.grabber, { backgroundColor: theme.grabber }]} />
        </View>
        <KeyboardChatScrollView
          ref={listRef as unknown as Ref<Animated.ScrollView>}
          // The composer's safe-area padding sits over the keyboard when it is open, so lift by the rest.
          offset={insets.bottom}
          keyboardLiftBehavior="always"
          keyboardDismissMode="interactive"
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={handleContentSizeChange}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onScrollBeginDrag={() => setReaction(null)}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: composerHeight + Space[2] },
          ]}
        >
          {rows.map(({ msg, first, label, animate }) => (
            <View
              key={msg.id}
              onLayout={(e) =>
                rowTops.current.set(msg.id, e.nativeEvent.layout.y)
              }
            >
              {label && (
                <Text
                  style={[Type.caption, styles.day, { color: theme.tertiary }]}
                >
                  {label}
                </Text>
              )}
              <Bubble
                message={msg}
                person={person}
                first={first}
                animate={animate}
                onReact={onReact}
                reacting={reaction?.message.id === msg.id}
                onReply={setReplyTo}
                onOpenPhoto={onOpenPhoto}
                highlight={q || undefined}
                highlightActive={msg.id === activeMatchId}
                senderName={
                  msg.from !== "me" ? senderName(msg) || undefined : undefined
                }
              />
            </View>
          ))}
          {typing && (group ? typingPerson : person) && (
            <TypingBubble person={(group ? typingPerson : person) as Person} />
          )}
        </KeyboardChatScrollView>
        {loadingEarlier && (
          <View pointerEvents="none" style={styles.olderLoading}>
            <ActivityIndicator size="small" color={theme.tertiary} />
          </View>
        )}
      </View>

      <Composer
        threadId={id}
        insetBottom={insets.bottom}
        onSend={onSend}
        onAttach={onAttach}
        onLayoutHeight={setComposerHeight}
        replyPreview={replyPreview}
        onCancelReply={() => setReplyTo(null)}
      />

      {searchOpen && (
        <SearchBar
          top={panelTop + 4}
          query={query}
          onQuery={handleQuery}
          matchCount={matches.length}
          matchIndex={matchIdx}
          onPrev={() => stepMatch(-1)}
          onNext={() => stepMatch(1)}
          onClose={closeSearch}
        />
      )}

      {reaction && (
        <ReactionOverlay
          target={reaction.target}
          selected={reaction.message.reactions ?? []}
          onPick={onPickReaction}
          onClose={() => setReaction(null)}
          actions={
            <Glass style={styles.actionMenu}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Reply to message"
                onPress={onReplyMessage}
                style={styles.actionRow}
              >
                <SFIcon
                  name="arrowshape.turn.up.left"
                  size={18}
                  color={theme.label}
                />
                <Text style={[styles.actionLabel, { color: theme.label }]}>
                  Reply
                </Text>
              </Pressable>
              <View
                style={[styles.actionDivider, { backgroundColor: theme.hairline }]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Forward message"
                onPress={onForwardMessage}
                style={styles.actionRow}
              >
                <SFIcon
                  name="arrowshape.turn.up.right"
                  size={18}
                  color={theme.label}
                />
                <Text style={[styles.actionLabel, { color: theme.label }]}>
                  Forward
                </Text>
              </Pressable>
              <View
                style={[styles.actionDivider, { backgroundColor: theme.hairline }]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete message"
                onPress={onDeleteMessage}
                style={styles.actionRow}
              >
                <SFIcon name="trash" size={18} color="#E5484D" />
                <Text style={[styles.actionLabel, { color: "#E5484D" }]}>
                  Delete
                </Text>
              </Pressable>
            </Glass>
          }
        />
      )}

      {forwarding && (
        <Sheet detent={0.6}>
          <Text style={[styles.forwardTitle, { color: theme.label }]}>
            Forward to
          </Text>
          <SheetScrollView showsVerticalScrollIndicator={false}>
            {PEOPLE.filter((person) => person.id !== id).map((person) => (
              <Pressable
                key={person.id}
                accessibilityRole="button"
                accessibilityLabel={`Forward to ${person.name}`}
                onPress={() => onPickForwardTarget(person.id)}
                style={styles.forwardRow}
              >
                <Avatar source={person.avatar} size={48} />
                <Text style={[styles.forwardName, { color: theme.label }]}>
                  {person.name}
                </Text>
              </Pressable>
            ))}
          </SheetScrollView>
        </Sheet>
      )}

      {viewerSource && (
        <PhotoViewer
          source={viewerSource}
          onClose={() => setViewerSource(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  actionMenu: {
    borderRadius: 20,
    borderCurve: "continuous",
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
  },
  actionLabel: {
    fontSize: 16,
  },
  actionDivider: {
    height: StyleSheet.hairlineWidth,
  },
  forwardTitle: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  forwardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 10,
  },
  forwardName: {
    fontSize: 16,
    fontWeight: "500",
  },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -Radius.panel,
    borderRadius: Radius.panel,
    borderCurve: "continuous",
    overflow: "hidden",
    paddingBottom: Radius.panel,
  },
  grabberWrap: {
    position: "absolute",
    top: 10,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 2,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
  },
  content: {
    paddingTop: Space[6],
  },
  // Older-history loading spinner: floats over the panel, never shifts layout.
  olderLoading: {
    position: "absolute",
    top: 24,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 3,
  },
  day: {
    textAlign: "center",
    marginTop: Space[5],
  },
});
