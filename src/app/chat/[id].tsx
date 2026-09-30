import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image as RNImage,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SFIcon } from "../../ui/SFIcon";
import * as ImagePicker from "expo-image-picker";
import {
  AndroidGlassButton,
  AndroidGlassMenu,
  AndroidGlassMenuProvider,
} from "expo-android-glass-view";
import {
  Bubble,
  Chat,
  Composer,
  ReplyPreview,
  utils,
  type ActionsProps,
  type AvatarProps,
  type BubbleProps,
  type ComposerProps,
  type IMessage,
  type InputToolbarProps,
  type ReplyMessage,
  type SendProps,
} from "@kesha-antonov/react-native-chat";
import { Image } from "expo-image";
import {
  coast,
  initialMessages,
  people,
  portraits,
  type Message as CookbookMessage,
  type Person,
} from "../../cookbooks/astra/data";
import {
  useFlight,
  usePortraitNavigation,
} from "../../cookbooks/astra/flight";
import { GlassFlight } from "../../cookbooks/astra/GlassFlight";
import { AdaptiveGlassView } from "../../ui/GlassView";
import { ScreenBackground } from "../../ui/ScreenBackground";

const ME_ID = "me";
const ACCENT = "#3D92E9";

const REPLIES = [
  "Haha exactly",
  "Wait — tell me more",
  "Okay that's actually perfect",
  "On my way, give me ten",
  "No way. Send pics.",
  "Deal. Saturday then?",
];

const portraitUri = (person: Person) =>
  RNImage.resolveAssetSource(portraits[person.avatar]).uri;
const coastUri = RNImage.resolveAssetSource(coast).uri;

function toIMessage(
  m: CookbookMessage,
  person: Person,
  ageMinutes: number,
): IMessage {
  const mine = m.mine;
  return {
    _id: m.id,
    text: m.text ?? "",
    createdAt: new Date(Date.now() - ageMinutes * 60000),
    user: mine
      ? { _id: ME_ID, name: "Tariq" }
      : { _id: person.id, name: person.name, avatar: portraitUri(person) },
    image: m.kind === "photo" ? coastUri : undefined,
    sent: true,
    received: true,
  };
}

function toReplyMessage(m: IMessage): ReplyMessage {
  return { _id: m._id, text: m.text ?? "", user: m.user, image: m.image };
}

/** Plus button that opens the native glass attachment menu. */
function AttachButton({ onPickImage }: { onPickImage: () => void }) {
  const anchorRef = useRef<View>(null);
  const [visible, setVisible] = useState(false);
  return (
    <>
      <View ref={anchorRef} collapsable={false} style={styles.attachAnchor}>
        <Pressable
          onPress={() => setVisible(true)}
          hitSlop={10}
          style={styles.attachBtn}
          accessibilityRole="button"
          accessibilityLabel="Attach"
        >
          <SFIcon name="plus" size={22} color="rgba(23,25,27,0.85)" />
        </Pressable>
      </View>
      <AndroidGlassMenu
        visible={visible}
        anchorRef={anchorRef}
        onDismiss={() => setVisible(false)}
        onSelect={(id) => {
          if (id === "photo") onPickImage();
        }}
        theme="light"
        items={[{ id: "photo", title: "Photo library", icon: "photo" }]}
      />
    </>
  );
}

const glassTheme = {
  colors: {
    accent: ACCENT,
    background: "transparent",
    // The glass surface comes from AdaptiveGlassView — keep kesha's own
    // bubble fills transparent so the refraction shows through.
    incomingBubble: "transparent",
    outgoingBubble: "transparent",
    incomingText: "#242628",
    outgoingText: "#ffffff",
    incomingMeta: "rgba(36,38,40,0.55)",
    outgoingMeta: "rgba(255,255,255,0.78)",
    senderName: "rgba(36,38,40,0.7)",
    ticksSent: "rgba(36,38,40,0.5)",
    ticksRead: ACCENT,
    separator: "rgba(23,25,27,0.1)",
    inputBackground: "transparent",
    inputBarBackground: "transparent",
    inputText: "#17191B",
    placeholder: "rgba(23,25,27,0.4)",
    dayPillBackground: "rgba(255,255,255,0.75)",
    dayPillText: "#17191B",
    surface: "rgba(255,255,255,0.94)",
    reactionBackground: "rgba(23,25,27,0.06)",
    reactionActiveBackground: "rgba(61,146,233,0.18)",
    outgoingOverlay: "rgba(255,255,255,0.08)",
    error: "#d32f2f",
    inputFieldBorder: "transparent",
  },
  radii: {
    bubble: 20,
    bubbleGrouped: 16,
    inputField: 24,
    sendButton: 22,
    reaction: 14,
    dayPill: 12,
  },
};

