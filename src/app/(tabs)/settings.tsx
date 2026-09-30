import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AndroidGlassSlider,
  AndroidGlassToggle,
} from "expo-android-glass-view";
import { SFIcon } from "../../ui/SFIcon";
import { AdaptiveGlassView } from "../../ui/GlassView";
import { ScreenBackground } from "../../ui/ScreenBackground";

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
  const [readReceipts, setReadReceipts] = useState(true);
  const [typingIndicators, setTypingIndicators] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [glassIntensity, setGlassIntensity] = useState(0.55);

  return (
    <ScreenBackground>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Settings</Text>

        {/* Profile */}
        <AdaptiveGlassView
          style={styles.profile}
          tintColor="rgba(255,255,255,0.55)"
          blurRadius={18}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>T</Text>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.profileName}>Tariq</Text>
            <Text style={styles.profileSub}>TwoLink private build</Text>
          </View>
          <SFIcon name="chevron.right" size={20} color={INK_FAINT} />
        </AdaptiveGlassView>

        <Section title="Privacy">
          <ToggleRow
            label="Read receipts"
            hint="Let others see when you've read their messages"
            value={readReceipts}
            onChange={setReadReceipts}
          />
          <ToggleRow
            label="Typing indicators"
            hint="Show when you're typing a reply"
            value={typingIndicators}
            onChange={setTypingIndicators}
            last
          />
        </Section>

        <Section title="Notifications & feedback">
          <ToggleRow
            label="Message notifications"
            value={notifications}
            onChange={setNotifications}
            last
          />
        </Section>

        <Section title="Appearance">
          <View style={styles.sliderBlock}>
            <View style={styles.sliderHeader}>
              <Text style={styles.rowLabel}>Glass intensity</Text>
              <Text style={styles.sliderValue}>
                {Math.round(glassIntensity * 100)}%
              </Text>
            </View>
            <AndroidGlassSlider
              value={glassIntensity}
              minimumValue={0}
              maximumValue={1}
              onValueChange={setGlassIntensity}
              accentColor={ACCENT}
              style={styles.slider}
            />
            {/* Live preview: the same native glass, driven by the slider. */}
            <AdaptiveGlassView
              style={styles.preview}
              tintColor="rgba(61,146,233,0.12)"
              blurRadius={4 + glassIntensity * 26}
              refractionAmount={6 + glassIntensity * 22}
            >
              <Text style={styles.previewText}>
                Drag the slider — this card re-renders live.
              </Text>
            </AdaptiveGlassView>
          </View>
        </Section>

        <Section title="About">
          <View style={[styles.row, styles.rowDivider]}>
            <Text style={styles.rowLabel}>Version</Text>
            <Text style={styles.rowValue}>2.0.0 (liquid glass)</Text>
          </View>
          <Pressable style={styles.row} accessibilityRole="button">
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
    fontWeight: "800",
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
  avatarText: { fontSize: 24, fontWeight: "700", color: ACCENT },
  profileText: { flex: 1, marginLeft: 14 },
  profileName: { fontSize: 19, fontWeight: "700", color: INK },
  profileSub: { fontSize: 13, color: INK_SOFT, marginTop: 2 },
  section: { marginTop: 22 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
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
  rowLabel: { fontSize: 16, fontWeight: "600", color: INK },
  rowHint: {
    fontSize: 13,
    color: INK_SOFT,
    marginTop: 3,
    lineHeight: 18,
  },
  rowValue: { fontSize: 14, color: INK_SOFT },
  sliderBlock: { paddingVertical: 8 },
  sliderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  sliderValue: { fontSize: 14, fontWeight: "700", color: ACCENT },
  slider: { marginVertical: 4 },
  preview: {
    borderRadius: 18,
    padding: 18,
    marginTop: 10,
    alignItems: "center",
  },
  previewText: {
    fontSize: 14,
    color: "rgba(23,25,27,0.75)",
    textAlign: "center",
    lineHeight: 20,
  },
});
