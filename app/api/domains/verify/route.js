import { NextResponse } from "next/server";
import dns from "node:dns/promises";
import { supabaseServerFromRequest } from "@/lib/supabaseServer";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "host.lavamc.dpdns.org";

function cleanDomainInput(raw) {
  return (raw || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

export async function POST(req) {
  try {
    const supabase = supabaseServerFromRequest(req);
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { siteId, domain: rawDomain } = await req.json();
    const domain = cleanDomainInput(rawDomain);

    if (!siteId || !domain || !domain.includes(".")) {
      return NextResponse.json(
        { ok: false, error: "Valid custom domain is required (e.g. app.yourdomain.com)" },
        { status: 400 }
      );
    }

    const { data: site, error: siteErr } = await supabase
      .from("sites")
      .select("id, owner_id, subdomain")
      .eq("id", siteId)
      .eq("owner_id", authData.user.id)
      .maybeSingle();

    if (siteErr || !site) {
      return NextResponse.json({ ok: false, error: "Site not found" }, { status: 404 });
    }

    const expectedTxt = `lavamc-verify=${site.subdomain}`;
    const validCnames = ["cname.vercel-dns.com", ROOT_DOMAIN.toLowerCase()];

    let cnameVerified = false;
    let txtVerified = false;
    let foundCnames = [];
    let foundTxt = [];

    try {
      const cnames = await dns.resolveCname(domain);
      foundCnames = (cnames || []).map((c) => c.toLowerCase().replace(/\.$/, ""));
      cnameVerified = foundCnames.some(
        (c) => validCnames.includes(c) || c.endsWith(".vercel-dns.com")
      );
    } catch {}

    try {
      const txtHost = `_lavamc.${domain}`;
      const txtRecords = await dns.resolveTxt(txtHost);
      foundTxt = (txtRecords || []).map((chunks) => chunks.join(""));
      txtVerified = foundTxt.some((val) => val.includes(expectedTxt));
    } catch {}

    if (!txtVerified) {
      try {
        const rootTxtRecords = await dns.resolveTxt(domain);
        const rootFlat = (rootTxtRecords || []).map((chunks) => chunks.join(""));
        foundTxt.push(...rootFlat);
        txtVerified = rootFlat.some((val) => val.includes(expectedTxt));
      } catch {}
    }

    const isVerified = cnameVerified || txtVerified;
    const nextStatus = isVerified ? "approved" : "pending";

    const { error: updateErr } = await supabase
      .from("sites")
      .update({
        custom_domain: domain,
        custom_domain_status: nextStatus,
      })
      .eq("id", site.id);

    if (updateErr) {
      return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      verified: isVerified,
      status: nextStatus,
      domain,
      cnameVerified,
      txtVerified,
      foundCnames,
      expectedCname: "cname.vercel-dns.com",
      expectedTxtHost: `_lavamc.${domain}`,
      expectedTxtValue: expectedTxt,
      message: isVerified
        ? `DNS Verified! ${domain} is now automatically approved & active.`
        : `DNS records not detected yet. Add CNAME or TXT record and click Verify Now.`,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err.message || "DNS verification failed" },
      { status: 500 }
    );
  }
}
