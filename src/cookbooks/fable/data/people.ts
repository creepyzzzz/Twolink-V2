export type StoryState = "unread" | "seen" | "none";

export type Person = {
  id: string;
  name: string;
  first: string;
  avatar: number;
  story: number;
  storyState: StoryState;
  storyAgo: string;
};

export const ME: Person = {
  id: "me",
  name: "You",
  first: "My story",
  avatar: require("../../../../assets/cookbooks/fable/avatars/me.webp"),
  story: require("../../../../assets/cookbooks/fable/stories/me.jpg"),
  storyState: "none",
  storyAgo: "",
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

export const PEOPLE: Person[] = [
  {
    id: "mara",
    name: "Mara Lindqvist",
    first: "Mara",
    avatar: require("../../../../assets/cookbooks/fable/avatars/mara.webp"),
    story: require("../../../../assets/cookbooks/fable/stories/mara.jpg"),
    storyState: "unread",
    storyAgo: "12m",
  },
  {
    id: "theo",
    name: "Theo Adeyemi",
    first: "Theo",
    avatar: require("../../../../assets/cookbooks/fable/avatars/theo.webp"),
    story: require("../../../../assets/cookbooks/fable/stories/theo.jpg"),
    storyState: "unread",
    storyAgo: "1h",
  },
  {
    id: "elena",
    name: "Elena Rossi",
    first: "Elena",
    avatar: require("../../../../assets/cookbooks/fable/avatars/elena.webp"),
    story: require("../../../../assets/cookbooks/fable/stories/elena.jpg"),
    storyState: "unread",
    storyAgo: "2h",
  },
  {
    id: "jonas",
    name: "Jonas Weber",
    first: "Jonas",
    avatar: require("../../../../assets/cookbooks/fable/avatars/jonas.webp"),
    story: require("../../../../assets/cookbooks/fable/stories/jonas.jpg"),
    storyState: "seen",
    storyAgo: "4h",
  },
  {
    id: "sofia",
    name: "Sofía Herrera",
    first: "Sofía",
    avatar: require("../../../../assets/cookbooks/fable/avatars/sofia.webp"),
    story: require("../../../../assets/cookbooks/fable/stories/sofia.jpg"),
    storyState: "unread",
    storyAgo: "5h",
  },
  {
    id: "kenji",
    name: "Kenji Mori",
    first: "Kenji",
    avatar: require("../../../../assets/cookbooks/fable/avatars/kenji.webp"),
    story: require("../../../../assets/cookbooks/fable/stories/kenji.jpg"),
    storyState: "seen",
    storyAgo: "8h",
  },
  {
    id: "amara",
    name: "Amara Okafor",
    first: "Amara",
    avatar: require("../../../../assets/cookbooks/fable/avatars/amara.webp"),
    story: require("../../../../assets/cookbooks/fable/stories/amara.jpg"),
    storyState: "unread",
    storyAgo: "9h",
  },
  {
    id: "lucas",
    name: "Lucas Moreau",
    first: "Lucas",
    avatar: require("../../../../assets/cookbooks/fable/avatars/lucas.webp"),
    story: require("../../../../assets/cookbooks/fable/stories/lucas.jpg"),
    storyState: "seen",
    storyAgo: "11h",
  },
  {
    id: "zara",
    name: "Zara Haddad",
    first: "Zara",
    avatar: require("../../../../assets/cookbooks/fable/avatars/zara.webp"),
    story: require("../../../../assets/cookbooks/fable/stories/zara.jpg"),
    storyState: "unread",
    storyAgo: "14h",
  },
  {
    id: "elias",
    name: "Elias Novak",
    first: "Elias",
    avatar: require("../../../../assets/cookbooks/fable/avatars/elias.webp"),
    story: require("../../../../assets/cookbooks/fable/stories/elias.jpg"),
    storyState: "seen",
    storyAgo: "18h",
  },
  {
    id: "nia",
    name: "Nia Bennett",
    first: "Nia",
    avatar: require("../../../../assets/cookbooks/fable/avatars/nia.webp"),
    story: require("../../../../assets/cookbooks/fable/stories/nia.jpg"),
    storyState: "none",
    storyAgo: "",
  },
  {
    id: "rafael",
    name: "Rafael Costa",
    first: "Rafael",
    avatar: require("../../../../assets/cookbooks/fable/avatars/rafael.webp"),
    story: require("../../../../assets/cookbooks/fable/stories/rafael.jpg"),
    storyState: "none",
    storyAgo: "",
  },
];

export const FABLE_TEAM: Person = {
  id: "fable",
  name: "Fable",
  first: "Fable",
  avatar: require("../../../../assets/cookbooks/fable/avatars/fable.webp"),
  story: require("../../../../assets/cookbooks/fable/avatars/fable.webp"),
  storyState: "none",
  storyAgo: "",
};

export const PEOPLE_BY_ID: Record<string, Person> = Object.create(null);
for (const person of [ME, FABLE_TEAM, ...PEOPLE])
  PEOPLE_BY_ID[person.id] = person;

/** Stories row order: me first, then people who have a story, unread before seen. */
export const STORIES: Person[] = [
  ME,
  ...PEOPLE.filter((p) => p.storyState === "unread"),
  ...PEOPLE.filter((p) => p.storyState === "seen"),
];
