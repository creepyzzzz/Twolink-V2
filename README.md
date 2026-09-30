# TwoLink v2

A private, discreet chatting app — rebuilt from scratch on a liquid-glass UI foundation.

**Status: UI scaffold.** Both chat cookbooks run standalone on local sample data. Supabase backend, the disguise system, vault, and friend requests are scaffolded but not yet wired — see [ROADMAP.md](./ROADMAP.md).

## What this is

- **Two cookbooks, one Expo project** (ported from Appllama's [`liquid-glass-chat-ui`](https://github.com/Appllama/liquid-glass-chat-ui), MIT):
  - **Fable** (`/fable`) — inbox where a compact portrait cluster unfolds into a 104pt folding story rail; quiet rounded conversation panel with dark outgoing bubbles; floating glass composer; timed stories.
  - **Astra** (`/astra`) — inbox with search + unread/group filters; reversible portrait ribbon that fans out from the header; the tapped portrait flies into the conversation; native glass bubbles; keyboard-following composer; photo zoom; heart reactions.
- **Android-safe glass** (`src/ui/GlassView.tsx`) — one abstraction for all glass surfaces. iOS 26+ renders Apple's native liquid-glass material; Android falls back to blur + tint wash + top-edge sheen + hairline border (no refraction — that's iOS-only).
- **Supabase-ready** — `@supabase/supabase-js` installed, `src/lib/supabase.ts` client (env-gated), `.env.example`, and `supabase/schema.sql` with tables for profiles, friend requests, friendships, conversations, messages, media, and vault items. Not wired to the UI yet.

## Run it

Requires Node.js 22.13+. Native deps (Skia, MMKV, Keyboard Controller) mean you need a **development build** — this won't run in Expo Go.

```bash
cd twolink-v2
npm install
npx expo run:android        # local dev build (Android Studio required)
# or
npx expo run:ios            # macOS + Xcode 26 + iOS 26 simulator
```

Copy `.env.example` to `.env` when you start the Supabase wiring (values stay out of git).

## Planned native packages (one-shot dev build)

These Expo packages are slated for a single dev-client rebuild, to be installed later on the project owner's word — **do not `npm install` them yet**. Each adds native code and/or permissions, so they all land together in one fresh build:

- `expo-camera` — in-chat camera capture for taking photos/videos without leaving the thread.
- `expo-image-picker` — pick photos and videos from the device library (already installed; listed here for the build manifest).
- `expo-video` — inline video playback for video messages.
- `expo-file-system` — local file read/write: persisting picked media and managing the cache.
- `expo-sharing` — the system share sheet, for forwarding media and files out of the app.
- `expo-media-library` — save media to the device gallery and read gallery assets.
- `expo-notifications` — push and local notifications for new messages.
- `expo-secure-store` — encrypted on-device storage for auth tokens and vault secrets.
- `expo-clipboard` — copy message text to the clipboard (and paste into the composer).

Deliberately excluded per the project owner's decision: `expo-audio` (voice messages — feature removed) and `expo-haptics` (haptics removed from the app entirely).

## Project structure

```
assets/cookbooks/{fable,astra}/   Portraits and story photographs
docs/                            Motion spec, asset provenance, verification
prompts/                         Cookbook integration + artwork recipes
scripts/                         Maestro native interaction checks
src/app/                         Gallery + Expo Router adapters
src/cookbooks/fable/             Cookbook 1 (Fable)
src/cookbooks/astra/             Cookbook 2 (Astra)
src/ui/GlassView.tsx             Android-safe glass abstraction (new in v2)
src/lib/supabase.ts              Supabase client, env-gated (new in v2)
supabase/schema.sql              Backend schema scaffold (new in v2)
tests/                           State, persistence, asset, repo checks
```

## Verification

```bash
npm run verify     # strict TypeScript + ESLint + regression tests
npx expo-doctor
```

## Attribution

UI cookbooks, motion specs, artwork, and docs are adapted from [Appllama/liquid-glass-chat-ui](https://github.com/Appllama/liquid-glass-chat-ui) (MIT License, see `LICENSE`). TwoLink-specific additions (glass abstraction, Supabase scaffold) are new work on top.

### SF Symbols licensing

Icons in `src/ui/sf-icons.ts` are Apple SF Symbols artwork (extracted via `@bradleyhodges/sfsymbols`). Apple's license restricts SF Symbols to Apple platforms — shipping them in this Android app is a known, accepted trade-off by the project owner. Revisit before any Play Store release.

### SF Pro font licensing

`assets/fonts/SF-Pro-Text-*.otf` are Apple's San Francisco Pro fonts, bundled for on-device testing only at the project owner's request. Apple's license restricts SF Pro to Apple platforms — these files must be removed (or replaced with a licensed alternative such as Inter) before any public distribution, including a Play Store release.
