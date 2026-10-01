import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useVideoPlayer, VideoView } from "expo-video";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { SvgXml } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Accent,
  Space,
  Type,
} from "../../cookbooks/fable/constants/theme";
import { useFable } from "../../cookbooks/fable/data/store";
import { useTheme } from "../../cookbooks/fable/hooks/use-theme";
import { getSupabase, isSupabaseConfigured } from "../../lib/supabase";

const GOOGLE_G = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>`;

const ENVELOPE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4.5 7.5 7.5 6 7.5-6"/></svg>`;

const POFFU_BLUE = "#3394FA";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = "idle" | "form" | "code";

function AuthButton({
  label,
  icon,
  primary,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  primary?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: primary ? POFFU_BLUE : theme.surface,
          borderColor: primary ? "transparent" : theme.hairline,
        },
        pressed && styles.pressed,
      ]}
    >
      {icon}
      <Text
        style={[
          styles.buttonText,
          { color: primary ? "#FFFFFF" : theme.label },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function BackLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onPress}
      style={styles.backLink}
    >
      <Text style={[Type.body, { color: Accent }]}>Back</Text>
    </Pressable>
  );
}

/**
 * Screen 2 — top half: the cheering sea-creature trio, animated with real
 * body movement in a slow seamless loop. Bottom half morphs in place through
 * three states (no new pages): provider buttons -> email+password form ->
 * 6-digit code entry. Email+password is real Supabase auth: existing accounts
 * sign in, new addresses create an account. Google is still UI-only.
 */
