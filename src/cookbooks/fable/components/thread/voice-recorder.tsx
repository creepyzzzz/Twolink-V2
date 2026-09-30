import {
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { SFIcon } from "../../../../ui/SFIcon";
import { Type } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";
import { formatVoiceTime } from "./voice-bubble";

const MAX_SEC = 120;
const LIVE_BARS = 28;

/** dB metering (~-50..0) -> 0..1 bar height. */
function level(metering: number) {
  return Math.max(0.12, Math.min(1, (metering + 45) / 45));
}

type Props = {
  onSend: (uri: string, durationSec: number, waveform: number[]) => void;
  onCancel: () => void;
};

/**
 * iMessage-style recording bar: pulsing red dot, live timer, the waveform
 * being drawn as you speak, trash to discard, blue arrow to send.
 * Starts recording on mount; the composer swaps this in for the text input.
 */
export function VoiceRecorder({ onSend, onCancel }: Props) {
  const theme = useTheme();
  const samples = useRef<number[]>([]);
  const lastFlush = useRef(0);
  const [live, setLive] = useState<number[]>([]);
  const done = useRef(false);
  // Plain-object refs (same pattern as photo-viewer): always call the
  // latest callbacks from async work without re-subscribing effects.
  const onCancelRef = { current: onCancel };
  onCancelRef.current = onCancel;
  const onSendRef = { current: onSend };
  onSendRef.current = onSend;

  const recordOptions = useMemo(
    () => ({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true }),
    [],
  );
  const recorder = useAudioRecorder(recordOptions);
  const { isRecording, durationMillis, metering } =
    useAudioRecorderState(recorder);
  const durationRef = useRef(0);
  useEffect(() => {
    durationRef.current = durationMillis;
  }, [durationMillis]);

  const finish = useCallback(
    async (send: boolean) => {
      if (done.current) return;
      done.current = true;
      try {
        await recorder.stop();
      } catch {
        onCancelRef.current();
        return;
      }
      const uri = recorder.uri;
      if (send && uri) {
        const secs = Math.max(1, Math.round(durationRef.current / 1000));
        // Downsample to a stable bar count for the bubble.
        const src = samples.current;
        const step = Math.max(1, Math.floor(src.length / 32));
        const waveform: number[] = [];
        for (let i = 0; i < src.length && waveform.length < 32; i += step) {
          const v = src[i];
          if (v != null) waveform.push(v);
        }
        onSendRef.current(uri, secs, waveform.length ? waveform : [0.4]);
      } else {
        onCancelRef.current();
      }
    },
    // Plain-object refs are intentional: identity churn is irrelevant since
    // only .current is read, and it always holds the latest callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recorder],
  );

  // Collect metering into the waveform, throttling re-renders.
  useEffect(() => {
    if (!isRecording || metering == null) return;
    samples.current.push(level(metering));
    if (samples.current.length > 96) samples.current.shift();
    const now = Date.now();
    if (now - lastFlush.current > 150) {
      lastFlush.current = now;
      setLive(samples.current.slice(-LIVE_BARS));
    }
  }, [isRecording, metering]);

  // Safety cap: never record longer than MAX_SEC.
  useEffect(() => {
    if (isRecording && durationMillis >= MAX_SEC * 1000) void finish(true);
  }, [isRecording, durationMillis, finish]);

  const pulse = useSharedValue(1);
  const dotStyle = useAnimatedStyle(() => ({
    opacity: pulse.get(),
    transform: [{ scale: 0.8 + 0.2 * pulse.get() }],
  }));

  useEffect(() => {
    pulse.set(
      withRepeat(
        withTiming(0.35, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
    let alive = true;
    (async () => {
      try {
        await setAudioModeAsync({ allowsRecording: true });
        if (alive) recorder.record();
      } catch {
        if (alive) onCancelRef.current();
      }
    })();
    return () => {
      alive = false;
      if (recorder.isRecording) void recorder.stop().catch(() => {});
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Discard recording"
        onPress={() => void finish(false)}
        hitSlop={6}
        style={[styles.round, { backgroundColor: theme.chip }]}
      >
        <SFIcon name="trash" size={17} color={theme.label} />
      </Pressable>
      <Animated.View style={[styles.dot, dotStyle]} />
      <Text style={[Type.body, styles.timer, { color: theme.label }]}>
        {formatVoiceTime(durationMillis / 1000)}
      </Text>
      <View style={styles.wave}>
        {live.map((v, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              { height: Math.max(4, v * 24), backgroundColor: theme.secondary },
            ]}
          />
        ))}
        {!isRecording && live.length === 0 && (
          <Text style={[Type.caption, { color: theme.placeholder }]}>
            Starting…
          </Text>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send voice message"
        onPress={() => void finish(true)}
        hitSlop={6}
        style={[styles.round, { backgroundColor: theme.outgoing }]}
      >
        <SFIcon name="arrow.up" size={17} color={theme.outgoingText} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 56,
  },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FF3B30",
  },
  timer: {
    fontVariant: ["tabular-nums"],
    minWidth: 44,
  },
  wave: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 2.5,
    height: 30,
  },
  bar: {
    width: 3,
    borderRadius: 1.5,
  },
});
