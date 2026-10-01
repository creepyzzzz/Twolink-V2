import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AndroidGlassToggle } from "expo-android-glass-view";
import { AdaptiveGlassView } from "../../../ui/GlassView";
import {
  getAllowMessageRequests,
  getBlockedUsers,
  setAllowMessageRequests,
  unblockUser,
  type DbProfile,
} from "../../../lib/chat";

const ACCENT = "#3D92E9";
const INK = "#17191B";
const INK_SOFT = "rgba(23,25,27,0.55)";

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

/**
 * Privacy & Security settings: message-request toggle + blocked users.
 * Matches the bottom-tab Settings glass design.
 */
export default function PrivacySecurity() {
  const insets = useSafeAreaInsets();
  const [allow, setAllow] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [blocked, setBlocked] = useState<DbProfile[]>([]);
  const [blockedLoaded, setBlockedLoaded] = useState(false);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAllowMessageRequests()
      .then((v) => {
        if (!cancelled) {
          setAllow(v);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    getBlockedUsers()
      .then((users) => {
        if (!cancelled) {
          setBlocked(users);
          setBlockedLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setBlockedLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onToggle = async (value: boolean) => {
    const prev = allow;
    setAllow(value);
    try {
      await setAllowMessageRequests(value);
    } catch {
      setAllow(prev);
    }
  };

  const onUnblock = async (userId: string) => {
    setUnblocking(userId);
    try {
      await unblockUser(userId);
      setBlocked((list) => list.filter((p) => p.id !== userId));
    } catch {
      // Keep the row on failure.
    } finally {
      setUnblocking(null);
    }
  };

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: "Privacy & Security",
          headerBackTitle: "Settings",
        }}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Section title="Message requests">
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Allow message requests</Text>
            </View>
            {loaded ? (
              <AndroidGlassToggle
                value={allow}
                onValueChange={onToggle}
                accentColor={ACCENT}
              />
            ) : (
              <ActivityIndicator size="small" color={INK_SOFT} />
            )}
          </View>
        </Section>

        <Section title="Blocked">
          {!blockedLoaded ? (
            <View style={styles.row}>
              <ActivityIndicator size="small" color={INK_SOFT} />
            </View>
          ) : blocked.length === 0 ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>No blocked users</Text>
            </View>
          ) : (
            blocked.map((p, i) => (
              <View
                key={p.id}
                style={[styles.row, i < blocked.length - 1 && styles.rowDivider]}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>
                    {p.display_name || "Unknown"}
                  </Text>
                </View>
                <Pressable
                  onPress={() => onUnblock(p.id)}
                  disabled={unblocking === p.id}
                  accessibilityLabel={`Unblock ${p.display_name || "user"}`}
                  hitSlop={8}
                >
                  <Text
                    style={[
                      styles.unblock,
                      unblocking === p.id && styles.unblockDisabled,
                    ]}
                  >
                    {unblocking === p.id ? "Unblocking…" : "Unblock"}
                  </Text>
                </Pressable>
              </View>
            ))
          )}
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F2F3F5" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12 },
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
  rowLabel: { fontSize: 16, fontFamily: "SFProText-Semibold", color: INK },
  unblock: {
    fontSize: 15,
    fontFamily: "SFProText-Semibold",
    color: ACCENT,
  },
  unblockDisabled: { opacity: 0.5 },
});
