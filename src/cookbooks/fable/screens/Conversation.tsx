import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, router } from "expo-router";
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
import { DeletedTombstone } from "../components/thread/tombstone";
import { Composer, type ReplyPreview } from "../components/thread/composer";
import { RequestActions } from "../components/thread/request-actions";
import { PhotoViewer } from "../components/thread/photo-viewer";
import {
  ReactionOverlay,
  type ReactionTarget,
} from "../components/thread/reaction-picker";
import { SearchBar } from "../components/thread/search-bar";
import { THREAD_NAV_H, ThreadHeader } from "../components/thread/thread-header";
import { GroupHeader } from "../components/thread/group-header";
import { MenuCard } from "../components/ui/menu-card";
import { Sheet, SheetScrollView } from "../components/ui/sheet";
import { Avatar } from "../components/ui/avatar";
import { SFIcon } from "../../../ui/SFIcon";
import { Radius, Space, Type } from "../constants/theme";
import { type Message, serverIdOf } from "../data/messages";
import { copyText } from "../lib/clipboard";
import {
  scheduledLabel,
  type ScheduledMessage,
} from "../data/scheduled";
import { ScheduledBubble } from "../components/thread/scheduled-bubble";
import { firstUnreadId } from "../data/unread";
import { atToDate, formatGapLabel, GAP_MS } from "../data/message-time";
import { avatarSource } from "../data/people";
import { useTheme } from "../hooks/use-theme";

import { useFable, getGroup, normalizeWallpaper } from "../data/store";
import { NotFound, LoadingRoute } from "../../NotFound";

export default function ConversationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chat = useFable((state) => state.chats.find((c) => c.id === id));
  const groups = useFable((state) => state.groups);
  const bootstrapped = useFable((state) => state.bootstrapped);
  useEffect(() => {
    // Deep link on a cold start: make sure the chat list is loading.
    // bootstrap() is idempotent.
    if (!bootstrapped) void useFable.getState().bootstrap();
  }, [bootstrapped]);
  if (!chat && !getGroup(groups, id)) {
    // The chat list hasn't arrived yet — wait for it instead of flashing
    // "not found" for a valid deep link.
    if (!bootstrapped) return <LoadingRoute />;
    return <NotFound home="/fable" />;
  }
  return <ThreadScreen key={id} id={id} />;
}

