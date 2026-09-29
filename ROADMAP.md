# TwoLink v2 — Roadmap

What the scaffold has, and what is deliberately left for you.

## Done in this scaffold

- [x] Both upstream cookbooks (Fable, Astra) ported as-is and running on local sample data
- [x] `src/ui/GlassView.tsx` — Android-safe glass abstraction; all cookbook glass surfaces routed through it
- [x] `@supabase/supabase-js` dependency installed
- [x] `src/lib/supabase.ts` — env-gated client (throws a clear error when env vars are missing)
- [x] `.env.example` + `supabase/schema.sql` (profiles, friend_requests, friendships, conversations, conversation_members, messages, media, vault_items)
- [x] app.json renamed (TwoLink / twolink / com.twolink.chat), Android platform enabled
- [x] TypeScript + ESLint pass

## Left for you

### 1. Supabase project + credentials
Create the project at supabase.com, run `supabase/schema.sql` in the SQL editor, create storage buckets (`media`, and a private `vault` bucket), then copy `.env.example` to `.env` and fill in `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Never commit `.env`.

### 2. Wire realtime chat to Supabase
Replace the sample stores (`src/cookbooks/*/data/`, MMKV namespaces) with Supabase realtime subscriptions on `messages`, keeping the same screen components. Keep the local-sample path working for offline preview.

### 3. Disguise system (from the original TwoLink)
- Fake shopping-app disguise screen shown on launch
- Secret-code entry that unlocks the real app
- Disguised push notifications styled as shopping offers

### 4. Private media vault UI
Gallery/lock screen for `vault_items` behind the secret-code gate. Uploads go to the private bucket; rows are owner-only by RLS.

### 5. Friend request flows
Search-by-username, send/accept/decline against `friend_requests`, derive `friendships` on accept, then 1:1 conversation creation.

### 6. Push notifications
Expo push + Supabase (edge function or trigger → Expo Push API). Remember the disguise requirement: notification payloads must look like shopping offers.

### 7. EAS dev build on your laptop
```bash
npm install -g eas-cli
eas build --profile development --platform android
```
Then `npx expo start --dev-client` and open the dev build. The sandbox that produced this scaffold has no Android SDK/macOS, so the first real native build happens here.

### 8. Push to GitHub
```bash
cd twolink-v2
git init && git add -A && git commit -m "TwoLink v2 scaffold: liquid-glass cookbooks + Android glass + Supabase scaffold"
# create the repo on github.com (private recommended), then:
git remote add origin <your-repo-url>
git push -u origin main
```

## Notes / gotchas
- Android glass is a blur-based approximation — no refraction. If you want closer parity, the Skia portrait shaders (`GlassPortrait`, `orb-shaders.ts`) are cross-platform and already work on Android.
- `expo-glass-effect` stays a dependency for the iOS path; it no-ops on Android.
- The upstream `prompts/` integration recipes assume an AI agent doing the porting — still useful if you later lift more screens.
