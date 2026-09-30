import { Redirect, useLocalSearchParams } from "expo-router";

/** Retired: the old cookbook conversation now forwards to the real
 *  Kesha-backed conversation screen. */
export default function LegacyFableChatRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Redirect href={{ pathname: "/chat/[id]", params: { id: String(id) } }} />
  );
}
