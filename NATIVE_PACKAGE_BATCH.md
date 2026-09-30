# Native package batch — install all at once

These packages are approved in principle but deliberately NOT installed yet.
The UI for everything below is already built and waiting. When Tariq says the
word, read this file and install + connect every package in one go, then do a
single fresh dev-client build.

## Packages

| Package | What it unlocks | UI already built |
|---|---|---|
| `expo-clipboard` | Copy message text (long-press → Copy) | `src/cookbooks/fable/lib/clipboard.ts` resolves the module ID at runtime; until then the Copy row shows a "not ready yet" notice |
| `expo-document-picker` | Pick files from the device (composer Files row, shared Documents) | `DocumentAttachment` model, document bubbles, Files composer row, Shared Documents sections — all parked behind the missing picker |
| `expo-file-system` | Only if actually needed (reading picked file metadata / copying to cache) | Decide at install time; skip if `expo-document-picker` results suffice |

## At install time

1. `npx expo install <packages>` (Expo-compatible versions).
2. Connect each result to its waiting UI:
   - Clipboard: `lib/clipboard.ts` starts resolving — no code change needed.
   - Document picker: wire picker results into the existing `DocumentAttachment` send path; populate real URIs; open files from bubbles/profile rows.
3. Run `npx tsc --noEmit`, ESLint on changed files, and the Node test suite.
4. Commit + push.
5. Tell Tariq a fresh dev-client build is required (native dependencies).

## Do NOT add in this batch

- `expo-camera` — Tariq said no camera capture.
- Anything else not listed above — new packages need his explicit approval first.
