import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SvgXml } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Accent,
  Space,
  Type,
} from "../../cookbooks/fable/constants/theme";
import { useFable } from "../../cookbooks/fable/data/store";
import { useTheme } from "../../cookbooks/fable/hooks/use-theme";
import { isSupabaseConfigured } from "../../lib/supabase";

const GOOGLE_G = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>`;

const ENVELOPE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4.5 7.5 7.5 6 7.5-6"/></svg>`;

const POFFU_BLUE = "#3394FA";

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

/**
 * Screen 2 — top half: the cheering sea-creature trio, animated with real
 * body movement in a slow seamless loop. Bottom half: Google + email sign-in
 * in the app's iOS style, with a gradient melting the art into the auth area
 * (no hard boundary). Email sign-in is wired through Supabase OTP; Google is
 * still UI-only.
 */
export default function Login() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const showAlert = useFable((s) => s.showAlert);
  const setOnboarded = useFable((s) => s.setOnboarded);

  const player = useVideoPlayer(
    require("../../../assets/auth/login-trio.mp4"),
    (p) => {
      p.loop = true;
      p.muted = true;
      void p.play();
    },
  );

  const comingSoon = (method: string) =>
    showAlert({
      title: `${method} sign-in`,
      message:
        "Auth isn't wired up yet. Skip for now to look around — sign-in lands next.",
      actions: [{ text: "OK", style: "cancel" }],
    });

  const continueWithEmail = () => {
    if (!isSupabaseConfigured()) {
      showAlert({
        title: "Email sign-in",
        message:
          "Email sign-in isn't set up in this build yet — the Supabase keys are missing. Add them to .env and reload.",
        actions: [{ text: "OK", style: "cancel" }],
      });
      return;
    }
    router.push("/onboarding/email");
  };

  const skip = () => {
    setOnboarded(true);
    router.replace("/(tabs)/chats");
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
      <View style={[styles.content, { paddingBottom: insets.bottom + Space[6] }]}>
        <Text style={[styles.title, { color: theme.label }]}>
          Welcome to Poffu
        </Text>
        <Text style={[Type.body, { color: theme.secondary, marginTop: 6 }]}>
          Chat with the people who matter.
        </Text>
        <View style={styles.buttons}>
          <AuthButton
            label="Continue with Google"
            icon={<SvgXml xml={GOOGLE_G} width={20} height={20} />}
            onPress={() => comingSoon("Google")}
          />
          <AuthButton
            label="Continue with Email"
            primary
            icon={<SvgXml xml={ENVELOPE} width={20} height={20} />}
            onPress={continueWithEmail}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip for now"
          onPress={skip}
          style={styles.skip}
        >
          <Text style={[Type.body, { color: Accent }]}>Skip for now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
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
    fontSize: 24,
    fontFamily: "SFProText-Bold",
    letterSpacing: -0.5,
  },
  buttons: {
    marginTop: Space[6],
    gap: Space[3],
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
  pressed: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 15,
    fontFamily: "SFProText-Medium",
    letterSpacing: -0.2,
  },
  skip: {
    marginTop: Space[5],
    alignSelf: "center",
    paddingVertical: Space[2],
    paddingHorizontal: Space[4],
  },
});
