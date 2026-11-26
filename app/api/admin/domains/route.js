import { requireAdmin, supabaseAdminClient } from "@/lib/supabaseAdmin";

// GET /api/admin/domains - every site that has ever requested a custom domain
export async function GET(req) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }

  const client = supabaseAdminClient();
  const { data, error } = await client
    .from("sites")
    .select("id, subdomain, title, custom_domain, custom_domain_status, owner_id")
    .not("custom_domain", "is", null)
    .order("custom_domain_status", { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const ownerIds = [...new Set(data.map((s) => s.owner_id))];
  const { data: profiles } = await client
    .from("profiles")
    .select("id, email")
    .in("id", ownerIds.length ? ownerIds : ["00000000-0000-0000-0000-000000000000"]);
  const emailById = Object.fromEntries((profiles || []).map((p) => [p.id, p.email]));

  return Response.json({
    requests: data.map((s) => ({ ...s, ownerEmail: emailById[s.owner_id] || null })),
  });
}

// POST /api/admin/domains  { siteId, status: 'approved' | 'rejected' }
export async function POST(req) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }

  const { siteId, status } = await req.json();
  if (!siteId || !["approved", "rejected", "pending"].includes(status)) {
    return Response.json({ error: "siteId and a valid status are required" }, { status: 400 });
  }

  const client = supabaseAdminClient();
  const { error } = await client
    .from("sites")
    .update({ custom_domain_status: status })
    .eq("id", siteId);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
