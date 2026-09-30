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
import { Alert, StyleSheet, Text, View } from "react-native";
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
import { TypingBubble } from "../components/thread/typing";
import { Radius, Space, Type } from "../constants/theme";
import { REPLIES, messagesFor, type Message } from "../data/messages";
import { PEOPLE_BY_ID } from "../data/people";
import { useTheme } from "../hooks/use-theme";

import { useFable } from "../data/store";
import { NotFound } from "../../NotFound";

export default function ConversationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return PEOPLE_BY_ID[id] ? (
    <ThreadScreen key={id} id={id} />
  ) : (
    <NotFound home="/fable" />
  );
}

function ThreadScreen({ id }: { id: string }) {
  const person = PEOPLE_BY_ID[id];
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const stored = useFable((state) => state.threads[id]);
  const initial = useMemo(
    () => messagesFor(person.id, person.first),
    [person.id, person.first],
  );
  const messages = stored ?? initial;
  useEffect(() => {
    useFable.getState().markRead(id);
  }, [id]);
  const [typing, setTyping] = useState(false);
  const [mountedCount] = useState(messages.length);
  // Long-press reaction target: { message, bubble window rect }.
  const [reaction, setReaction] = useState<{
    message: Message;
    target: ReactionTarget;
  } | null>(null);
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

  // Include the floating composer in content geometry before the initial scroll.
  // Keyboard Controller supplies only the moving keyboard inset.
  const positionInitially = useCallback(() => {
    if (positioned.current || composerHeight === 0) return;
    positioned.current = true;
    initialFrame.current = requestAnimationFrame(() =>
      listRef.current?.scrollToEnd({ animated: false }),
    );
  }, [composerHeight, listRef]);

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
      const t1 = setTimeout(() => {
        setTyping(true);
        scrollToEnd();
      }, 600);
      const t2 = setTimeout(() => {
        setTyping(false);
        const reply =
          REPLIES[
            (useFable.getState().threads[id]?.length ?? 0) % REPLIES.length
          ];
        useFable.getState().append(id, reply, "them");
        scrollToEnd();
      }, 1800);
      timers.current.push(t1, t2);
    },
    [scrollToEnd, id, replyTo],
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
    (message: Message) =>
      setViewerSource(
        message.photoUri ? { uri: message.photoUri } : person.story,
      ),
    [person.story],
  );

  const replyPreview: ReplyPreview | null = replyTo
    ? {
        name: replyTo.from === "me" ? "You" : person.first,
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

  const rows = useMemo(
    () =>
      messages.map((msg, i) => {
        const prev = messages[i - 1];
        const first = !prev || prev.from !== msg.from;
        const yesterday = msg.at.startsWith("Yesterday");
        const dayBreak = !prev || prev.at.startsWith("Yesterday") !== yesterday;
        const label = dayBreak ? (yesterday ? "Yesterday" : "Today") : null;
        return { msg, first, label, animate: i >= mountedCount };
      }),
    [messages, mountedCount],
  );

  const panelTop = insets.top + THREAD_NAV_H + Space[1];

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ThreadHeader
        person={person}
        insetTop={insets.top}
        onSearch={() => setSearchOpen(true)}
      />

      {/* The panel: one big rounded card the conversation lives in. */}
      <View
        style={[
          styles.panel,
          { top: panelTop, backgroundColor: theme.surface },
        ]}
      >
        <LinearGradient
          pointerEvents="none"
          colors={[theme.surface, theme.panelEnd]}
          locations={[0, 1]}
          style={StyleSheet.absoluteFill}
        />
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
          onContentSizeChange={positionInitially}
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
              />
            </View>
          ))}
          {typing && <TypingBubble person={person} />}
        </KeyboardChatScrollView>
      </View>

      <Composer
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
        />
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
  day: {
    textAlign: "center",
    marginTop: Space[5],
  },
});
