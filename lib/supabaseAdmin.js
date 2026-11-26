import { createClient } from "@supabase/supabase-js";

// SERVER-ONLY client using the service role key. This bypasses Row Level
// Security entirely, so it must never be imported into client components
// and the key must never be prefixed with NEXT_PUBLIC_.
//
// Used only by the admin API routes (app/api/admin/**), and only after
// they've confirmed the caller is an admin.
export function supabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it as a (non-public) " +
        "environment variable - see README.md."
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Verifies the bearer token on an incoming request belongs to an admin.
// Returns the caller's profile row if so, or null otherwise.
export async function requireAdmin(req) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const admin = supabaseAdminClient();
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return null;

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("id, email, is_admin, is_banned")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileErr || !profile || !profile.is_admin) return null;
  return profile;
}
