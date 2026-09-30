export const SNAP = { damping: 26, stiffness: 270, mass: 0.9 };
export const BLOOM = { damping: 23, stiffness: 230, mass: 0.9 };
/** TwoLink is light-theme only — no dark variant anywhere in the app. */
export function useTheme() {
  return {
    dark: false,
    scheme: "light" as const,
    bg: "#F2F2F2",
    paper: "#F8F8F8",
    text: "#17191B",
    muted: "#82878B",
    line: "#E4E5E6",
    chip: "#E8E9EA",
    bubble: "#FFFFFF",
    ink: "#242628",
    onInk: "#FFFFFF",
    blue: "#3D92E9",
  };
}
