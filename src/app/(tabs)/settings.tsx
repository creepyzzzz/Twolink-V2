import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AndroidGlassToggle,
  useMinimizeOnScrollHandler,
} from "expo-android-glass-view";
import { SFIcon } from "../../ui/SFIcon";
import { AdaptiveGlassView } from "../../ui/GlassView";
import { ScreenBackground } from "../../ui/ScreenBackground";
import { MyAvatar } from "../../cookbooks/fable/components/ui/my-avatar";
import { useFable } from "../../cookbooks/fable/data/store";

const ACCENT = "#3D92E9";
const INK = "#17191B";
const INK_SOFT = "rgba(23,25,27,0.55)";
const INK_FAINT = "rgba(23,25,27,0.35)";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <AdaptiveGlassView
        style={styles.card}
        tintColor="rgba(255,255,255,0.55)"
        blurRadius={18}
      >
        {children}
      </AdaptiveGlassView>
    </View>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
  last,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <AndroidGlassToggle
        value={value}
        onValueChange={onChange}
        accentColor={ACCENT}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const settings = useFable((s) => s.settings);
  const setSettings = useFable((s) => s.setSettings);
  const { readReceipts, typingIndicators, notifications } = settings;
  const profileName = useFable((s) => s.profile.name);
  const appPin = useFable((s) => s.appPin);
  // Shrinks the tab bar to its compact pill while the settings scroll.
  const minimizeOnScroll = useMinimizeOnScrollHandler();

  // Enabling notifications requests the OS permission first; a denial
  // leaves the toggle off with an explanation instead of a dead switch.
  const onToggleNotifications = (v: boolean) => {
    if (!v) {
      setSettings({ notifications: false });
      return;
    }
    Notifications.requestPermissionsAsync()
      .then(({ granted }) => {
        if (!granted) {
          useFable.getState().showAlert({
            title: "Notifications",
            message:
              "Turn on notifications for Poffu in system settings to get message alerts.",
            actions: [{ text: "OK", style: "default" }],
          });
          return;
        }
        setSettings({ notifications: true });
      })
      .catch(() => {
        // Native module missing on the pre-batch dev build.
      });
  };

  return (
    <ScreenBackground>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.flex}
        onScroll={minimizeOnScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Settings</Text>

        {/* Profile */}
        {/* Profile — opens My Profile. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open my profile"
          onPress={() => router.push("/me")}
        >
          <AdaptiveGlassView
            style={styles.profile}
            tintColor="rgba(255,255,255,0.55)"
            blurRadius={18}
          >
            <MyAvatar size={56} />
            <View style={styles.profileText}>
              <Text style={styles.profileName}>{profileName}</Text>
            </View>
            <SFIcon name="chevron.right" size={20} color={INK_FAINT} />
          </AdaptiveGlassView>
        </Pressable>

        <Section title="Privacy">
          <Pressable
            style={[styles.row, styles.rowDivider]}
            accessibilityRole="button"
            accessibilityLabel="App lock settings"
            onPress={() => router.push("/fable/app-lock")}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>App Lock</Text>
              <Text style={styles.rowHint}>
                Require a PIN to open Poffu
              </Text>
            </View>
            <View style={styles.linkRight}>
              <Text style={styles.rowValue}>{appPin ? "On" : "Off"}</Text>
              <SFIcon name="chevron.right" size={20} color={INK_FAINT} />
            </View>
          </Pressable>
          <ToggleRow
            label="Read receipts"
            hint="Let others see when you've read their messages"
            value={readReceipts}
            onChange={(v) => setSettings({ readReceipts: v })}
          />
          <ToggleRow
            label="Typing indicators"
            hint="Show when you're typing a reply"
            value={typingIndicators}
            onChange={(v) => setSettings({ typingIndicators: v })}
            last
          />
        </Section>

        <Section title="Notifications & feedback">
          <ToggleRow
            label="Message notifications"
            value={notifications}
            onChange={onToggleNotifications}
            last
          />
        </Section>

        <Section title="About">
          <View style={[styles.row, styles.rowDivider]}>
            <Text style={styles.rowLabel}>Version</Text>
            <Text style={styles.rowValue}>2.0.0 (liquid glass)</Text>
          </View>
          <Pressable
            style={styles.row}
            accessibilityRole="button"
            accessibilityLabel="Open-source licenses"
            onPress={() => router.push("/licenses")}
          >
            <Text style={styles.rowLabel}>Open-source licenses</Text>
            <SFIcon name="chevron.right" size={20} color={INK_FAINT} />
          </Pressable>
        </Section>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20 },
  title: {
    fontSize: 34,
    fontFamily: "SFProText-Bold",
    letterSpacing: -1,
    color: INK,
    marginBottom: 18,
  },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    padding: 16,
    marginBottom: 6,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(61,146,233,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 24, fontFamily: "SFProText-Bold", color: ACCENT },
  profileText: { flex: 1, marginLeft: 14 },
  profileName: { fontSize: 19, fontFamily: "SFProText-Bold", color: INK },
  section: { marginTop: 22 },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "SFProText-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: INK_SOFT,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: { borderRadius: 22, paddingHorizontal: 16, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(23,25,27,0.08)",
  },
  rowText: { flex: 1, paddingRight: 12 },
  linkRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowLabel: { fontSize: 16, fontFamily: "SFProText-Semibold", color: INK },
  rowHint: {
    fontSize: 13,
    color: INK_SOFT,
    marginTop: 3,
    lineHeight: 18,
  },
  rowValue: { fontSize: 14, color: INK_SOFT },
});
