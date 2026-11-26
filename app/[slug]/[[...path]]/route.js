import { supabasePublicClient } from "@/lib/supabaseServer";

// Zero-cache dynamic serving so file uploads, edits, and deletions go live immediately.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req, { params }) {
  const { slug, path } = params;
  const rawSegments = (path || []).filter(Boolean);
  const joined = rawSegments.join("/");
  const filePath = joined ? "/" + joined : "/";

  const supabase = supabasePublicClient();

  const { data: site, error: siteErr } = await supabase
    .from("sites")
    .select("id, is_published")
    .eq("subdomain", slug)
    .maybeSingle();

  if (siteErr || !site || !site.is_published) {
    return notFound(slug, filePath);
  }

  // Build candidate paths for root, exact file paths, nested folders, and clean multi-page routes
  const candidates = [];
  if (filePath === "/") {
    candidates.push("/index.html");
  } else {
    candidates.push(filePath);
    const lastSeg = rawSegments[rawSegments.length - 1] || "";
    if (!lastSeg.includes(".")) {
      candidates.push(`${filePath}.html`);
      candidates.push(`${filePath}/index.html`);
    }
  }

  let fileRow = null;
  for (const candidate of candidates) {
    const { data } = await supabase
      .from("site_files")
      .select("storage_path, content_type")
      .eq("site_id", site.id)
      .eq("file_path", candidate)
      .maybeSingle();
    if (data) {
      fileRow = data;
      break;
    }
  }

  if (!fileRow) {
    return notFound(slug, filePath);
  }

  if (filePath === "/") {
    await supabase.rpc("increment_site_view", { p_site_id: site.id });
  }

  const { data: blob, error: downloadErr } = await supabase.storage
    .from("site-files")
    .download(fileRow.storage_path);

  if (downloadErr || !blob) {
    return notFound(slug, filePath);
  }

  const buffer = Buffer.from(await blob.arrayBuffer());

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": fileRow.content_type || "application/octet-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}

function notFound(slug, filePath = "/") {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>404 - Not found</title>
    <style>
      body{font-family:Inter,system-ui,sans-serif;background:#060a13;color:#f1f5f9;
        display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
      .box{text-align:center;max-width:420px;padding:32px;background:#0d1526;border:1px solid #1c2942;border-radius:16px}
      h1{font-size:22px;margin:0 0 10px;color:#38bdf8}
      p{color:#94a3b8;font-size:14px;margin:0;line-height:1.6}
      code{color:#7dd3fc;background:rgba(56,189,248,0.1);padding:2px 6px;border-radius:4px}
    </style></head>
    <body><div class="box">
      <h1>404 · Page Not Found</h1>
      <p>No published file at <code>/${slug}${filePath === "/" ? "" : filePath}</code>.<br/>Upload or generate <code>index.html</code> and subpages in File Manager.</p>
    </div></body></html>`,
    {
      status: 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
