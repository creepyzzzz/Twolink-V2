import { create } from "zustand";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";
import type { Person } from "./people";
import { useFable } from "./store";

type StoryState = { active: Person | null; seen: string[]; liked: string[] };
const useStories = create<StoryState>(() => ({
  active: null,
  seen: [],
  liked: [],
}));
export function markStorySeen(id: string) {
  useStories.setState((state) =>
    state.seen.includes(id) ? state : { seen: [...state.seen, id] },
  );
}
export function useStorySeen(id: string) {
  return useStories((state) => state.seen.includes(id));
}
export function openStory(person: Person) {
  useStories.setState({ active: person });
}
export function closeStory() {
  useStories.setState({ active: null });
}
export function useActiveStory() {
  return useStories((state) => state.active);
}
export function useStoryLiked(id: string) {
  return useStories((state) => state.liked.includes(id));
}
export function toggleStoryLike(id: string) {
  useStories.setState((state) => ({
    liked: state.liked.includes(id)
      ? state.liked.filter((key) => key !== id)
      : [...state.liked, id],
  }));
}

/** Posts a photo-library picture to your story. Shared by the rail cell and the viewer. */
export async function pickAndPostStory() {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert("Photos", "Allow photo access to post to your story.");
    return;
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.9,
  });
  if (res.canceled || res.assets.length === 0) return;
  useFable.getState().postStory(res.assets[0].uri);
}
