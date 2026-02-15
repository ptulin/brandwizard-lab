import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createBrowserClient(url, anonKey);
}

/** Returns null when Supabase env is not set (auth disabled). Use in client components. */
export function getSupabaseClientSafe() {
  if (typeof window === "undefined") return null;
  try {
    return createClient();
  } catch {
    return null;
  }
}
