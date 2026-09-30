import { Image } from "expo-image";
import { StyleSheet } from "react-native";

import { Avatar } from "./avatar";
import { AVATAR_FACES } from "../../data/people";
import { useFable } from "../../data/store";

/**
 * Your avatar, wherever it appears: the photo-library picture when you've
 * set one (a plain iOS-style circle — a real photo needs no glass orb),
 * otherwise your Memoji face sealed in its glass orb.
 */
export function MyAvatar({ size }: { size: number }) {
  const photoUri = useFable((state) => state.profile.photoUri);
  const face = useFable((state) => state.profile.face);

  if (photoUri) {
    return (
      <Image
        source={{ uri: photoUri }}
        style={[styles.photo, { width: size, height: size, borderRadius: size / 2 }]}
        contentFit="cover"
        accessibilityLabel="Your profile photo"
      />
    );
  }
  return <Avatar source={AVATAR_FACES[face]} size={size} />;
}

const styles = StyleSheet.create({
  photo: { backgroundColor: "rgba(23,25,27,0.08)" },
});
