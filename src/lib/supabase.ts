import { createClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

const looksLikePlaceholder = (value: string) =>
  !value ||
  value.includes("your-project") ||
  value.includes("your-anon") ||
  value === "https://your-project.supabase.co";

export const isSupabaseConfigured = Boolean(url && anonKey && !looksLikePlaceholder(url) && !looksLikePlaceholder(anonKey));

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function functionsUrl(path: string) {
  const base =
    import.meta.env.VITE_SUPABASE_FUNCTIONS_URL ||
    (url ? `${url}/functions/v1` : "");
  return `${base}/${path}`;
}
