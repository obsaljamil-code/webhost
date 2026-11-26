import { supabasePublicClient } from "@/lib/supabaseServer";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "host.lavamc.dpdns.org";

// Next.js serves whatever this returns at /sitemap.xml automatically.
// Lists the marketing pages plus every published user site, so Google
// Search Console has something real to crawl.
export default async function sitemap() {
  const supabase = supabasePublicClient();

  const { data: sites } = await supabase
    .from("sites")
    .select("subdomain, created_at")
    .eq("is_published", true);

  const base = [
    { url: `https://${ROOT_DOMAIN}/`, changeFrequency: "weekly", priority: 1 },
    { url: `https://${ROOT_DOMAIN}/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `https://${ROOT_DOMAIN}/signup`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const siteEntries = (sites || []).map((s) => ({
    url: `https://${ROOT_DOMAIN}/${s.subdomain}`,
    lastModified: s.created_at,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...base, ...siteEntries];
}
