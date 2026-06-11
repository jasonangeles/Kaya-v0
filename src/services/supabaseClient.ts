import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Reads Vite env vars. When they're absent, the app runs fully on
// localStorage (no auth, no cloud) — exactly as before.
// Trim whitespace and any trailing slash(es); the client expects a bare
// origin like https://<ref>.supabase.co with no path.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim().replace(/\/+$/, '');
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export const isSupabaseEnabled = !!(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseEnabled
  ? createClient(url!, anonKey!)
  : null;
