# Poffu (TwoLink v2)

A private, discreet chatting app — built on a liquid-glass UI with Supabase backend. **Android only.**

## What this is

- **Fable chat UI** (`/fable`) — inbox with a folding story rail, glass portraits, dark outgoing bubbles, floating glass composer, timed stories, and full conversation threads.
- **Native glass on Android** (`src/ui/GlassView.tsx`) — real-time refraction via `expo-android-glass-view` (Jetpack Compose + AGSL on API 33+), with graceful fallbacks on older devices.
- **Supabase backend** — auth (email OTP + Google OAuth), realtime chat, friend requests, profiles, media, and a private vault. Migrations live in `supabase/migrations/`.

## Run it

Requires Node.js 22.13+. Native deps (Skia, MMKV, Keyboard Controller) mean you need a **development build** — this won't run in Expo Go.

```bash
npm install
npx expo run:android        # local dev build (Android Studio required)
```

Copy `.env.example` to `.env` and fill in `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

## Project structure

```
assets/cookbooks/fable/          Portraits and story photographs
assets/auth/                     Auth screen assets
scripts/                         Git auto-sync watcher + SF icon extractor
src/app/                         Expo Router screens & layouts
src/cookbooks/fable/             Fable chat cookbook (components, screens, data, hooks)
src/lib/chat.ts                  Supabase data-access layer
src/lib/supabase.ts              Supabase client (env-gated)
src/ui/                          Shared UI (GlassView, SFIcon, ScreenBackground)
supabase/migrations/             Database migrations
tests/                           Unit & repo checks
packages/                        Local dependency patches (URI decoder compat shim)
patches/                         patch-package patches (glass tab bar tweaks)
```

## Verification

```bash
npm run verify     # strict TypeScript + ESLint + regression tests
```

## Attribution

UI cookbook adapted from [Appllama/liquid-glass-chat-ui](https://github.com/Appllama/liquid-glass-chat-ui) (MIT License, see `LICENSE`).

### SF Symbols licensing

Icons in `src/ui/sf-icons.ts` are Apple SF Symbols artwork. Apple's license restricts SF Symbols to Apple platforms — revisit before any Play Store release.

### SF Pro font licensing

`assets/fonts/SF-Pro-Text-*.otf` are Apple's San Francisco Pro fonts, bundled for on-device testing only. Must be removed or replaced before public distribution.
