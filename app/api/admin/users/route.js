import { requireAdmin, supabaseAdminClient } from "@/lib/supabaseAdmin";

// GET /api/admin/users
// Returns every signed-up user with their profile info, how they signed
// in, and how many sites they own. Admin-only - never exposes passwords
// (Supabase never stores or returns them in the first place).
export async function GET(req) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }

  const client = supabaseAdminClient();

  const { data: authUsers, error: authErr } = await client.auth.admin.listUsers({
    perPage: 1000,
  });
  if (authErr) {
    return Response.json({ error: authErr.message }, { status: 500 });
  }

  const { data: profiles } = await client
    .from("profiles")
    .select("id, email, display_name, username, is_admin, is_banned, site_limit, created_at");

  const { data: siteCounts } = await client.from("sites").select("owner_id");

  const countsByOwner = {};
  for (const row of siteCounts || []) {
    countsByOwner[row.owner_id] = (countsByOwner[row.owner_id] || 0) + 1;
  }
  const profileById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

  const users = authUsers.users.map((u) => {
    const profile = profileById[u.id] || {};
    const providers = (u.identities || []).map((i) => i.provider);
    return {
      id: u.id,
      email: u.email,
      displayName: profile.display_name || null,
      username: profile.username || null,
      isAdmin: !!profile.is_admin,
      isBanned: !!profile.is_banned,
      signedUpVia: providers.includes("google") ? "google" : "email",
      lastSignInAt: u.last_sign_in_at,
      createdAt: u.created_at,
      siteCount: countsByOwner[u.id] || 0,
      siteLimit: profile.site_limit ?? 3,
    };
  });

  return Response.json({ users });
}
