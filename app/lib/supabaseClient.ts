import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 * Used by all client components (broker, officer, admin).
 * Session is automatically persisted via cookies by @supabase/ssr.
 *
 * Safe during Next.js static generation — returns a placeholder if
 * env vars are missing (the client will reinitialize on the browser).
 */
let _client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // During static build, env vars may be missing — return a shared instance
  if (!url || !key) {
    // Provide dummy values during prerender; they'll never actually be used
    // because all data-fetching is behind useEffect / event handlers
    if (!_client) {
      _client = createBrowserClient(
        "https://placeholder.supabase.co",
        "placeholder-key"
      );
    }
    return _client;
  }

  // In browser / runtime — create a singleton
  if (!_client) {
    _client = createBrowserClient(url, key);
  }
  return _client;
}