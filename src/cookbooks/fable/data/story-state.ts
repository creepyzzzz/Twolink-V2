import { create } from "zustand";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

import { markStoryViewed, postStoryDb, uploadStoryMedia } from "../../../lib/chat";
import { useFable } from "./store";

type StoryState = {
  /** The user whose stories are open in the viewer, or null. */
  activeUserId: string | null;
  liked: string[];
  uploadingUri: string | null;
};

const useStories = create<StoryState>(() => ({
  activeUserId: null,
  liked: [],
  uploadingUri: null,
}));

/** Mark one story viewed locally (server flag set by the viewer too). */
export function markStorySeen(id: string) {
  useFable.setState((state) => ({
    stories: state.stories.map((s) =>
      s.id === id ? { ...s, viewed: true } : s,
    ),
  }));
  void markStoryViewed(id).catch(() => {});
}

export function openStory(userId: string) {
  useStories.setState({ activeUserId: userId });
}
export function closeStory() {
  useStories.setState({ activeUserId: null });
}
export function useActiveStoryUserId() {
  return useStories((state) => state.activeUserId);
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
export function useStoryUploadingUri() {
  return useStories((state) => state.uploadingUri);
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
  try {
    useStories.setState({ uploadingUri: res.assets[0].uri });
    const publicUrl = await uploadStoryMedia(res.assets[0].uri);
    await postStoryDb(publicUrl);
    await useFable.getState().refreshStories();
  } catch {
    useFable.getState().showAlert({
      title: "Couldn't post story",
      message: "Check your connection and try again.",
      actions: [{ text: "OK", style: "default" }],
    });
  } finally {
    useStories.setState({ uploadingUri: null });
  }
}