function ConversationBody({ person }: { person: Person }) {
  const insets = useSafeAreaInsets();
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Portrait flight: the inbox portrait lands on this header avatar.
  const {
    ref: headerRef,
    land,
    back,
  } = usePortraitNavigation(person, "header");
  const flying = useFlight(
    (s) => !!s.active && s.active.person === person.id,
  );

  useEffect(() => {
    land();
  }, [land]);

  const [messages, setMessages] = useState<IMessage[]>(() => {
    const seed = initialMessages(person.id);
    // Kesha renders newest-first.
    return seed
      .map((m, i) => toIMessage(m, person, (seed.length - i) * 3))
      .reverse();
  });
  const [isTyping, setIsTyping] = useState(false);
  const [replyMessage, setReplyMessage] = useState<ReplyMessage | null>(null);

  useEffect(
    () => () => {
      if (replyTimer.current) clearTimeout(replyTimer.current);
    },
    [],
  );

  const onSend = useCallback(
    (newMessages: IMessage[] = []) => {
      setMessages((prev) => Chat.append(prev, newMessages));
      // Playful local echo while there's no backend — keeps the screen alive.
      setIsTyping(true);
      if (replyTimer.current) clearTimeout(replyTimer.current);
      replyTimer.current = setTimeout(() => {
        const text =
          REPLIES[Math.floor(Math.random() * REPLIES.length)] ?? REPLIES[0];
        setMessages((prev) =>
          Chat.append(prev, [
            {
              _id: `echo-${Date.now()}`,
              text,
              createdAt: new Date(),
              user: {
                _id: person.id,
                name: person.name,
                avatar: portraitUri(person),
              },
              sent: true,
              received: true,
            } as IMessage,
          ]),
        );
        setIsTyping(false);
      }, 1600);
    },
    [person],
  );

  const onReactionPress = useCallback((message: IMessage, emoji: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m._id !== message._id) return m;
        const reactions = [...(m.reactions ?? [])];
        const idx = reactions.findIndex((r) => r.emoji === emoji);
        if (idx >= 0) {
          const r = reactions[idx];
          const userIds = r.userIds.includes(ME_ID)
            ? r.userIds.filter((u) => u !== ME_ID)
            : [...r.userIds, ME_ID];
          if (userIds.length === 0) reactions.splice(idx, 1);
          else reactions[idx] = { ...r, userIds };
        } else {
          reactions.push({ emoji, userIds: [ME_ID] });
        }
        return { ...m, reactions };
      }),
    );
  }, []);

  const messageActions = useCallback(
    (message: IMessage) => [
      {
        label: "Reply",
        onPress: () => setReplyMessage(toReplyMessage(message)),
      },
      {
        label: "Delete",
        destructive: true,
        onPress: () =>
          setMessages((prev) => prev.filter((m) => m._id !== message._id)),
      },
    ],
    [],
  );

  const pickImage = useCallback(async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (res.canceled || !res.assets[0]) return;
    onSend([
      {
        _id: `img-${Date.now()}`,
        text: "",
        image: res.assets[0].uri,
        createdAt: new Date(),
        user: { _id: ME_ID, name: "Tariq" },
        sent: true,
      } as IMessage,
    ]);
  }, [onSend]);

  // --- Glass reskin: kesha's engine, TwoLink's liquid-glass chrome. ---

  const renderBubble = useCallback((props: BubbleProps<IMessage>) => {
    const isOwn = props.position === "right";
    return (
      <AdaptiveGlassView
        style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleTheirs]}
        tintColor={isOwn ? "rgba(61,146,233,0.72)" : "rgba(255,255,255,0.55)"}
        blurRadius={12}
        refractionHeight={7}
        refractionAmount={13}
      >
        <Bubble
          {...props}
          wrapperStyle={{
            left: { backgroundColor: "transparent" },
            right: { backgroundColor: "transparent" },
          }}
        />
      </AdaptiveGlassView>
    );
  }, []);

  const renderAvatar = useCallback((props: AvatarProps<IMessage>) => {
    if (props.position !== "left") return null;
    const uri = props.currentMessage?.user?.avatar as string | undefined;
    if (!uri) return null;
    return <Image source={{ uri }} style={styles.avatar} contentFit="cover" />;
  }, []);

  const renderActions = useCallback(
    (_props: ActionsProps) => <AttachButton onPickImage={pickImage} />,
    [pickImage],
  );

  const renderSend = useCallback((props: SendProps<IMessage>) => {
    const canSend = !!props.text?.trim().length;
    return (
      <View style={styles.sendWrap}>
        <AndroidGlassButton
          onPress={() => {
            const text = props.text?.trim() ?? "";
            if (text && props.onSend) props.onSend({ text }, true);
          }}
          interactive
          tintColor={
            canSend ? "rgba(61,146,233,0.9)" : "rgba(23,25,27,0.06)"
          }
          style={styles.sendBtn}
          accessibilityRole="button"
          accessibilityLabel="Send"
        >
          <SFIcon
            name="paperplane"
            size={17}
            color={canSend ? "#fff" : "rgba(23,25,27,0.35)"}
          />
        </AndroidGlassButton>
      </View>
    );
  }, []);

  const renderInputToolbar = useCallback(
    (props: InputToolbarProps<IMessage>) => (
      <View
        style={[
          styles.toolbarOuter,
          { paddingBottom: Math.max(insets.bottom, 10) },
        ]}
      >
        {props.replyMessage ? (
          <ReplyPreview
            replyMessage={props.replyMessage}
            onClearReply={props.onClearReply}
            containerStyle={styles.replyPreview}
            textStyle={styles.replyPreviewText}
          />
        ) : null}
        <AdaptiveGlassView
          style={styles.toolbar}
          tintColor="rgba(255,255,255,0.65)"
          blurRadius={20}
          refractionHeight={8}
          refractionAmount={12}
        >
          {utils.renderComponentOrElement(
            props.renderActions ?? renderActions,
            {} as ActionsProps,
          )}
          {utils.renderComponentOrElement(
            props.renderComposer,
            props as unknown as ComposerProps,
          ) ?? <Composer {...(props as unknown as ComposerProps)} />}
          {utils.renderComponentOrElement(
            props.renderSend ?? renderSend,
            props as unknown as SendProps<IMessage>,
          )}
        </AdaptiveGlassView>
      </View>
    ),
    [insets.bottom, renderActions, renderSend],
  );

  const avatarUri = portraitUri(person);

  return (
    <>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={back}
          hitSlop={12}
          style={styles.headerBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <SFIcon name="chevron.left" size={26} color="#17191B" />
        </Pressable>
        <View
          ref={headerRef}
          collapsable={false}
          style={{ opacity: flying ? 0.001 : 1 }}
        >
          <Image
            source={{ uri: avatarUri }}
            style={styles.headerAvatar}
            contentFit="cover"
          />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerName}>{person.name}</Text>
          <Text style={styles.headerStatus}>
            {isTyping ? "typing…" : "online"}
          </Text>
        </View>
      </View>
      <View style={styles.chatWrap}>
        <Chat
          messages={messages}
          onSend={onSend}
          user={{ _id: ME_ID, name: "Tariq" }}
          theme={glassTheme}
          colorScheme="light"
          renderBubble={renderBubble}
          renderAvatar={renderAvatar}
          renderInputToolbar={renderInputToolbar}
          isTyping={isTyping}
          reactions={{ isEnabled: true, onReactionPress }}
          reply={{
            message: replyMessage,
            onClear: () => setReplyMessage(null),
            swipe: {
              isEnabled: true,
              onSwipe: (m) => setReplyMessage(toReplyMessage(m)),
            },
          }}
          messageActions={messageActions}
          isScrollToBottomEnabled
          enableGestureHandlerRootView={false}
        />
      </View>
    </>
  );
}

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const person = useMemo(() => people.find((p) => p.id === id), [id]);

  if (!person) {
    return (
      <ScreenBackground>
        <View style={[styles.center, { paddingTop: insets.top }]}>
          <Text style={styles.notFound}>Conversation not found</Text>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Go back</Text>
          </Pressable>
        </View>
      </ScreenBackground>
    );
  }

  return (
    <AndroidGlassMenuProvider>
      <ScreenBackground>
        <ConversationBody person={person} />
        {/* Portrait flight overlay for the inbox → conversation transition. */}
        <GlassFlight />
      </ScreenBackground>
    </AndroidGlassMenuProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  notFound: { color: "#17191B", fontSize: 17, fontFamily: "SFProText-Semibold" },
  backBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "rgba(61,146,233,0.9)",
  },
  backBtnText: { color: "#fff", fontFamily: "SFProText-Semibold" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  headerBack: { padding: 6 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, marginLeft: 4 },
  headerText: { marginLeft: 10, flex: 1 },
  headerName: { color: "#17191B", fontSize: 17, fontFamily: "SFProText-Bold" },
  headerStatus: {
    color: ACCENT,
    fontSize: 12.5,
    fontFamily: "SFProText-Semibold",
    marginTop: 1,
  },
  chatWrap: { flex: 1 },
  bubble: {
    borderRadius: 20,
    marginVertical: 2,
    maxWidth: "78%",
    overflow: "hidden",
  },
  bubbleOwn: { alignSelf: "flex-end", marginLeft: 48 },
  bubbleTheirs: { alignSelf: "flex-start", marginRight: 48 },
  avatar: { width: 32, height: 32, borderRadius: 16, marginRight: 6 },
  toolbarOuter: { paddingHorizontal: 12, paddingTop: 6 },
  toolbar: {
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingLeft: 4,
    paddingRight: 6,
    paddingVertical: 6,
    overflow: "hidden",
  },
  attachAnchor: { justifyContent: "flex-end" },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  sendWrap: { justifyContent: "flex-end", marginLeft: 4 },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  replyPreview: {
    backgroundColor: "rgba(61,146,233,0.12)",
    borderRadius: 14,
    marginBottom: 8,
    marginHorizontal: 4,
  },
  replyPreviewText: { color: "rgba(23,25,27,0.85)" },
});
