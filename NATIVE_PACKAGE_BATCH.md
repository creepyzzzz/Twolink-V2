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

## Skipped deliberately

- `expo-file-system` — not needed: the picker returns name/size/mimeType and
  copies the file into the app cache itself (`copyToCacheDirectory: true`);
  nothing in the current UI does its own file I/O.

## Do NOT add

- `expo-camera` — Tariq said no camera capture.
- Anything else not listed above — new packages need his explicit approval first.
