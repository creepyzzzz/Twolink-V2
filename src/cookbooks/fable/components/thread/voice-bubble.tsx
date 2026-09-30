import {
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioPlayer,
  type AudioSource,
} from "expo-audio";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SFIcon } from "../../../../ui/SFIcon";
import { Type } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";

/** Only one voice message plays at a time — starting a new one stops the old. */
let activePlayer: AudioPlayer | null = null;

const BARS = 32;
const BAR_W = 3;
const BAR_GAP = 2.5;

export function formatVoiceTime(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type Props = {
  source: AudioSource;
  durationSec: number;
  waveform: number[];
  mine: boolean;
};

/**
 * iMessage-style voice message: round play button, waveform bars that fill
 * as it plays, duration label. Lives inside the regular chat bubble.
 */
export function VoiceBubble({ source, durationSec, waveform, mine }: Props) {
  const theme = useTheme();
  const player = useAudioPlayer(source, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const playing = status.playing;

  useEffect(
    () => () => {
      if (activePlayer === player) {
        player.pause();
        activePlayer = null;
      }
    },
    [player],
  );

  const toggle = () => {
    if (playing) {
      player.pause();
      if (activePlayer === player) activePlayer = null;
      return;
    }
    if (activePlayer && activePlayer !== player) activePlayer.pause();
    activePlayer = player;
    const total = status.duration || durationSec;
    if (status.didJustFinish || (total > 0 && status.currentTime >= total - 0.15)) {
      void player.seekTo(0);
    }
    player.play();
  };

  const total = status.duration || durationSec;
  const progress = total > 0 ? Math.min(status.currentTime / total, 1) : 0;
  const bars = waveform.length > 0 ? waveform.slice(0, BARS) : new Array(BARS).fill(0.35);
  const playedCount = Math.round(progress * bars.length);

  const playedColor = mine ? "#FFFFFF" : theme.label;
  const restColor = mine ? "rgba(255,255,255,0.45)" : theme.placeholder;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? "Pause voice message" : "Play voice message"}
        onPress={toggle}
        hitSlop={6}
        style={[
          styles.play,
          { backgroundColor: mine ? "rgba(255,255,255,0.28)" : theme.chip },
        ]}
      >
        <SFIcon
          name={playing ? "pause.fill" : "play.fill"}
          size={14}
          color={mine ? "#FFFFFF" : theme.label}
        />
      </Pressable>
      <View style={styles.wave} accessibilityLabel={`Voice message, ${formatVoiceTime(total)}`}>
        {bars.map((v, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: Math.max(4, Math.min(1, v) * 26),
                backgroundColor: i < playedCount ? playedColor : restColor,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[Type.caption, { color: mine ? "#FFFFFF" : theme.secondary }]}>
        {formatVoiceTime(playing ? status.currentTime : total)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: 208,
    paddingVertical: 2,
  },
  play: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  wave: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: BAR_GAP,
    height: 30,
  },
  bar: {
    width: BAR_W,
    borderRadius: BAR_W / 2,
  },
});
