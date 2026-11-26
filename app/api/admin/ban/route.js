import { requireAdmin, supabaseAdminClient } from "@/lib/supabaseAdmin";

// POST /api/admin/ban  { userId, banned }
export async function POST(req) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }

  const { userId, banned } = await req.json();
  if (!userId) {
    return Response.json({ error: "userId is required" }, { status: 400 });
  }
  if (userId === admin.id && banned) {
    return Response.json({ error: "You can't ban yourself." }, { status: 400 });
  }

  const client = supabaseAdminClient();
  const { error } = await client
    .from("profiles")
    .update({ is_banned: !!banned })
    .eq("id", userId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}
