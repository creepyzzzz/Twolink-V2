import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { useTheme } from "../hooks/use-theme";
import {
  getAllowMessageRequests,
  getBlockedUsers,
  setAllowMessageRequests,
  unblockUser,
  type DbProfile,
} from "../../../lib/chat";

/**
 * Privacy & Security settings: message-request toggle + blocked users.
 */
export default function PrivacySecurity() {
  const theme = useTheme();
  const [allow, setAllow] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
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
    setAllow(value);
    setSaving(true);
    try {
      await setAllowMessageRequests(value);
    } catch {
      // Revert on failure.
      setAllow(!value);
    } finally {
      setSaving(false);
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
    <>
      <Stack.Screen
        options={{ title: "Privacy & Security", headerBackTitle: "Settings" }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.bg }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12 }}
      >
        <Text
          style={{
            fontSize: 13,
            color: theme.secondary,
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Message requests
        </Text>
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingVertical: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: theme.label, fontSize: 16 }}>
              Allow message requests
            </Text>
            <Text
              style={{
                color: theme.secondary,
                fontSize: 13,
                marginTop: 4,
                lineHeight: 18,
              }}
            >
              {allow
                ? "Anyone can find you in search and send you a message request."
                : "You are hidden from search. Only your friends can message you."}
            </Text>
          </View>
          {loaded ? (
            <Switch
              value={allow}
              onValueChange={onToggle}
              disabled={saving}
              trackColor={{ true: "#3394FA" }}
            />
          ) : (
            <ActivityIndicator size="small" color={theme.secondary} />
          )}
        </View>
        <Text
          style={{
            marginTop: 12,
            fontSize: 13,
            lineHeight: 18,
            color: theme.secondary,
          }}
        >
          When this is off, new people can’t discover you or send you requests.
          Your existing chats and friends are unaffected.
        </Text>

        <Text
          style={{
            fontSize: 13,
            color: theme.secondary,
            marginTop: 28,
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Blocked
        </Text>
        {!blockedLoaded ? (
          <ActivityIndicator size="small" color={theme.secondary} />
        ) : blocked.length === 0 ? (
          <Text style={{ fontSize: 14, color: theme.secondary }}>
            No blocked users.
          </Text>
        ) : (
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            {blocked.map((p, i) => (
              <View
                key={p.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderTopWidth: i === 0 ? 0 : 0.5,
                  borderTopColor: theme.hairline,
                }}
              >
                <Text style={{ flex: 1, fontSize: 16, color: theme.label }}>
                  {p.display_name || "Unknown"}
                </Text>
                <Pressable
                  onPress={() => onUnblock(p.id)}
                  disabled={unblocking === p.id}
                  accessibilityLabel={`Unblock ${p.display_name || "user"}`}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      color: "#3394FA",
                      opacity: unblocking === p.id ? 0.5 : 1,
                    }}
                  >
                    {unblocking === p.id ? "Unblocking…" : "Unblock"}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </>
  );
}
