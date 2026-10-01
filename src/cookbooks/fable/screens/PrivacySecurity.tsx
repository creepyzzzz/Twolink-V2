import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { useTheme } from "../hooks/use-theme";
import {
  getAllowMessageRequests,
  setAllowMessageRequests,
} from "../../../lib/chat";

/**
 * Privacy & Security settings. For now: who can send me message requests.
 */
export default function PrivacySecurity() {
  const theme = useTheme();
  const [allow, setAllow] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

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
      </ScrollView>
    </>
  );
}
