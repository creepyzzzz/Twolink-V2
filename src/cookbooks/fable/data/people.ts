/**
 * People directory — live profiles from Supabase, not mock data.
 *
 * `Person.avatar` stays a bundled Tapback face (the glass orb renders it
 * exactly as before — zero UI change). Every user maps deterministically to
 * a face from their user id, unless their `avatar_url` pins one
 * ("face:<key>"). A real photo URL (`http…`) is exposed separately as
 * `photoUrl` and renders as the same plain iOS circle MyAvatar uses.
 */

export type StoryState = "unread" | "seen" | "none";

export type Person = {
  /** Supabase auth user id (uuid). */
  id: string;
  name: string;
  first: string;
  /** Bundled Tapback face asset for the glass orb. */
  avatar: number;
  /** Remote photo URL, when the user set a real picture. */
  photoUrl?: string | null;
  username?: string | null;
  about?: string | null;
};

/** Every bundled Tapback face, keyed so the user's pick can be persisted. */
export const AVATAR_FACES = {
  me: require("../../../../assets/cookbooks/fable/avatars/me.webp"),
  amara: require("../../../../assets/cookbooks/fable/avatars/amara.webp"),
  elena: require("../../../../assets/cookbooks/fable/avatars/elena.webp"),
  elias: require("../../../../assets/cookbooks/fable/avatars/elias.webp"),
  fable: require("../../../../assets/cookbooks/fable/avatars/fable.webp"),
  jonas: require("../../../../assets/cookbooks/fable/avatars/jonas.webp"),
  kenji: require("../../../../assets/cookbooks/fable/avatars/kenji.webp"),
  lucas: require("../../../../assets/cookbooks/fable/avatars/lucas.webp"),
  mara: require("../../../../assets/cookbooks/fable/avatars/mara.webp"),
  nia: require("../../../../assets/cookbooks/fable/avatars/nia.webp"),
  rafael: require("../../../../assets/cookbooks/fable/avatars/rafael.webp"),
  sofia: require("../../../../assets/cookbooks/fable/avatars/sofia.webp"),
  theo: require("../../../../assets/cookbooks/fable/avatars/theo.webp"),
  zara: require("../../../../assets/cookbooks/fable/avatars/zara.webp"),
} as const;
export type AvatarFace = keyof typeof AVATAR_FACES;
export const AVATAR_FACE_IDS = Object.keys(AVATAR_FACES) as AvatarFace[];

/** Deterministic bundled face for a user id — stable across devices. */
export function faceForUserId(userId: string): number {
  let h = 0;
  for (let i = 0; i < userId.length; i++)
    h = (Math.imul(h, 31) + userId.charCodeAt(i)) >>> 0;
  return AVATAR_FACES[AVATAR_FACE_IDS[h % AVATAR_FACE_IDS.length]];
}

/**
 * `avatar_url` → bundled face. A "face:<key>" value pins the user's chosen
 * Memoji everywhere; anything else falls back to the deterministic face.
 */
export function faceForAvatarUrl(
  avatarUrl: string | null | undefined,
  userId: string,
): number {
  if (avatarUrl?.startsWith("face:")) {
    const key = avatarUrl.slice(5) as AvatarFace;
    if (key in AVATAR_FACES) return AVATAR_FACES[key];
  }
  return faceForUserId(userId);
}

/** Real photo URL from `avatar_url`, or null when it's a face pin / empty. */
export function photoForAvatarUrl(
  avatarUrl: string | null | undefined,
): string | null {
  if (avatarUrl && avatarUrl.startsWith("http")) return avatarUrl;
  return null;
}

/** Avatar prop: a remote photo wins, otherwise the bundled face. */
export function avatarSource(person: Person): number | { uri: string } {
  return person.photoUrl ? { uri: person.photoUrl } : person.avatar;
}
