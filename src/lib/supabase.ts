import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client for Poffu.
 *
 * Reads EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY from the
 * environment (see .env.example). Nothing in the UI cookbooks imports this
 * yet — the app runs standalone on local sample data until you wire it up.
 *
 * NOTE: the module throws at import time when the env vars are missing, so
 * only import it from code paths that actually need Supabase.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "[Poffu] Supabase is not configured. Copy .env.example to .env and set " +
      "EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
  );
}

export const supabase: SupabaseClient = createClient(url, anonKey);