export default function Login() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const showAlert = useFable((s) => s.showAlert);
  const setOnboarded = useFable((s) => s.setOnboarded);

  const [step, setStep] = useState<Step>("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const player = useVideoPlayer(
    require("../../../assets/auth/login-trio.mp4"),
    (p) => {
      p.loop = true;
      p.muted = true;
      void p.play();
    },
  );

  const valid = EMAIL_RE.test(email.trim()) && password.length >= 6;

  const done = () => {
    setOnboarded(true);
    router.replace("/(tabs)/chats");
  };

  const fail = (title: string, e: unknown, fallback: string) =>
    showAlert({
      title,
      message: e instanceof Error ? e.message : fallback,
      actions: [{ text: "OK", style: "cancel" }],
    });

  const comingSoon = () =>
    showAlert({
      title: "Google sign-in",
      message: "Google sign-in isn't wired up yet — use email below for now.",
      actions: [{ text: "OK", style: "cancel" }],
    });

  const startEmail = () => {
    if (!isSupabaseConfigured()) {
      showAlert({
        title: "Email sign-in",
        message:
          "Email sign-in isn't set up in this build yet — the Supabase keys are missing. Add them to .env and reload.",
        actions: [{ text: "OK", style: "cancel" }],
      });
      return;
    }
    setStep("form");
  };

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const supabase = getSupabase();
      const creds = { email: email.trim(), password };
      const { error: signInError } =
        await supabase.auth.signInWithPassword(creds);
      if (!signInError) {
        done();
        return;
      }
      if (signInError.message !== "Invalid login credentials")
        throw signInError;
      // No account with these credentials — create one.
      const { data, error: signUpError } = await supabase.auth.signUp(creds);
      if (signUpError) {
        if (/already registered/i.test(signUpError.message))
          throw new Error("Incorrect password for this email.");
        throw signUpError;
      }
      if (data.session) {
        done();
        return;
      }
      // Email confirmation is on — the 6-digit code is on its way.
      setCode("");
      setStep("code");
    } catch (e) {
      fail("Couldn't sign you in", e, "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const onCodeChange = (text: string) => {
    const next = text.replace(/[^0-9]/g, "").slice(0, 6);
    setCode(next);
    if (next.length === 6) void verifyCode(next);
  };

  const verifyCode = async (token: string) => {
    if (token.length !== 6 || verifying) return;
    setVerifying(true);
    try {
      const { error } = await getSupabase().auth.verifyOtp({
        email: email.trim(),
        token,
        type: "signup",
      });
      if (error) throw error;
      done();
    } catch (e) {
      fail(
        "That code didn't work",
        e,
        "The code was wrong or expired. Try again.",
      );
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  const artHeight = Math.round(height * 0.5);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <StatusBar style="dark" />
      <View style={[styles.artWrap, { height: artHeight }]}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />
        <LinearGradient
          colors={["transparent", theme.bg]}
          style={styles.fade}
          pointerEvents="none"
        />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <View
          style={[styles.content, { paddingBottom: insets.bottom + Space[4] }]}
        >
          {step === "idle" ? (
            <Animated.View
              key="idle"
              entering={FadeInDown.duration(220)}
              exiting={FadeOutUp.duration(180)}
            >
              <Text style={[styles.title, { color: theme.label }]}>
                Welcome to Poffu
              </Text>
              <Text style={[styles.subtitle, { color: theme.secondary }]}>
                Chat with the people who matter.
              </Text>
              <View style={styles.buttons}>
                <AuthButton
                  label="Continue with Google"
                  icon={<SvgXml xml={GOOGLE_G} width={20} height={20} />}
                  onPress={comingSoon}
                />
                <AuthButton
                  label="Continue with Email"
                  primary
                  icon={<SvgXml xml={ENVELOPE} width={20} height={20} />}
                  onPress={startEmail}
                />
              </View>
            </Animated.View>
          ) : step === "form" ? (
            <Animated.View
              key="form"
              entering={FadeInDown.duration(220)}
              exiting={FadeOutUp.duration(180)}
            >
              <Text style={[styles.title, { color: theme.label }]}>
                Continue with Email
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
                placeholder="Email"
                placeholderTextColor={theme.secondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                textContentType="emailAddress"
                returnKeyType="next"
              />
              <View
                style={[
                  styles.input,
                  styles.passwordRow,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.hairline,
                  },
                ]}
              >
                <TextInput
                  style={[styles.passwordInput, { color: theme.label }]}
                  placeholder="Password (6+ characters)"
                  placeholderTextColor={theme.secondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={() => void submit()}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  onPress={() => setShowPassword((s) => !s)}
                  style={styles.showToggle}
                >
                  <Text style={[styles.showText, { color: Accent }]}>
                    {showPassword ? "Hide" : "Show"}
                  </Text>
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Continue"
                onPress={() => void submit()}
                disabled={!valid || busy}
                style={({ pressed }) => [
                  styles.button,
                  styles.primaryButton,
                  { opacity: !valid || busy ? 0.4 : 1 },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.buttonText, { color: "#FFFFFF" }]}>
                  {busy ? "Signing in…" : "Continue"}
                </Text>
              </Pressable>
              <BackLink onPress={() => setStep("idle")} />
            </Animated.View>
          ) : (
            <Animated.View
              key="code"
              entering={FadeInDown.duration(220)}
              exiting={FadeOutUp.duration(180)}
            >
              <Text style={[styles.title, { color: theme.label }]}>
                Check your email
              </Text>
              <Text style={[styles.subtitle, { color: theme.secondary }]}>
                Enter the 6-digit code we sent to{"\n"}
                <Text style={{ color: theme.label }}>{email.trim()}</Text>
              </Text>
              <TextInput
                style={[styles.codeInput, { color: theme.label }]}
                value={code}
                onChangeText={onCodeChange}
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
                onPress={() => void verifyCode(code)}
                disabled={code.length !== 6 || verifying}
                style={({ pressed }) => [
                  styles.button,
                  styles.primaryButton,
                  { opacity: code.length !== 6 || verifying ? 0.4 : 1 },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.buttonText, { color: "#FFFFFF" }]}>
                  {verifying ? "Verifying…" : "Verify"}
                </Text>
              </Pressable>
              <BackLink onPress={() => setStep("form")} />
            </Animated.View>
          )}
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
  artWrap: {
    width: "100%",
    overflow: "hidden",
  },
  fade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 140,
  },
  content: {
    flex: 1,
    paddingHorizontal: Space[6],
    paddingTop: Space[2],
  },
  title: {
    fontSize: 22,
    fontFamily: "SFProText-Bold",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "SFProText-Regular",
    letterSpacing: -0.2,
    textAlign: "center",
    marginTop: 4,
  },
  buttons: {
    marginTop: Space[4],
    gap: Space[2],
  },
  button: {
    height: 52,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryButton: {
    backgroundColor: POFFU_BLUE,
    borderColor: "transparent",
    marginTop: Space[4],
  },
  pressed: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 15,
    fontFamily: "SFProText-Medium",
    letterSpacing: -0.2,
  },
  input: {
    height: 52,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Space[5],
    fontSize: 16,
    fontFamily: "SFProText-Regular",
    marginTop: Space[3],
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: Space[2],
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "SFProText-Regular",
    height: "100%",
  },
  showToggle: {
    paddingVertical: Space[2],
    paddingHorizontal: Space[3],
  },
  showText: {
    fontSize: 13,
    fontFamily: "SFProText-Medium",
  },
  codeInput: {
    fontSize: 32,
    fontFamily: "SFProText-Medium",
    letterSpacing: 12,
    marginTop: Space[6],
    paddingLeft: 12, // recenter: letterSpacing adds trailing space
    textAlign: "center",
  },
  backLink: {
    marginTop: Space[3],
    alignSelf: "center",
    paddingVertical: Space[2],
    paddingHorizontal: Space[4],
  },
});