function ThreadScreen({ id }: { id: string }) {
  const chat = useFable((state) => state.chats.find((c) => c.id === id));
  const chats = useFable((state) => state.chats);
  const people = useFable((state) => state.people);
  const person =
    chat?.type === "direct" && chat.otherUserId
      ? people[chat.otherUserId]
      : undefined;
  const groups = useFable((state) => state.groups);
  const group = getGroup(groups, id);
  const mentionNames = useMemo(
    () =>
      group
        ? group.memberIds
            .map((m) => people[m]?.first)
            .filter((f): f is string => !!f)
        : [],
    [group, people],
  );
  const selfFirst = useFable((st) => st.profile.name.split(" ")[0] ?? "");
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const incomingRequestIds = useFable((state) => state.incomingRequestIds);
  const acceptRequest = useFable((state) => state.acceptRequest);
  const declineRequest = useFable((state) => state.declineRequest);
  const blockUserAction = useFable((state) => state.blockUser);
  // This chat is an incoming friend request I haven't answered yet.
  const isIncomingRequest =
    chat?.type === "direct" &&
    !!chat.otherUserId &&
    incomingRequestIds.includes(chat.otherUserId);

  const stored = useFable((state) => state.threads[id]);
  const wallpaperRaw = useFable((state) => state.wallpapers[id]);
  const wallpaper = normalizeWallpaper(wallpaperRaw);
  const threadLoaded = useFable((state) => state.threadsLoaded[id] ?? false);
  const historyExhausted = useFable(
    (state) => state.historyExhausted[id] ?? false,
  );
  const messages = useMemo(() => stored ?? [], [stored]);
  // Capture the first unread message before markRead clears it, so opening
  // a thread with unread messages lands there instead of at the bottom.
  // On a deep link the thread may not be loaded at mount — the effect below
  // re-captures after ensureThread resolves, still before markRead runs.
  const [jumpToUnreadId, setJumpToUnreadId] = useState<string | undefined>(
    () => {
      const s = useFable.getState();
      return firstUnreadId(s.threads[id] ?? [], s.lastRead[id]);
    },
  );
  useEffect(() => {
    const s = useFable.getState();
    s.setOpenThread(id);
    s.sweepExpired();
    // Refresh request state so the bottom bar (actions vs composer) is
    // correct even if a Realtime friendship event was missed.
    void s.refreshRequests().catch(() => {});
    // Load the live thread, capture the unread target, then mark it read
    // once messages are in.
    void s.ensureThread(id).then(() => {
      const st = useFable.getState();
      setJumpToUnreadId(
        (prev) => prev ?? firstUnreadId(st.threads[id] ?? [], st.lastRead[id]),
      );
      st.markRead(id);
    });
    return () => {
      if (useFable.getState().openThreadId === id)
        useFable.getState().setOpenThread(null);
    };
  }, [id]);
  // Scroll-up pagination: older history from the server until exhausted.
  const hasEarlier = threadLoaded && !historyExhausted;
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  // Long-press reaction target: { message, bubble window rect }.
  const [reaction, setReaction] = useState<{
    message: Message;
    target: ReactionTarget;
  } | null>(null);
  // Forwarding: the message being sent to another thread (person picker).
  const [forwarding, setForwarding] = useState<Message | null>(null);
  // Swipe-to-reply target: arms the composer's reply strip.
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  // Editing: the outgoing text message loaded into the composer.
  const [editing, setEditing] = useState<{
    messageId: string;
    text: string;
  } | null>(null);
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
  // Messages newer than this screen's mount animate in; history (including
  // paginated older pages) appears instantly.
  const [mountedAt] = useState(() => Date.now());
  const initialFrame = useRef<number | null>(null);
  const listRef = useAnimatedRef<Animated.ScrollView>();
  const [composerHeight, setComposerHeight] = useState(0);
  const [actionsHeight, setActionsHeight] = useState(0);
  // Row top offsets (content coordinates) for scrolling to search matches.
  const rowTops = useRef(new Map<string, number>());
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
    void useFable
      .getState()
      .loadEarlier(id)
      .finally(() => setLoadingEarlier(false));
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
        void useFable
          .getState()
          .toggleReaction(id, serverIdOf(reaction.message), emoji);
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

  /** System share sheet for photos and files (expo-sharing). */
  const onShareMessage = useCallback(async () => {
    const message = reaction?.message;
    setReaction(null);
    const uri = message?.photoUri ?? message?.document?.uri;
    if (!uri || message?.deletedForEveryone) return;
    try {
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
    } catch {
      // Native module missing on the pre-batch dev build.
    }
  }, [reaction]);

  const onCopyMessage = useCallback(async () => {
    const message = reaction?.message;
    setReaction(null);
    if (!message || message.deletedForEveryone) return;
    const text = message.document ? message.document.name : message.text;
    const ok = await copyText(text);
    if (!ok)
      useFable.getState().showAlert({
        title: "Copy isn't ready yet",
        message: "Copy needs the latest build — update and try again.",
        actions: [{ text: "OK", style: "default" }],
      });
  }, [reaction]);

  const onEditMessage = useCallback(() => {
    const message = reaction?.message;
    setReaction(null);
    if (
      !message ||
      message.from !== "me" ||
      message.photo ||
      message.document ||
      message.deletedForEveryone
    )
      return;
    setEditing({ messageId: serverIdOf(message), text: message.text });
  }, [reaction]);

  const onDeleteMessage = useCallback(() => {
    const message = reaction?.message;
    setReaction(null);
    if (!message || message.deletedForEveryone) return;
    const store = useFable.getState();
    if (message.from !== "me") {
      store.showAlert({
        title: "Delete message?",
        message: "This removes it from this conversation.",
        actions: [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete for me",
            style: "destructive",
            onPress: () => void store.deleteMessage(id, serverIdOf(message), "me"),
          },
        ],
      });
      return;
    }
    store.showAlert({
      title: "Delete message?",
      actions: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete for me",
          style: "default",
          onPress: () => void store.deleteMessage(id, serverIdOf(message), "me"),
        },
        {
          text: "Delete for everyone",
          style: "destructive",
          onPress: () => void store.deleteMessage(id, serverIdOf(message), "everyone"),
        },
      ],
    });
  }, [id, reaction]);

  const onPickForwardTarget = useCallback(
    (targetChatId: string) => {
      const message = forwarding;
      setForwarding(null);
      if (!message || targetChatId === id) return;
      void useFable.getState().forwardMessage(targetChatId, message);
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
      void useFable
        .getState()
        .append(id, text, "me", false, { replyTo: quote });
      setReplyTo(null);
      scrollToEnd();
    },
    [scrollToEnd, id, replyTo],
  );

  const onSaveEdit = useCallback(
    (messageId: string, text: string) => {
      void useFable.getState().editMessage(id, messageId, text);
      setEditing(null);
    },
    [id],
  );

  // Send Later: queue the text, preserving an armed reply. The flusher in
  // the fable layout sends it when its time comes, even from the inbox.
  const handleSchedule = useCallback(
    (text: string, at: number) => {
      const quote = replyTo
        ? {
            id: replyTo.id,
            from: replyTo.from,
            text: replyTo.text,
            photo: replyTo.photo,
          }
        : undefined;
      useFable.getState().scheduleMessage(id, text, at, quote);
      setReplyTo(null);
      scrollToEnd();
    },
    [scrollToEnd, id, replyTo],
  );

  const cancelScheduled = useCallback((item: ScheduledMessage) => {
    useFable.getState().showAlert({
      title: "Cancel scheduled message?",
      message: `It was set to send ${scheduledLabel(item.at).toLowerCase()}.`,
      actions: [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel send",
          style: "destructive",
          onPress: () => useFable.getState().cancelScheduled(item.id),
        },
      ],
    });
  }, []);

  const scheduledAll = useFable((state) => state.scheduled);
  const scheduled = useMemo(
    () =>
      scheduledAll
        .filter((m) => m.threadId === id)
        .sort((a, b) => a.at - b.at),
    [scheduledAll, id],
  );

  const onAttach = useCallback(async () => {    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
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
    void useFable
      .getState()
      .append(id, "", "me", true, {
        photoUri: res.assets[0].uri,
        replyTo: quote,
      });
    setReplyTo(null);
    scrollToEnd();
  }, [id, replyTo, scrollToEnd]);

  /** File attachments via the system document picker. */
  const onAttachFile = useCallback(async () => {
    let res: DocumentPicker.DocumentPickerResult;
    try {
      res = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        multiple: false,
        copyToCacheDirectory: true,
      });
    } catch {
      // Native module missing — this runs on the dev build from before the
      // package batch; the fresh build enables file attachments.
      useFable.getState().showAlert({
        title: "Files",
        message:
          "File attachments need the latest build — update and try again.",
        actions: [{ text: "OK", style: "default" }],
      });
      return;
    }
    if (res.canceled || !res.assets || res.assets.length === 0) return;
    const asset = res.assets[0];
    // Persist outside the picker's cache: Android may evict cache, which
    // would rot the attachment link in old messages.
    let uri = asset.uri;
    try {
      const dir = `${FileSystem.documentDirectory}attachments/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      const safeName = `${Date.now()}-${asset.name ?? "file"}`;
      const dest = `${dir}${safeName}`;
      await FileSystem.copyAsync({ from: asset.uri, to: dest });
      uri = dest;
    } catch {
      // Fall back to the picker's cached copy.
    }
    const quote = replyTo
      ? {
          id: replyTo.id,
          from: replyTo.from,
          text: replyTo.text,
          photo: replyTo.photo,
        }
      : undefined;
    void useFable.getState().append(id, asset.name ?? "File", "me", false, {
      document: {
        name: asset.name ?? "File",
        size: asset.size ?? 0,
        mimeType: asset.mimeType ?? "application/octet-stream",
        uri,
      },
      replyTo: quote,
    });
    setReplyTo(null);
    scrollToEnd();
  }, [id, replyTo, scrollToEnd]);

  const onOpenPhoto = useCallback((message: Message) => {
    if (message.photoUri) setViewerSource({ uri: message.photoUri });
  }, []);

  /** Display name for an incoming message — the sender in groups. */
  const senderName = useCallback(
    (m: Message) =>
      group && m.senderId ? (people[m.senderId]?.first ?? "") : "",
    [group, people],
  );

  /** Avatar art for an incoming group message — shown left of the bubble. */
  const senderAvatar = useCallback(
    (m: Message) =>
      group && m.senderId ? people[m.senderId]?.avatar : undefined,
    [group, people],
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

  const rows = useMemo(() => {
    return messages.map((msg, i) => {
      const prev = messages[i - 1];
      const next = messages[i + 1];
      // A run breaks when the side or (in groups) the sender changes —
      // the avatar sits on the last message of each sender's run.
      const runOf = (m?: Message) => (m ? `${m.from}:${m.senderId ?? ""}` : "");
      const first = runOf(prev) !== runOf(msg);
      const last = runOf(msg) !== runOf(next);
      const label = dayOf(msg.at);
      const dayBreak = !prev || dayOf(prev.at) !== label;
      // iMessage shows a centered timestamp when a gap of an hour or
      // more separates messages on the same day.
      let gapLabel: string | null = null;
      if (!dayBreak && prev) {
        const a = atToDate(prev.at);
        const b = atToDate(msg.at);
        if (a && b && b.getTime() - a.getTime() >= GAP_MS)
          gapLabel = formatGapLabel(b);
      }
      return {
        msg,
        first,
        last,
        label: dayBreak ? label : null,
        gapLabel,
        animate: (msg.createdAtMs ?? 0) > mountedAt,
      };
    });
  }, [messages, dayOf, mountedAt]);

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
            {
              paddingBottom:
                (isIncomingRequest
                  ? Math.max(actionsHeight, composerHeight)
                  : composerHeight) + Space[2],
            },
          ]}
        >
          {rows.map(({ msg, first, last, label, gapLabel, animate }) => (
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
              {gapLabel && (
                <Text
                  style={[Type.caption, styles.day, { color: theme.tertiary }]}
                >
                  {gapLabel}
                </Text>
              )}
              {msg.deletedForEveryone ? (
                <DeletedTombstone message={msg} first={first} />
              ) : (
                <Bubble
                  message={msg}
                  person={person}
                  first={first}
                  last={last}
                  animate={animate}
                  onReact={onReact}
                  reacting={reaction?.message.id === msg.id}
                  onReply={setReplyTo}
                  onOpenPhoto={onOpenPhoto}
                  highlight={q || undefined}
                  highlightActive={msg.id === activeMatchId}
                  senderAvatar={
                    msg.from !== "me" ? senderAvatar(msg) : undefined
                  }
                  mentions={
                    group
                      ? { names: mentionNames, self: selfFirst }
                      : undefined
                  }
                />
              )}
            </View>
          ))}
          {scheduled.map((item, i) => (
            <ScheduledBubble
              key={item.id}
              item={item}
              // Same vertical rhythm as regular bubbles: a wide gap when the
              // sender changes, a tight one inside the sender's own run.
              first={
                i === 0 && rows[rows.length - 1]?.msg.from !== "me"
              }
              onCancel={() => cancelScheduled(item)}
            />
          ))}
        </KeyboardChatScrollView>
        {loadingEarlier && (
          <View pointerEvents="none" style={styles.olderLoading}>
            <ActivityIndicator size="small" color={theme.tertiary} />
          </View>
        )}
      </View>

      {isIncomingRequest && chat?.otherUserId ? (
        <RequestActions
          requesterId={chat.otherUserId}
          requesterName={person?.first ?? "this person"}
          insetBottom={insets.bottom}
          onLayoutHeight={setActionsHeight}
          onAccept={async () => {
            try {
              await acceptRequest(chat.otherUserId!);
            } catch {
              useFable.getState().showAlert({
                title: "Couldn't accept",
                message: "Please check your connection and try again.",
                actions: [{ text: "OK", style: "default" }],
              });
            }
          }}
          onDecline={async () => {
            try {
              await declineRequest(chat.otherUserId!);
              router.replace("/fable");
            } catch {
              useFable.getState().showAlert({
                title: "Couldn't decline",
                message: "Please check your connection and try again.",
                actions: [{ text: "OK", style: "default" }],
              });
            }
          }}
          onBlock={async () => {
            try {
              await blockUserAction(chat.otherUserId!);
              router.replace("/fable");
            } catch {
              useFable.getState().showAlert({
                title: "Couldn't block",
                message: "Please check your connection and try again.",
                actions: [{ text: "OK", style: "default" }],
              });
            }
          }}
        />
      ) : (
        <Composer
            key={editing ? `edit-${editing.messageId}` : "compose"}
            threadId={id}
            insetBottom={insets.bottom}
            onSend={onSend}
            onAttach={onAttach}
            onAttachFile={onAttachFile}
            onLayoutHeight={setComposerHeight}
            replyPreview={replyPreview}
            onCancelReply={() => setReplyTo(null)}
            onSchedule={handleSchedule}
            editPreview={editing}
            initialText={editing?.text}
            onSaveEdit={onSaveEdit}
            onCancelEdit={() => setEditing(null)}
          />
      )}

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
          actions={(() => {
            const msg = reaction.message;
            const tombstoned = !!msg.deletedForEveryone;
            const canCopy =
              !tombstoned && (msg.text.trim().length > 0 || !!msg.document);
            const canShare =
              !tombstoned && (!!msg.photoUri || !!msg.document?.uri);
            const canEdit =
              !tombstoned &&
              msg.from === "me" &&
              !msg.photo &&
              !msg.document &&
              msg.text.trim().length > 0;
            return (
              <MenuCard style={styles.actionMenu}>
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
                {canCopy && (
                  <>
                    <View
                      style={[
                        styles.actionDivider,
                        { backgroundColor: theme.hairline },
                      ]}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Copy message"
                      onPress={onCopyMessage}
                      style={styles.actionRow}
                    >
                      <SFIcon
                        name="list.clipboard"
                        size={18}
                        color={theme.label}
                      />
                      <Text
                        style={[styles.actionLabel, { color: theme.label }]}
                      >
                        Copy
                      </Text>
                    </Pressable>
                  </>
                )}
                {canEdit && (
                  <>
                    <View
                      style={[
                        styles.actionDivider,
                        { backgroundColor: theme.hairline },
                      ]}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Edit message"
                      onPress={onEditMessage}
                      style={styles.actionRow}
                    >
                      <SFIcon
                        name="pencil"
                        size={18}
                        color={theme.label}
                      />
                      <Text
                        style={[styles.actionLabel, { color: theme.label }]}
                      >
                        Edit
                      </Text>
                    </Pressable>
                  </>
                )}
                <View
                  style={[
                    styles.actionDivider,
                    { backgroundColor: theme.hairline },
                  ]}
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
                {canShare && (
                  <>
                    <View
                      style={[
                        styles.actionDivider,
                        { backgroundColor: theme.hairline },
                      ]}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Share outside Poffu"
                      onPress={onShareMessage}
                      style={styles.actionRow}
                    >
                      <SFIcon
                        name="square.and.arrow.up"
                        size={18}
                        color={theme.label}
                      />
                      <Text
                        style={[styles.actionLabel, { color: theme.label }]}
                      >
                        Share
                      </Text>
                    </Pressable>
                  </>
                )}
                {!tombstoned && (
                  <>
                    <View
                      style={[
                        styles.actionDivider,
                        { backgroundColor: theme.hairline },
                      ]}
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
                  </>
                )}
              </MenuCard>
            );
          })()}
        />
      )}

      {forwarding && (
        <Sheet detent={0.6}>          <Text style={[styles.forwardTitle, { color: theme.label }]}>
            Forward to
          </Text>
          <SheetScrollView showsVerticalScrollIndicator={false}>
            {chats
              .filter(
                (c) =>
                  c.type === "direct" &&
                  c.id !== id &&
                  c.otherUserId != null &&
                  people[c.otherUserId],
              )
              .map((target) => {
                const targetPerson = people[target.otherUserId as string];
                return (
                  <Pressable
                    key={target.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Forward to ${targetPerson.name}`}
                    onPress={() => onPickForwardTarget(target.id)}
                    style={styles.forwardRow}
                  >
                    <Avatar source={avatarSource(targetPerson)} size={48} />
                    <Text style={[styles.forwardName, { color: theme.label }]}>
                      {targetPerson.name}
                    </Text>
                  </Pressable>
                );
              })}
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
