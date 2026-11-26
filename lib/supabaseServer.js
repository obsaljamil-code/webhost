import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client used by route handlers.
// Uses the anon key + the caller's access token (passed in Authorization
// header) so Row Level Security still applies per-user. We never need the
// service role key for this app, which keeps things simpler and safer.
export function supabaseServerFromRequest(req) {
  const authHeader = req.headers.get("authorization") || "";
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    }
  );
}

// A plain anon client with no user context - fine for public reads
// (e.g. serving published site files, which are public by RLS policy).
export function supabasePublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
