import { supabase, functionsUrl, isSupabaseConfigured } from "./supabase";

export async function callAnthropic(body: unknown): Promise<Response> {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      return fetch(functionsUrl("anthropic-proxy"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
    }
  }

  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
}
