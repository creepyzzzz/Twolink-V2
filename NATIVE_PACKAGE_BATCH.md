# Native package batch — INSTALLED Sep 30, 2026

Installed in one go via `npx expo install` (Expo SDK 57-pinned versions);
wired the same night. Tariq's fresh dev-client build picks up the native
modules — until then Copy/Files degrade gracefully with a "needs the latest
build" notice instead of crashing.

## Installed

| Package | Version | What it unlocked |
|---|---|---|
| `expo-clipboard` | ~57.0.2 | Copy message text (long-press → Copy). `src/cookbooks/fable/lib/clipboard.ts` runtime-resolves it — no code change needed. |
| `expo-document-picker` | ~57.0.3 | System file picker (composer Files row → `DocumentAttachment` message → document bubble; tap opens via `Linking`). Wired in `screens/Conversation.tsx` (`onAttachFile`); `SharedDocuments` profile rows are tappable too. |

## Installed Sep 30, 2026 — batch 2 (all approved by Tariq)

| Package | Version | What it unlocked |
|---|---|---|
| `expo-file-system` | ~57.0.7 | Picked files are copied into the app's documents dir on send (legacy API), so attachments survive Android cache eviction. Wired in `onAttachFile`. |
| `expo-notifications` | ~57.0.21 | Settings → Message notifications now requests the OS permission on enable (denial leaves the toggle off with an explanation). Full push delivery waits on the Supabase backend. |
| `expo-secure-store` | ~57.0.4 | Encrypted storage for auth tokens when Supabase auth lands. Nothing to wire yet. |
| `expo-media-library` | ~57.0.5 | Photo viewer gained a save-to-gallery button (top-left, `square.and.arrow.down`). |
| `expo-sharing` | ~57.0.22 | Message action menu gained a Share row (after Forward) for photos/files → system share sheet. |

## Installed Sep 30, 2026 — batch 3 (all approved by Tariq)

| Package | Version | What it unlocked |
|---|---|---|
| `expo-video` | ~57.0.5 | Inline video playback — parked until video messages get built (gallery is images-only today). |
| `expo-image-manipulator` | ~57.0.20 | Photo compression/thumbnails — reserved for a future optimization pass. |
| `expo-auth-session` | ~57.0.13 | OAuth flow helper — reserved for social login when Supabase auth lands. |
| `@sentry/react-native` | ~7.11.0 | Crash reporting. Guarded init in `src/app/_layout.tsx` — no-op until `EXPO_PUBLIC_SENTRY_DSN` is set (add it to `.env` when the Sentry project exists). |

## Still excluded (Tariq's vetoes)

- `expo-camera` — no camera capture.
- `expo-haptics` — haptics removed from the app entirely.
- `expo-audio` — no voice messages.

## Skipped deliberately

## Do NOT add

- `expo-camera` — Tariq said no camera capture.
- Anything else not listed above — new packages need his explicit approval first.
