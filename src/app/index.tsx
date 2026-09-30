import { Redirect } from "expo-router";
import { useFable } from "../cookbooks/fable/data/store";

export default function Index() {
  const onboarded = useFable((s) => s.onboarded);
  // The root layout waits for store hydration before rendering, so the
  // persisted flag is reliable here.
  return (
    <Redirect href={onboarded ? "/(tabs)/chats" : "/onboarding/welcome"} />
  );
}
