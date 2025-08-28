import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const hasSupabaseEnv = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = hasSupabaseEnv
  ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
  : (null as any);

export const supabaseConfigStatus = {
  urlPresent: Boolean(SUPABASE_URL),
  keyPresent: Boolean(SUPABASE_ANON_KEY),
  hasEnv: hasSupabaseEnv,
};

if (!hasSupabaseEnv && typeof window !== 'undefined') {
  // Helpful console hint during development
  // eslint-disable-next-line no-console
  console.warn("Supabase env not set: ", {
    urlPresent: Boolean(SUPABASE_URL),
    keyPresent: Boolean(SUPABASE_ANON_KEY),
  });
}
