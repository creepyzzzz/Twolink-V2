import Inbox from "../../cookbooks/fable/screens/Inbox";
import { StoryHost } from "../../cookbooks/fable/components/stories/story-viewer";

/** Chats tab: the fable inbox (stories rail + chat list) with the story viewer
 *  mounted so tapping a story actually opens it. */
export default function ChatsTab() {
  return (
    <>
      <Inbox />
      <StoryHost />
    </>
  );
}
