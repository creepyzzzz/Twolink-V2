/** A frozen snapshot of the message being replied to. */
export type ReplyQuote = {
  id: string;
  from: "me" | "them";
  text: string;
  photo?: boolean;
};

/** One option in a group poll. */
export type PollOption = {
  id: string;
  text: string;
  /** Voter ids ("me" or a Person id). Single-choice: at most one per voter. */
  votes: string[];
};

/** A group poll attached to a message; `text` mirrors the question. */
export type Poll = {
  question: string;
  options: PollOption[];
};

/**
 * A file attached to a message. The picker (expo-document-picker) is parked
 * until the native package batch is approved — until then `uri` stays empty
 * and the composer explains that instead of opening a picker.
 */
export type DocumentAttachment = {
  /** Original file name, e.g. "contract.pdf". */
  name: string;
  /** Size in bytes. */
  size: number;
  /** MIME type, e.g. "application/pdf". */
  mimeType: string;
  /** Local file URI. Empty until the native picker lands. */
  uri: string;
};

export type Message = {
  id: string;
  from: "me" | "them";
  text: string;
  at: string;
  /** Group threads: which member sent this (a Person id). */
  senderId?: string;
  photo?: boolean;
  /** Local URI of a device photo (falls back to the person's story art). */
  photoUri?: string;
  /** The message this one replies to, if any. */
  replyTo?: ReplyQuote;
  /** Emoji tapbacks on this message (long-press to add/remove). */
  reactions?: string[];
  /** Group poll attached to this message. */
  poll?: Poll;
  /**
   * File attached to this message. `text` mirrors the file name so inbox
   * previews, search, and reply quotes keep working unchanged.
   */
  document?: DocumentAttachment;
  /**
   * Epoch ms when a disappearing message expires. Only set on messages
   * sent after the thread's timer was enabled.
   */
  expiresAt?: number;
};

const mara: Message[] = [
  {
    id: "m1",
    from: "them",
    text: "Are you still up for the cabin thing this month?",
    at: "Yesterday 21:05",
  },
  {
    id: "m2",
    from: "me",
    text: "Very. I have been staring at a spreadsheet for nine hours, I need a tree.",
    at: "Yesterday 21:08",
  },
  {
    id: "m3",
    from: "them",
    text: "Good. Because I found a place.",
    at: "Yesterday 21:09",
  },
  {
    id: "m4",
    from: "them",
    text: "Wood sauna. Lake you can jump into after. Two hours north, no signal past the last gas station.",
    at: "Yesterday 21:09",
  },
  {
    id: "m5",
    from: "me",
    text: "No signal is a feature.",
    at: "Yesterday 21:14",
  },
  { id: "m6", from: "me", text: "Who else is coming?", at: "Yesterday 21:14" },
  {
    id: "m7",
    from: "them",
    text: "Theo, Elena, maybe Lucas if his knee behaves.",
    at: "Yesterday 21:20",
  },
  {
    id: "m8",
    from: "them",
    text: "Sunday still works for the cabin? I found a place with a wood sauna and a lake you can jump into.",
    at: "9:41",
  },
  {
    id: "m9",
    from: "me",
    text: "Sunday works. I will sort the train times.",
    at: "9:44",
  },
  {
    id: "m10",
    from: "them",
    text: "Perfect. I will bring the sauna towels.",
    at: "12:15",
  },
  {
    id: "m11",
    from: "me",
    text: "And I will bring snacks. Non-negotiable.",
    at: "12:18",
  },
];

const theo: Message[] = [
  {
    id: "t1",
    from: "me",
    text: "How is the mix coming?",
    at: "Yesterday 18:02",
  },
  {
    id: "t2",
    from: "them",
    text: "Close. Rebuilt the drums on track 4 from scratch.",
    at: "Yesterday 18:40",
  },
  {
    id: "t3",
    from: "them",
    text: "Sent you the mix. Track 4 is the one — tell me if the bass is too much.",
    at: "9:12",
  },
  {
    id: "t4",
    from: "me",
    text: "Bass sounds massive on my end. Keep it exactly like that.",
    at: "9:20",
  },
  {
    id: "t5",
    from: "them",
    text: "Told you. Sending the final bounce tonight.",
    at: "14:05",
  },
];

const fable: Message[] = [
  { id: "o1", from: "them", text: "Welcome to Fable.", at: "8:30" },
  {
    id: "o2",
    from: "them",
    text: "Pull down on your chats to see who posted a story today. Scroll back up and they tuck into the title.",
    at: "8:30",
  },
  {
    id: "o3",
    from: "them",
    text: "Everything here is glass. Try dragging the keyboard.",
    at: "8:30",
  },
];

const generic = (name: string): Message[] => [
  {
    id: "g1",
    from: "them",
    text: `Hey, it's ${name}. Are you around later?`,
    at: "Yesterday 17:12",
  },
  {
    id: "g2",
    from: "me",
    text: "Around after six. What is up?",
    at: "Yesterday 17:30",
  },
  {
    id: "g3",
    from: "them",
    text: "Nothing urgent. Just wanted to catch up properly, it has been a while.",
    at: "Yesterday 17:31",
  },
  {
    id: "g4",
    from: "me",
    text: "It really has. Call at seven?",
    at: "Yesterday 17:33",
  },
  { id: "g5", from: "them", text: "Seven is perfect.", at: "Yesterday 17:33" },
];

