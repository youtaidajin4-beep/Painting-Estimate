// Public Supabase project settings (anon key is safe to expose in frontend; RLS protects data).
// .env values override these when present (useful for local development).
export const DEFAULT_SUPABASE_URL = "https://vcvsbbzqvvsojjhqrfap.supabase.co";
export const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjdnNiYnpxdnZzb2pqaHFyZmFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDI0NDUsImV4cCI6MjA5OTUxODQ0NX0.Gxj89XLdH7wK0KlVSla9fbLNHc0OFTb-6t3mjSFvGEc";
export const DEFAULT_SUPABASE_FUNCTIONS_URL =
  "https://vcvsbbzqvvsojjhqrfap.supabase.co/functions/v1";
