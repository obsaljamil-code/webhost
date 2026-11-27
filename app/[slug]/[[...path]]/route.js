import { supabasePublicClient } from "@/lib/supabaseServer";

// Path-based site serving: https://host.lavamc.dpdns.org/<slug>/<...path>
//
// "/john"            -> serves john's index.html
// "/john/about.html" -> serves john's about.html
//
// Reserved words (dashboard, auth, _next, etc.) never reach this route
// because Next.js matches literal folders (app/dashboard, app/auth/...)
// before falling back to the [slug] dynamic segment.
export async function GET(req, { params }) {
  const { slug, path } = params;
  const filePath = "/" + (path || []).join("/");

  const supabase = supabasePublicClient();

  const { data: site, error: siteErr } = await supabase
    .from("sites")
    .select("id, is_published")
    .eq("subdomain", slug)
    .maybeSingle();

  if (siteErr || !site || !site.is_published) {
    return notFound(slug);
  }

  let { data: fileRow } = await supabase
    .from("site_files")
    .select("storage_path, content_type")
    .eq("site_id", site.id)
    .eq("file_path", filePath)
    .maybeSingle();

  // Fall back to index.html for "/" or for single-page sites with no
  // matching file at this exact path.
  if (!fileRow) {
    const fallback = await supabase
      .from("site_files")
      .select("storage_path, content_type")
      .eq("site_id", site.id)
      .eq("file_path", "/index.html")
      .maybeSingle();
    fileRow = fallback.data;
  }

  if (!fileRow) {
    return notFound(slug);
  }

  // Count a view once per homepage hit (not per asset/sub-page), so the
  // dashboard's "N views" number roughly tracks visits, not file requests.
  if (filePath === "/") {
    await supabase.rpc("increment_site_view", { p_site_id: site.id });
  }

  const { data: blob, error: downloadErr } = await supabase.storage
    .from("site-files")
    .download(fileRow.storage_path);

  if (downloadErr || !blob) {
    return notFound(slug);
  }

  const buffer = Buffer.from(await blob.arrayBuffer());

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": fileRow.content_type || "application/octet-stream",
      "Cache-Control": "public, max-age=60",
    },
  });
}

function notFound(slug) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Not found</title>
    <style>
      body{font-family:Inter,system-ui,sans-serif;background:#15141A;color:#F2EFEA;
        display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
      .box{text-align:center;max-width:360px;padding:24px}
      h1{font-size:20px;margin:0 0 8px}
      p{color:#9D97A8;font-size:14px;margin:0}
      code{color:#FF8A5C}
    </style></head>
    <body><div class="box">
      <h1>No site here</h1>
      <p>Nothing is published at <code>/${slug}</code> yet.</p>
    </div></body></html>`,
    { status: 404, headers: { "Content-Type": "text/html" } }
  );
}
