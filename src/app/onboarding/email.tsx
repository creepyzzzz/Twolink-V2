import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
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
  Ink,
  Space,
  Type,
} from "../../cookbooks/fable/constants/theme";
import { useFable } from "../../cookbooks/fable/data/store";
import { useTheme } from "../../cookbooks/fable/hooks/use-theme";
import { SFIcon } from "../../ui/SFIcon";
import { getSupabase, isSupabaseConfigured } from "../../lib/supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email sign-in step 1 — collect the address, send a 6-digit OTP through
 * Supabase Auth, then push to /onboarding/verify. Same iOS styling as the
 * login screen (pill button, SF type, light-only).
 */
export default function EmailSignIn() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const showAlert = useFable((s) => s.showAlert);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const valid = EMAIL_RE.test(email.trim());

  const sendCode = async () => {
    if (!valid || sending) return;
    if (!isSupabaseConfigured()) {
      showAlert({
        title: "Email sign-in",
        message:
          "Email sign-in isn't set up in this build yet — the Supabase keys are missing. Add them to .env and reload.",
        actions: [{ text: "OK", style: "cancel" }],
      });
      return;
    }
    setSending(true);
    try {
      const { error } = await getSupabase().auth.signInWithOtp({
        email: email.trim(),
      });
      if (error) throw error;
      router.push({
        pathname: "/onboarding/verify",
        params: { email: email.trim() },
      });
    } catch (e) {
      showAlert({
        title: "Couldn't send the code",
        message:
          e instanceof Error
            ? e.message
            : "Something went wrong. Check your connection and try again.",
        actions: [{ text: "OK", style: "cancel" }],
      });
    } finally {
      setSending(false);
    }
  };

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
            What&apos;s your email?
          </Text>
          <Text style={[Type.body, { color: theme.secondary, marginTop: 6 }]}>
            We&apos;ll send you a 6-digit code to sign in. No password needed.
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.surface,
                borderColor: theme.hairline,
                color: theme.label,
              },
            ]}
            placeholder="you@example.com"
            placeholderTextColor={theme.secondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            returnKeyType="go"
            onSubmitEditing={() => void sendCode()}
            textContentType="emailAddress"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send code"
            onPress={() => void sendCode()}
            disabled={!valid || sending}
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: Ink,
                opacity: !valid || sending ? 0.4 : 1,
              },
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.buttonText}>
              {sending ? "Sending…" : "Continue"}
            </Text>
          </Pressable>
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
    fontSize: 28,
    fontFamily: "SFProText-Bold",
    letterSpacing: -0.5,
  },
  input: {
    height: 56,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Space[5],
    fontSize: 17,
    fontFamily: "SFProText-Regular",
    marginTop: Space[6],
  },
  button: {
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Space[4],
  },
  pressed: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 17,
    fontFamily: "SFProText-Medium",
    letterSpacing: -0.2,
    color: "#FFFFFF",
  },
});