export function messagesFor(personId: string, first: string): Message[] {
  switch (personId) {
    case "mara":
      return mara;
    case "theo":
      return theo;
    case "fable":
      return fable;
    default:
      return generic(first);
  }
}

export const REPLIES = [
  "Ha, okay. Give me a minute.",
  "Say more.",
  "That is exactly what I was thinking.",
  "Deal. I will sort the rest.",
  "Send me the details and I am in.",
];

/**
 * Older history for scroll-up pagination. Page 0 is the most recent older
 * batch; pages are prepended one at a time. Returns [] when the history is
 * exhausted. Local stand-in data — when the real backend lands, this becomes
 * the paginated fetch and the prepend mechanism stays the same.
 */
type OlderTuple = [from: Message["from"], text: string, time: string];

function buildOlder(
  personId: string,
  page: number,
  day: string,
  items: OlderTuple[],
): Message[] {
  return items.map(([from, text, time], i) => ({
    id: `old-${personId}-p${page}-${i}`,
    from,
    text,
    at: `${day} ${time}`,
  }));
}

const MARA_HISTORY: OlderTuple[][] = [
  [
    ["them", "Work is eating me alive this week.", "18:44"],
    ["me", "Same. I forgot what daylight looks like.", "19:02"],
    ["them", "We need to get out of the city soon. Seriously.", "20:35"],
    ["me", "Say the word and I am packing a bag.", "20:41"],
    ["them", "I am saying the word. Cabin. This month.", "20:42"],
  ],
  [
    ["me", "Did Elena ever send those photos from the lake?", "12:20"],
    ["them", "She did! They are gorgeous, check the group.", "12:45"],
    ["me", "Okay that water is unreal.", "13:02"],
    ["them", "Right? That is exactly the energy we need.", "13:03"],
  ],
  [
    ["them", "Lazy Sunday verdict: this couch and I are one now.", "16:30"],
    ["me", "Respect. I just finished a 10k, I am deceased.", "17:05"],
    ["them", "Show-off. Proud of you though.", "17:06"],
  ],
];

const THEO_HISTORY: OlderTuple[][] = [
  [
    ["me", "That bassline on track 2 is stuck in my head.", "20:11"],
    ["them", "Good stuck or bad stuck?", "20:30"],
    ["me", "The best kind. Do not you dare change it.", "20:44"],
    ["them", "Noted. Track 2 is now untouchable.", "20:45"],
  ],
  [
    ["them", "Studio is booked for Thursday. Bring your ears.", "11:15"],
    ["me", "Would not miss it. Same time as last?", "11:40"],
    ["them", "Yeah, seven. I will order food so we do not die.", "11:41"],
  ],
  [
    ["me", "Found that sample pack you mentioned.", "15:20"],
    ["them", "The dusty drums one? It is gold.", "15:55"],
    ["me", "Already chopped three loops from it.", "16:10"],
    ["them", "Send them over, I want to hear.", "16:12"],
  ],
];

const GENERIC_HISTORY = (name: string): OlderTuple[][] => [
  [
    ["them", `Hey, it is ${name}. Did you catch the match last night?`, "19:02"],
    ["me", "Second half only. That last-minute goal was unreal.", "19:20"],
    ["them", "I nearly woke the whole building.", "19:21"],
    ["me", "We should watch one together sometime.", "19:40"],
    ["them", "Deal. I will hold you to that.", "19:41"],
  ],
  [
    ["me", "This week is already a lot and it is only Monday.", "09:12"],
    ["them", "Three meetings before lunch over here.", "09:30"],
    ["them", "Coffee later? I need to complain in person.", "09:31"],
    ["me", "Always. Same spot at five?", "10:02"],
    ["them", "Perfect. Do not be late this time.", "10:05"],
    ["me", "That was ONE time.", "10:06"],
  ],
  [
    ["them", "Okay hear me out — road trip next month?", "14:15"],
    ["me", "I am listening...", "14:40"],
    ["them", "Nothing crazy. Just drive somewhere with actual hills.", "14:41"],
    ["me", "You had me at hills.", "15:05"],
    ["them", "I will look into places this week.", "15:06"],
  ],
];

const FABLE_HISTORY: OlderTuple[][] = [
  [
    ["them", "Earlier: reactions are here. Long-press any message.", "09:00"],
    [
      "them",
      "And search: tap the magnifier in any conversation to find words.",
      "09:01",
    ],
  ],
];

const HISTORY_DAYS = ["Tuesday", "Monday", "Sunday"];

export function olderMessagesFor(
  personId: string,
  first: string,
  page: number,
): Message[] {
  const pages =
    personId === "mara"
      ? MARA_HISTORY
      : personId === "theo"
        ? THEO_HISTORY
        : personId === "fable"
          ? FABLE_HISTORY
          : GENERIC_HISTORY(first);
  const items = pages[page];
  if (!items) return [];
  return buildOlder(personId, page, HISTORY_DAYS[page] ?? "Earlier", items);
}
