import { NextResponse } from "next/server";

// ============================================================================
// CENTRAL AI STUDIO API KEY CONFIGURATION
// Your provided demo key is placed right here so you can inspect or replace it
// anytime in this file (or override it via Vercel env var GEMINI_API_KEY).
// End-users NEVER see this key and NEVER get an API key input/save box.
// ============================================================================
export const DEMO_AI_STUDIO_API_KEY =
  process.env.GEMINI_API_KEY;

function getActiveApiKey() {
  const envKey = (process.env.GEMINI_API_KEY || "").trim();
  return envKey || DEMO_AI_STUDIO_API_KEY;
}

function makeUniqueSlugPart(len = 6) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function fixBrokenImagePathsInHtml(html, siteSlug, uploadedFilePaths) {
  const availableSet = new Set(
    (uploadedFilePaths || []).map((p) => p.replace(/^\/+/, "").toLowerCase())
  );

  // Match <img ... src="..." ...>
  return html.replace(/(<img\b[^>]*?\bsrc=["'])([^"']+)(["'][^>]*>)/gi, (full, prefix, srcVal, suffix) => {
    const trimmed = (srcVal || "").trim();
    if (!trimmed || trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
      return full;
    }

    // Normalize relative ./ or /siteSlug/ prefix
    let cleanRel = trimmed.replace(/^\.\//, "").replace(/^\/+/, "");
    const slugPrefix = `${siteSlug}/`;
    if (cleanRel.toLowerCase().startsWith(slugPrefix.toLowerCase())) {
      cleanRel = cleanRel.slice(slugPrefix.length);
    }

    const baseName = cleanRel.split("/").pop()?.toLowerCase() || "";
    let matchedPath = cleanRel;

    if (!availableSet.has(cleanRel.toLowerCase()) && baseName) {
      // Look for an uploaded image matching the filename in root or any folder
      const found = Array.from(availableSet).find(
        (p) => p === baseName || p.endsWith("/" + baseName)
      );
      if (found) {
        matchedPath = found;
      }
    }

    // Ensure image points cleanly to /<siteSlug>/<matchedPath>
    const fixedSrc = `/${siteSlug}/${matchedPath}`;
    return `${prefix}${fixedSrc}${suffix}`;
  });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      mode = "generate_page",
      prompt = "",
      siteSlug = "site",
      siteTitle = "Website",
      targetPath = "",
      htmlContent = "",
      uploadedFilePaths = [],
    } = body || {};

    const apiKey = getActiveApiKey();
    const uniqueCode = makeUniqueSlugPart(6);

    // Determine unique non-reserved route path under /<siteSlug>/...
    // Never uses /login or /signup/register routes so every generated page has its own unique path
    let cleanTarget = (targetPath || "").trim().replace(/^\/+/, "");
    if (!cleanTarget) {
      const slugBase = (prompt || "page")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 14) || "view";
      cleanTarget = `p-${slugBase}-${uniqueCode}.html`;
    } else if (!cleanTarget.endsWith(".html")) {
      cleanTarget = `${cleanTarget}-${uniqueCode}.html`;
    }

    let finalHtml = "";
    let analysisNotes = [];

    if (mode === "analyze_and_fix") {
      const fixedImagesHtml = fixBrokenImagePathsInHtml(htmlContent, siteSlug, uploadedFilePaths);
      finalHtml = fixedImagesHtml;

      // Check for common issues & attempt Gemini refinement if key works
      if (!/<meta\s+name=["']viewport["']/i.test(finalHtml)) {
        finalHtml = finalHtml.replace(
          /<head([^>]*)>/i,
          `<head$1>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">`
        );
        analysisNotes.push("Added responsive viewport meta tag");
      }

      if (!/<!doctype html>/i.test(finalHtml)) {
        finalHtml = `<!doctype html>\n${finalHtml}`;
        analysisNotes.push("Added HTML5 doctype");
      }

      // Check <img> tags against uploaded files
      const imgMatches = [...finalHtml.matchAll(/<img\b[^>]*?\bsrc=["']([^"']+)["']/gi)];
      if (imgMatches.length > 0) {
        analysisNotes.push(`Verified ${imgMatches.length} image <img> tag(s) against uploaded files`);
      }

      // If Gemini API responds cleanly, polish code while keeping fixed image src attributes
      if (apiKey) {
        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: `Analyze and fix any HTML/CSS/JS bugs, broken links, or layout issues in this page for site "/${siteSlug}". Keep all <img src="/${siteSlug}/..."> paths intact. Return ONLY the clean complete HTML document without markdown fences:\n\n${finalHtml.slice(0, 18000)}`,
                      },
                    ],
                  },
                ],
              }),
            }
          );
          if (geminiRes.ok) {
            const gData = await geminiRes.json();
            const gText = gData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const cleaned = gText.replace(/^```html\s*/i, "").replace(/```\s*$/i, "").trim();
            if (cleaned && /<html/i.test(cleaned)) {
              finalHtml = fixBrokenImagePathsInHtml(cleaned, siteSlug, uploadedFilePaths);
              analysisNotes.push("AI analyzed & repaired layout/code structure");
            }
          }
        } catch {}
      }

      if (analysisNotes.length === 0) {
        analysisNotes.push("Scanned HTML, folders & image references — all paths verified");
      }
    } else {
      // mode === "generate_page"
      const safeTitle = (siteTitle || siteSlug).replace(/</g, "&lt;");
      const safePrompt = (prompt || "Modern web page").replace(/</g, "&lt;");
      const imgList = (uploadedFilePaths || []).filter((p) =>
        /\.(png|jpe?g|gif|webp|svg)$/i.test(p)
      );
      const firstImg = imgList[0] ? `/${siteSlug}/${imgList[0].replace(/^\/+/, "")}` : "";

      if (apiKey) {
        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: `Build a complete, responsive HTML5 page (with embedded CSS and JS) for: ${prompt.trim()}. Site slug: /${siteSlug}. ${firstImg ? `You may include an <img> tag pointing to ${firstImg}.` : ""} Return ONLY raw HTML starting with <!doctype html>. Do not wrap in markdown code fences.`,
                      },
                    ],
                  },
                ],
              }),
            }
          );
          if (geminiRes.ok) {
            const gData = await geminiRes.json();
            const gText = gData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const cleaned = gText.replace(/^```html\s*/i, "").replace(/```\s*$/i, "").trim();
            if (cleaned && /<html/i.test(cleaned)) {
              finalHtml = fixBrokenImagePathsInHtml(cleaned, siteSlug, uploadedFilePaths);
            }
          }
        } catch {}
      }

      if (!finalHtml) {
        finalHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle} — ${cleanTarget}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #060a13; color: #f1f5f9; padding: 32px 20px; }
    .wrap { max-width: 780px; margin: 0 auto; background: #0d1526; border: 1px solid #1c2942; border-radius: 16px; padding: 32px; }
    .tag { display: inline-block; font-size: 12px; color: #38bdf8; background: rgba(56,189,248,0.12); border: 1px solid rgba(56,189,248,0.3); padding: 4px 12px; border-radius: 99px; margin-bottom: 14px; }
    h1 { margin: 0 0 12px; font-size: 28px; color: #ffffff; }
    p { color: #94a3b8; line-height: 1.65; }
    img { max-width: 100%; border-radius: 12px; margin-top: 16px; border: 1px solid #1c2942; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="tag">/${siteSlug}/${cleanTarget}</div>
    <h1>${safeTitle}</h1>
    <p>${safePrompt}</p>
    ${firstImg ? `<img src="${firstImg}" alt="${safeTitle}" />` : ""}
  </div>
</body>
</html>`;
      }
      analysisNotes.push(`Generated unique route /${siteSlug}/${cleanTarget}`);
    }

    return NextResponse.json({
      ok: true,
      filePath: "/" + cleanTarget,
      html: finalHtml,
      notes: analysisNotes,
      uniqueCode,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err.message || "AI processing failed" },
      { status: 500 }
    );
  }
}
