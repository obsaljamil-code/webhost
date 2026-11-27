import { NextResponse } from "next/server";

const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "host.lavamc.dpdns.org").toLowerCase();

export async function middleware(req) {
  const url = req.nextUrl.clone();
  const hostHeader = (req.headers.get("host") || "").toLowerCase().split(":")[0];

  if (
    !hostHeader ||
    hostHeader === ROOT_DOMAIN ||
    hostHeader === `www.${ROOT_DOMAIN}` ||
    hostHeader.endsWith(".vercel.app") ||
    hostHeader === "localhost" ||
    hostHeader === "127.0.0.1"
  ) {
    return NextResponse.next();
  }

  // Skip internal Next.js and API paths
  if (
    url.pathname.startsWith("/_next") ||
    url.pathname.startsWith("/api") ||
    url.pathname === "/favicon.svg" ||
    url.pathname === "/mark.svg"
  ) {
    return NextResponse.next();
  }

  try {
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supaUrl || !supaKey) return NextResponse.next();

    const lookupUrl = `${supaUrl}/rest/v1/sites?select=subdomain&custom_domain=eq.${encodeURIComponent(
      hostHeader
    )}&custom_domain_status=eq.approved&is_published=eq.true&limit=1`;

    const res = await fetch(lookupUrl, {
      headers: {
        apikey: supaKey,
        Authorization: `Bearer ${supaKey}`,
      },
      cache: "no-store",
    });

    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows[0]?.subdomain) {
        const slug = rows[0].subdomain;
        const suffix = url.pathname === "/" ? "" : url.pathname;
        url.pathname = `/${slug}${suffix}`;
        return NextResponse.rewrite(url);
      }
    }
  } catch {}

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
