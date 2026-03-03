import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 * Used by all client components (broker, officer, admin).
 * Session is automatically persisted via cookies by @supabase/ssr.
 *
 * Two separate singletons are kept so a placeholder created during
 * Next.js prerender is NEVER returned once real env vars are available.
 */
let _realClient: ReturnType<typeof createBrowserClient> | null = null;
let _placeholderClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Real credentials available — always use the real singleton
  if (url && key) {
    if (!_realClient) {
      _realClient = createBrowserClient(url, key);
    }
    return _realClient;
  }

  // No credentials (static prerender) — use a separate placeholder singleton
  // so it can never pollute _realClient once the browser loads
  if (!_placeholderClient) {
    _placeholderClient = createBrowserClient(
      "https://placeholder.supabase.co",
      "placeholder-key"
    );
  }
  return _placeholderClient;
}