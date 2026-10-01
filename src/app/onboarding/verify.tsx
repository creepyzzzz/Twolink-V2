import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Accent,
  Space,
  Type,
} from "../../cookbooks/fable/constants/theme";
import { useFable } from "../../cookbooks/fable/data/store";
import { useTheme } from "../../cookbooks/fable/hooks/use-theme";
import { SFIcon } from "../../ui/SFIcon";
import { getSupabase } from "../../lib/supabase";

const RESEND_COOLDOWN = 30;

/**
 * Email sign-in step 2 — verify the 6-digit OTP. Auto-submits when the
 * sixth digit lands. On success the session is persisted (SecureStore) and
 * the user enters the app.
 */
export default function VerifyCode() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const showAlert = useFable((s) => s.showAlert);
  const setOnboarded = useFable((s) => s.setOnboarded);
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);

  const verify = useCallback(
    async (token: string) => {
      if (!email || verifying || token.length !== 6) return;
      setVerifying(true);
      try {
        const { error } = await getSupabase().auth.verifyOtp({
          email,
          token,
          type: "email",
        });
        if (error) throw error;
        setOnboarded(true);
        router.replace("/(tabs)/chats");
      } catch (e) {
        showAlert({
          title: "That code didn't work",
          message:
            e instanceof Error
              ? e.message
              : "The code was wrong or expired. Try again or resend it.",
          actions: [{ text: "OK", style: "cancel" }],
        });
        setCode("");
      } finally {
        setVerifying(false);
      }
    },
    [email, verifying, showAlert, setOnboarded],
  );

  const onChange = (text: string) => {
    const next = text.replace(/[^0-9]/g, "").slice(0, 6);
    setCode(next);
    if (next.length === 6) void verify(next);
  };

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const resend = async () => {
    if (!email || cooldown > 0) return;
    try {
      const { error } = await getSupabase().auth.signInWithOtp({ email });
      if (error) throw error;
      setCooldown(RESEND_COOLDOWN);
    } catch (e) {
      showAlert({
        title: "Couldn't resend the code",
        message:
          e instanceof Error
            ? e.message
            : "Something went wrong. Try again in a bit.",
        actions: [{ text: "OK", style: "cancel" }],
      });
    }
  };

  if (!email) {
    return (
      <View
        style={[
          styles.root,
          styles.center,
          { backgroundColor: theme.bg, paddingTop: insets.top },
        ]}
      >
        <StatusBar style="dark" />
        <Text style={[Type.body, { color: theme.secondary }]}>
          Something went wrong — no email was given.
        </Text>
        <Pressable onPress={() => router.back()} style={styles.textButton}>
          <Text style={[Type.body, { color: Accent }]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <View style={[styles.nav, { paddingTop: insets.top + Space[2] }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={styles.back}
          >
            <SFIcon name="chevron.left" size={20} color={Accent} />
            <Text style={[Type.body, { color: Accent }]}>Back</Text>
          </Pressable>
        </View>
        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.label }]}>
            Check your email
          </Text>
          <Text style={[Type.body, { color: theme.secondary, marginTop: 6 }]}>
            Enter the 6-digit code we sent to{"\n"}
            <Text style={{ color: theme.label }}>{email}</Text>
          </Text>
          <TextInput
            style={[styles.codeInput, { color: theme.label }]}
            value={code}
            onChangeText={onChange}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            textAlign="center"
            placeholder="••••••"
            placeholderTextColor={theme.secondary}
            editable={!verifying}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Verify code"
            onPress={() => void verify(code)}
            disabled={code.length !== 6 || verifying}
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: "#3394FA",
                opacity: code.length !== 6 || verifying ? 0.4 : 1,
              },
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.buttonText}>
              {verifying ? "Verifying…" : "Verify"}
            </Text>
          </Pressable>
          <View style={styles.resendRow}>
            <Text style={[Type.body, { color: theme.secondary }]}>
              Didn&apos;t get the code?{" "}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Resend code"
              onPress={() => void resend()}
              disabled={cooldown > 0}
            >
              <Text
                style={[
                  Type.body,
                  { color: Accent, opacity: cooldown > 0 ? 0.4 : 1 },
                ]}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend"}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    gap: Space[3],
    paddingHorizontal: Space[6],
  },
  nav: {
    paddingHorizontal: Space[4],
    paddingBottom: Space[2],
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    alignSelf: "flex-start",
    paddingVertical: Space[2],
    paddingRight: Space[3],
  },
  content: {
    flex: 1,
    paddingHorizontal: Space[6],
    paddingTop: Space[6],
  },
  title: {
    fontSize: 24,
    fontFamily: "SFProText-Bold",
    letterSpacing: -0.5,
  },
  codeInput: {
    fontSize: 32,
    fontFamily: "SFProText-Medium",
    letterSpacing: 12,
    marginTop: Space[8],
    paddingLeft: 12, // recenter: letterSpacing adds trailing space
  },
  button: {
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Space[6],
  },
  pressed: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 15,
    fontFamily: "SFProText-Medium",
    letterSpacing: -0.2,
    color: "#FFFFFF",
  },
  resendRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: Space[5],
  },
  textButton: {
    paddingVertical: Space[2],
    paddingHorizontal: Space[4],
  },
});
