import { requireAdmin, supabaseAdminClient } from "@/lib/supabaseAdmin";

// POST /api/admin/limit  { userId, siteLimit }
// Changes how many websites one user is allowed to create. Default for
// everyone is 3 (set in the database); this overrides it per-user.
export async function POST(req) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }

  const { userId, siteLimit } = await req.json();
  const limit = Number(siteLimit);

  if (!userId || !Number.isInteger(limit) || limit < 0 || limit > 1000) {
    return Response.json({ error: "userId and a siteLimit between 0 and 1000 are required" }, { status: 400 });
  }

  const client = supabaseAdminClient();
  const { error } = await client.from("profiles").update({ site_limit: limit }).eq("id", userId);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
