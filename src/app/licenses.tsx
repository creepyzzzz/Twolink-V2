import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SFIcon } from "../ui/SFIcon";
import { AdaptiveGlassView } from "../ui/GlassView";
import { ScreenBackground } from "../ui/ScreenBackground";

const INK = "#17191B";
const INK_SOFT = "rgba(23,25,27,0.55)";
const INK_FAINT = "rgba(23,25,27,0.35)";

type License = { name: string; version: string; license: string };

/** Generated from package.json + node_modules on 2026-09-30. */
const LICENSES: License[] = [
  { name: "@gluestack-ui/button", version: "1.0.14", license: "MIT" },
  { name: "@kesha-antonov/react-native-chat", version: "5.0.1", license: "MIT" },
  { name: "@shopify/flash-list", version: "2.0.2", license: "MIT" },
  { name: "@shopify/react-native-skia", version: "2.6.2", license: "MIT" },
  { name: "@supabase/supabase-js", version: "2.117.2", license: "MIT" },
  { name: "expo", version: "57.0.26", license: "MIT" },
  { name: "expo-android-glass-view", version: "1.0.0", license: "Apache-2.0" },
  { name: "expo-asset", version: "57.0.18", license: "MIT" },
  { name: "expo-blur", version: "57.0.3", license: "MIT" },
  { name: "expo-build-properties", version: "57.0.22", license: "MIT" },
  { name: "expo-constants", version: "57.0.20", license: "MIT" },
  { name: "expo-dev-client", version: "57.0.19", license: "MIT" },
  { name: "expo-font", version: "57.0.4", license: "MIT" },
  { name: "expo-glass-effect", version: "57.0.4", license: "MIT" },
  { name: "expo-image", version: "57.0.5", license: "MIT" },
  { name: "expo-image-picker", version: "57.0.20", license: "MIT" },
  { name: "expo-linear-gradient", version: "57.0.2", license: "MIT" },
  { name: "expo-linking", version: "57.0.11", license: "MIT" },
  { name: "expo-router", version: "57.0.24", license: "MIT" },
  { name: "expo-splash-screen", version: "57.0.9", license: "MIT" },
  { name: "expo-status-bar", version: "57.0.1", license: "MIT" },
  { name: "expo-symbols", version: "57.0.3", license: "MIT" },
  { name: "react", version: "19.2.3", license: "MIT" },
  { name: "react-dom", version: "19.2.3", license: "MIT" },
  { name: "react-native", version: "0.86.3", license: "MIT" },
  { name: "react-native-gesture-handler", version: "2.32.0", license: "MIT" },
  { name: "react-native-keyboard-controller", version: "1.21.9", license: "MIT" },
  { name: "react-native-mmkv", version: "4.3.2", license: "MIT" },
  { name: "react-native-nitro-modules", version: "0.37.1", license: "MIT" },
  { name: "react-native-reanimated", version: "4.5.1", license: "MIT" },
  { name: "react-native-safe-area-context", version: "5.7.0", license: "MIT" },
  { name: "react-native-screens", version: "4.26.2", license: "MIT" },
  { name: "react-native-svg", version: "15.15.4", license: "MIT" },
  { name: "react-native-web", version: "0.21.3", license: "MIT" },
  { name: "react-native-worklets", version: "0.10.1", license: "MIT" },
  { name: "zustand", version: "5.0.15", license: "MIT" },
  // Bundled assets (not npm deps):
  { name: "Tapback 3D Memojis", version: "bundled", license: "MIT" },
  { name: "SF Symbols vectors", version: "extracted", license: "Apple" },
];

export default function LicensesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <ScreenBackground>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.back}
        >
          <SFIcon name="chevron.left" size={22} color={INK} />
        </Pressable>
        <Text style={styles.title}>Open-source licenses</Text>
        <View style={styles.back} />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <AdaptiveGlassView
          style={styles.card}
          tintColor="rgba(255,255,255,0.55)"
          blurRadius={18}
        >
          {LICENSES.map((item, i) => (
            <View
              key={item.name}
              style={[styles.row, i < LICENSES.length - 1 && styles.rowDivider]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowLabel} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.rowHint}>{item.version}</Text>
              </View>
              <Text style={styles.license}>{item.license}</Text>
            </View>
          ))}
        </AdaptiveGlassView>
        <Text style={styles.footnote}>
          Poffu is built on these open-source projects. Full license texts
          ship with their packages.
        </Text>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700", color: INK },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  card: { borderRadius: 22, paddingHorizontal: 18 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(23,25,27,0.12)" },
  rowText: { flex: 1, marginRight: 12 },
  rowLabel: { fontSize: 15, fontWeight: "600", color: INK },
  rowHint: { fontSize: 13, color: INK_FAINT, marginTop: 2 },
  license: { fontSize: 13, fontWeight: "600", color: INK_SOFT },
  footnote: {
    fontSize: 13,
    color: INK_FAINT,
    textAlign: "center",
    marginTop: 16,
    paddingHorizontal: 24,
    lineHeight: 18,
  },
});
