import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseKey = process.env.SUPABASE_ANON_KEY ?? "";
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase env: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_ANON_KEY in dashboard/.env.local"
    );
  }
  _client = createClient(supabaseUrl, supabaseKey);
  return _client;
}

/** Lazy Supabase client – throws only when first used if env is missing. */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabaseClient() as Record<string | symbol, unknown>)[prop];
  },
});
