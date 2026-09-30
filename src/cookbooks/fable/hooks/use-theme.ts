import { Palette, type Scheme, type Theme } from "../constants/theme";

/** Poffu is light-theme only — no dark variant anywhere in the app. */
export function useScheme(): Scheme {
  return "light";
}

export function useTheme(): Theme {
  return Palette[useScheme()];
}
