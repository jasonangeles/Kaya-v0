import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Reads Vite env vars. When they're absent, the app runs fully on
// localStorage (no auth, no cloud) — exactly as before.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseEnabled = !!(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseEnabled
  ? createClient(url!, anonKey!)
  : null;
