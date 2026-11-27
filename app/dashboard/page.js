"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "host.lavamc.dpdns.org";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // Top-left 3-dot button opens right-side slide drawer
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Modals: New Website Wizard, External DB Config
  const [wizardOpen, setWizardOpen] = useState(false);
  const [dbModalSite, setDbModalSite] = useState(null);

  const loadSites = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from("sites")
      .select(
        "id, subdomain, title, description, upload_type, view_count, custom_domain, custom_domain_status, created_at"
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    if (!error) setSites(data || []);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setUser(data.session.user);

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("is_admin, is_banned, display_name, site_limit")
        .eq("id", data.session.user.id)
        .maybeSingle();
      setProfile(profileRow);

      await loadSites(data.session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/login");
    });
    return () => sub.subscription.unsubscribe();
  }, [router, loadSites]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) return null;

  if (profile?.is_banned) {
    return (
      <div className="auth-shell">
        <div className="notice error" style={{ maxWidth: 420 }}>
          Your account has been suspended. If you think this is a mistake,
          contact the site owner.
        </div>
      </div>
    );
  }

  const totalViews = sites.reduce((acc, s) => acc + (s.view_count || 0), 0);
  const limit = profile?.site_limit ?? 3;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Top Bar with Left 3-Dot Trigger */}
      <header
        style={{
          background: "var(--bg-raised)",
          borderBottom: "1px solid var(--line)",
          padding: "14px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 25,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Left 3-dot button that opens right-side slide drawer */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="btn btn-ghost"
            style={{ padding: "8px 12px", fontSize: 16, lineHeight: 1 }}
            aria-label="Open sites drawer"
            title="Sites & Account Drawer"
          >
            ⋮
          </button>

          <a href="/" className="brand">
            <img src="/mark.svg" alt="" className="mark" />
            <span className="brand-name">WebHost LavaMC</span>
          </a>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setWizardOpen(true)}
            className="btn btn-primary"
            style={{ padding: "8px 16px", fontSize: 13 }}
            disabled={sites.length >= limit}
          >
            + New Site
          </button>
        </div>
      </header>

      {/* Right-Side Slide Drawer */}
      {drawerOpen && (
        <div
          className="drawer-backdrop"
          onClick={(e) => e.target === e.currentTarget && setDrawerOpen(false)}
        >
          <aside className="drawer-panel">
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingBottom: 16,
                  borderBottom: "1px solid var(--line)",
                  marginBottom: 20,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>
                    Created Sites ({sites.length}/{limit})
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Select a website to open File Manager
                  </div>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="btn btn-ghost"
                  style={{ padding: "6px 10px", fontSize: 13 }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: "grid", gap: 8, marginBottom: 24 }}>
                {sites.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--text-faint)", padding: "12px 4px" }}>
                    No websites created yet.
                  </div>
                ) : (
                  sites.map((s, idx) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setDrawerOpen(false);
                        router.push(`/dashboard/files/${s.id}`);
                      }}
                      style={{
                        background: "var(--bg-sunken)",
                        border: "1px solid var(--line)",
                        borderRadius: 10,
                        padding: "11px 13px",
                        color: "var(--text)",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 13.5,
                            color: "#fff",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {idx + 1}. {s.title || s.subdomain}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--accent-2)" }}>
                          /{s.subdomain}
                        </div>
                      </div>
                      <span className="badge blue">Files →</span>
                    </button>
                  ))
                )}
              </div>

              <div style={{ display: "grid", gap: 8, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    setWizardOpen(true);
                  }}
                  className="btn btn-primary"
                  disabled={sites.length >= limit}
                >
                  + Create New Website
                </button>

                {profile?.is_admin && (
                  <a
                    href="/admin"
                    className="btn btn-ghost"
                    style={{ justifyContent: "flex-start", color: "#38bdf8" }}
                  >
                    🛡️ Admin Panel & AI Assistant
                  </a>
                )}
              </div>
            </div>

            <div style={{ paddingTop: 16, borderTop: "1px solid var(--line)", marginTop: 24 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10, wordBreak: "break-all" }}>
                {user?.email}
              </div>
              <button onClick={signOut} className="btn btn-danger" style={{ width: "100%" }}>
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Dashboard Overview */}
      <main style={{ maxWidth: 980, margin: "32px auto", padding: "0 22px 64px" }}>
        <div
          style={{
            background: "linear-gradient(135deg, #0d1526 0%, #172554 100%)",
            border: "1px solid #1e3a8a",
            borderRadius: 16,
            padding: "24px 28px",
            marginBottom: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: "#93c5fd", marginBottom: 4 }}>
              WEBSITE HOSTING DASHBOARD
            </div>
            <h1 style={{ fontSize: 22, marginBottom: 6 }}>
              Total Sites Created: <span style={{ color: "#38bdf8" }}>{sites.length}</span>{" "}
              <span style={{ fontSize: 14, color: "#93c5fd", fontFamily: "Inter, sans-serif" }}>
                / {limit} allowed
              </span>
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "#cbd5e1" }}>
              Tap <code>⋮</code> at top-left to slide out your created websites, or open{" "}
              <strong>File Manager</strong> for folders, images, AI page links & custom domains.
            </p>
          </div>

          <button
            onClick={() => setWizardOpen(true)}
            className="btn btn-primary"
            disabled={sites.length >= limit}
          >
            + Create Website
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14,
            marginBottom: 24,
          }}
        >
          <MetricBox label="Sites Count" value={`${sites.length} Sites`} color="#38bdf8" />
          <MetricBox label="Total Views" value={totalViews.toLocaleString()} color="#4ade80" />
          <MetricBox label="Live Publishing" value="Instant (0s)" color="#60a5fa" />
        </div>

        {message && (
          <div className={`notice ${message.tone === "error" ? "error" : ""}`} style={{ marginBottom: 20 }}>
            {message.text}
          </div>
        )}

        {sites.length === 0 ? (
          <div
            style={{
              background: "var(--bg-raised)",
              border: "1px dashed #2b3f63",
              borderRadius: 16,
              padding: "48px 24px",
              textAlign: "center",
            }}
          >
            <h3 style={{ fontSize: 18, marginBottom: 8 }}>No websites created yet (0 sites)</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 14, maxWidth: 440, margin: "0 auto 20px" }}>
              Create your first website to get a link like <code>https://{ROOT_DOMAIN}/your-site</code> with subpages, folders, images & custom domain options.
            </p>
            <button onClick={() => setWizardOpen(true)} className="btn btn-primary">
              + Create Your First Website
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {sites.map((site) => (
              <SiteCard
                key={site.id}
                site={site}
                setMessage={setMessage}
                onChanged={() => loadSites(user.id)}
                onOpenDb={() => setDbModalSite(site)}
              />
            ))}
          </div>
        )}
      
      </main>

      {dbModalSite && (
        <ExternalDbModal site={dbModalSite} onClose={() => setDbModalSite(null)} />
      )}

      {wizardOpen && (
        <NewSiteWizard
          userId={user.id}
          onClose={() => setWizardOpen(false)}
          onCreated={(newSite) => {
            setWizardOpen(false);
            loadSites(user.id);
            if (newSite?.id) router.push(`/dashboard/files/${newSite.id}`);
          }}
          setMessage={setMessage}
        />
      )}
    </div>
  );
}

function MetricBox({ label, value, color }) {
  return (
    <div
      style={{
        background: "var(--bg-raised)",
        border: "1px solid var(--line)",
        borderRadius: 12,
        padding: "14px 16px",
      }}
    >
      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontFamily: "Unbounded, sans-serif", color }}>{value}</div>
    </div>
  );
}

function ExternalDbModal({ site, onClose }) {
  const storageKey = `obs_site_db_${site.id}`;
  const [provider, setProvider] = useState("Supabase");
  const [dbUrl, setDbUrl] = useState("");
  const [dbKey, setDbKey] = useState("");
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      if (saved.provider) setProvider(saved.provider);
      if (saved.dbUrl) setDbUrl(saved.dbUrl);
      if (saved.dbKey) setDbKey(saved.dbKey);
    } catch {}
  }, [storageKey]);

  function saveDbConfig(e) {
    e.preventDefault();
    try {
      localStorage.setItem(storageKey, JSON.stringify({ provider, dbUrl, dbKey }));
    } catch {}
    onClose();
  }

  const snippet = `<script>\n  window.SITE_DB_CONFIG = {\n    provider: "${provider}",\n    url: "${dbUrl || "https://your-project.supabase.co"}",\n    anonOrPublicKey: "${dbKey || "YOUR_PUBLIC_KEY"}"\n  };\n</script>`;

  function copySnippet() {
    navigator.clipboard?.writeText(snippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 1500);
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={saveDbConfig} className="modal-card" style={{ maxWidth: 500 }}>
        <h2 style={{ fontSize: 17, marginBottom: 6 }}>🗄️ External Database Config</h2>
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 16px" }}>
          Connect an external database (Supabase, Firebase, or REST API) for <code>/{site.subdomain}</code>:
        </p>

        <div className="field">
          <span className="field-label">Database Provider</span>
          <select className="input" value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="Supabase">Supabase (Postgres + Auth)</option>
            <option value="Firebase">Firebase (Firestore / Realtime DB)</option>
            <option value="Custom REST API">Custom Backend / REST API</option>
          </select>
        </div>

        <div className="field">
          <span className="field-label">Database / Project URL</span>
          <input className="input" value={dbUrl} onChange={(e) => setDbUrl(e.target.value)} placeholder="https://xyz.supabase.co" />
        </div>

        <div className="field">
          <span className="field-label">Public / Anon Key</span>
          <input className="input" value={dbKey} onChange={(e) => setDbKey(e.target.value)} placeholder="public-anon-key" />
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span className="field-label" style={{ margin: 0 }}>HTML &lt;head&gt; Config Snippet:</span>
            <button type="button" onClick={copySnippet} className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 11.5 }}>
              {copiedSnippet ? "✓ Copied" : "Copy Tag"}
            </button>
          </div>
          <pre
            style={{
              background: "var(--bg-sunken)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: 10,
              fontSize: 11.5,
              color: "#7dd3fc",
              overflowX: "auto",
              margin: 0,
            }}
          >
            {snippet}
          </pre>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Save Config</button>
        </div>
      </form>
    </div>
  );
}

async function createPlaceholderFiles(site, userId) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${(site.title || site.subdomain).replace(/</g, "")}</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
  <main>
    <div class="pill">● Live on ${ROOT_DOMAIN}/${site.subdomain}</div>
    <h1>${(site.title || site.subdomain).replace(/</g, "")}</h1>
    <p>Homepage: <strong>https://${ROOT_DOMAIN}/${site.subdomain}</strong></p>
    <p>Subpages & folders work automatically—for example <code>/${site.subdomain}/gallery.html</code> or <code>/${site.subdomain}/images/photo.png</code>.</p>
  </main>
</body>
</html>
`;

  const css = `body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #060a13;
  color: #f1f5f9;
  font-family: system-ui, -apple-system, sans-serif;
  text-align: center;
  padding: 24px;
}
main {
  max-width: 520px;
  background: #0d1526;
  border: 1px solid #1c2942;
  border-radius: 18px;
  padding: 36px 28px;
}
.pill {
  display: inline-block;
  font-size: 12px;
  color: #4ade80;
  background: rgba(5, 46, 22, 0.6);
  border: 1px solid #166534;
  padding: 4px 12px;
  border-radius: 99px;
  margin-bottom: 14px;
}
h1 { font-size: 26px; margin: 0 0 12px; color: #38bdf8; }
p { color: #94a3b8; line-height: 1.6; font-size: 14.5px; }
code { color: #7dd3fc; background: rgba(56,189,248,0.1); padding: 2px 6px; border-radius: 4px; }
`;

  const entries = [
    { path: "index.html", content: html, contentType: "text/html" },
    { path: "style.css", content: css, contentType: "text/css" },
  ];

  for (const { path, content, contentType } of entries) {
    const blob = new Blob([content], { type: contentType });
    const storagePath = `${userId}/${site.id}/${path}`;
    await supabase.storage.from("site-files").upload(storagePath, blob, { contentType, upsert: true, cacheControl: "0" });
    await supabase.from("site_files").upsert(
      { site_id: site.id, file_path: "/" + path, storage_path: storagePath, content_type: contentType, size_bytes: blob.size },
      { onConflict: "site_id,file_path" }
    );
  }
}

const UPLOAD_TYPES = [
  { id: "static", label: "Multi-Page Static Site", hint: "Main site + subpages + images/assets." },
  { id: "editor", label: "Folder Structure Site", hint: "Full folder hierarchy with subfolders." },
  { id: "zip", label: "ZIP Archive Site", hint: "Upload .zip and unpack all files & folders." },
];

function NewSiteWizard({ userId, onClose, onCreated, setMessage }) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploadType, setUploadType] = useState("static");
  const [subdomain, setSubdomain] = useState("");
  const [slugState, setSlugState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const clean = subdomain.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(clean)) {
      setSlugState(null);
      return;
    }
    setSlugState("checking");
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("is_subdomain_available", { p_subdomain: clean });
      setSlugState(data ? "ok" : "bad");
    }, 350);
    return () => clearTimeout(t);
  }, [subdomain]);

  async function handleCreate() {
    setError("");
    if (slugState !== "ok") {
      setError("Pick an available slug first.");
      return;
    }
    setBusy(true);
    const clean = subdomain.trim().toLowerCase();
    const { data: newSite, error: insertErr } = await supabase
      .from("sites")
      .insert({
        owner_id: userId,
        subdomain: clean,
        title: title || clean,
        description,
        upload_type: uploadType,
      })
      .select()
      .single();

    if (insertErr) {
      setBusy(false);
      if (insertErr.message.includes("reserved")) {
        setError("That name is reserved — try another.");
      } else if (insertErr.message.includes("site_limit_reached")) {
        setError("You have reached your free plan website limit.");
      } else {
        setError(insertErr.message);
      }
      return;
    }

    await createPlaceholderFiles(newSite, userId);

    setBusy(false);
    setMessage({ tone: "info", text: `Created ${ROOT_DOMAIN}/${clean}! Opening File Manager…` });
    onCreated(newSite);
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="step-dots">
          {[1, 2, 3].map((n) => (
            <span key={n} className={`step-dot ${n === step ? "active" : ""}`} />
          ))}
        </div>

        {error && <div className="notice error" style={{ marginBottom: 16 }}>{error}</div>}

        {step === 1 && (
          <>
            <h2 style={{ fontSize: 18, marginBottom: 16 }}>Name your website</h2>
            <div className="field">
              <span className="field-label">Website Name</span>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My Project" autoFocus />
            </div>
            <div className="field">
              <span className="field-label">Description (optional)</span>
              <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Multi-page site with folders & images" />
            </div>
            <WizardNav onNext={() => setStep(2)} onCancel={onClose} nextLabel="Next" />
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={{ fontSize: 18, marginBottom: 16 }}>Site structure</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {UPLOAD_TYPES.map((t) => (
                <label
                  key={t.id}
                  style={{
                    border: "1px solid",
                    borderColor: uploadType === t.id ? "var(--accent-2)" : "var(--line)",
                    background: uploadType === t.id ? "rgba(37, 99, 235, 0.1)" : "transparent",
                    borderRadius: 10,
                    padding: 13,
                    cursor: "pointer",
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  <input
                    type="radio"
                    name="uploadType"
                    checked={uploadType === t.id}
                    onChange={() => setUploadType(t.id)}
                    style={{ marginTop: 3 }}
                  />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{t.label}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{t.hint}</div>
                  </div>
                </label>
              ))}
            </div>
            <WizardNav onBack={() => setStep(1)} onNext={() => setStep(3)} onCancel={onClose} nextLabel="Next" />
          </>
        )}

        {step === 3 && (
          <>
            <h2 style={{ fontSize: 18, marginBottom: 16 }}>Choose site slug</h2>
            <div className="field">
              <span className="field-label">Base Address</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{ROOT_DOMAIN}/</span>
                <input
                  className={`input ${slugState === "ok" ? "ok" : slugState === "bad" ? "bad" : ""}`}
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  placeholder="your-site"
                  autoFocus
                  style={{ maxWidth: 190 }}
                />
              </div>
              {slugState === "ok" && (
                <span className="availability ok"><span className="availability-dot" /> Available</span>
              )}
              {slugState === "bad" && (
                <span className="availability bad"><span className="availability-dot" /> Already taken or reserved</span>
              )}
            </div>
            <WizardNav
              onBack={() => setStep(2)}
              onNext={handleCreate}
              onCancel={onClose}
              nextLabel={busy ? "Creating…" : "Create & Open File Manager"}
              nextDisabled={busy || slugState !== "ok"}
            />
          </>
        )}
      </div>
    </div>
  );
}

function WizardNav({ onBack, onNext, onCancel, nextLabel, nextDisabled }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22 }}>
      <button className="btn btn-ghost" onClick={onBack || onCancel}>
        {onBack ? "Back" : "Cancel"}
      </button>
      <button className="btn btn-primary" onClick={onNext} disabled={nextDisabled}>
        {nextLabel}
      </button>
    </div>
  );
}

function SiteCard({ site, setMessage, onChanged, onOpenDb }) {
  const router = useRouter();
  const [domainOpen, setDomainOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const url = `https://${ROOT_DOMAIN}/${site.subdomain}`;

  function copy() {
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function deleteSite() {
    const { data: files } = await supabase
      .from("site_files")
      .select("storage_path")
      .eq("site_id", site.id);

    if (files?.length) {
      await supabase.storage.from("site-files").remove(files.map((f) => f.storage_path));
    }
    const { error } = await supabase.from("sites").delete().eq("id", site.id);
    if (error) {
      setMessage({ tone: "error", text: `Couldn't delete: ${error.message}` });
      return;
    }
    setMessage({ tone: "info", text: `Deleted ${site.subdomain}.` });
    onChanged();
  }

  return (
    <div
      id={`site-${site.id}`}
      style={{
        background: "var(--bg-raised)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "18px 22px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 14,
        }}
      >
        <div style={{ minWidth: 220, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>
              {site.title || site.subdomain}
            </span>
            <span className="badge good">● Live</span>
            <span className="badge">{site.view_count || 0} views</span>
            {site.custom_domain_status === "pending" && <span className="badge">domain pending</span>}
            {site.custom_domain_status === "approved" && <span className="badge blue">{site.custom_domain}</span>}
          </div>

          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 13.5, color: "var(--accent-2)", textDecoration: "none", wordBreak: "break-all" }}
          >
            {url} ↗
          </a>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => router.push(`/dashboard/files/${site.id}`)}
            className="btn btn-primary"
            style={{ padding: "8px 15px", fontSize: 13 }}
          >
            📁 File Manager
          </button>

          <button
            onClick={onOpenDb}
            className="btn btn-ghost"
            style={{ padding: "8px 13px", fontSize: 13 }}
          >
            🗄️ DB Config
          </button>

          <button
            onClick={() => setDomainOpen((v) => !v)}
            className="btn btn-ghost"
            style={{ padding: "8px 13px", fontSize: 13 }}
          >
            🌐 Domain
          </button>

          <button onClick={copy} className="btn btn-ghost" style={{ padding: "8px 12px", fontSize: 13 }}>
            {copied ? "✓ Copied" : "Copy URL"}
          </button>

          {!confirmingDelete ? (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="btn btn-danger"
              style={{ padding: "8px 12px", fontSize: 13 }}
              title="Delete website"
            >
              🗑️
            </button>
          ) : (
            <button
              onClick={deleteSite}
              className="btn btn-danger"
              style={{ padding: "8px 12px", fontSize: 12 }}
            >
              Confirm?
            </button>
          )}
        </div>
      </div>

      {domainOpen && (
        <CustomDomainPanel site={site} setMessage={setMessage} onChanged={onChanged} />
      )}
    </div>
  );
}

function CustomDomainPanel({ site, setMessage, onChanged }) {
  const [domain, setDomain] = useState(site.custom_domain || "");
  const [busy, setBusy] = useState(false);
  const [dnsInfo, setDnsInfo] = useState(null);

  const cleanInput = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const txtHost = cleanInput ? `_lavamc.${cleanInput}` : "_lavamc.yourdomain.com";
  const txtValue = `lavamc-verify=${site.subdomain}`;

  async function verifyAndPublishDomain() {
    if (!cleanInput) return;
    setBusy(true);
    setDnsInfo(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token || "";
      const res = await fetch("/api/domains/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ siteId: site.id, domain: cleanInput }),
      });
      const data = await res.json();
      setDnsInfo(data);
      if (data?.verified) {
        setMessage({ tone: "info", text: `✓ ${data.message}` });
      } else {
        setMessage({ tone: "error", text: data?.message || data?.error || "DNS record not matched yet." });
      }
      onChanged();
    } catch (err) {
      setMessage({ tone: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 16, borderTop: "1px solid var(--line-soft)", paddingTop: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 6 }}>
        🌐 Custom Domain Auto-Connect (CNAME & TXT DNS Verification)
      </div>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 12px", lineHeight: 1.5 }}>
        Add either the <strong>CNAME</strong> record OR the <strong>TXT</strong> verification record in your domain DNS panel, then click <strong>Verify & Publish Now</strong> to make your domain live automatically:
      </p>

      <div
        style={{
          background: "var(--bg-sunken)",
          border: "1px solid var(--line)",
          borderRadius: 10,
          padding: "10px 14px",
          fontSize: 12,
          marginBottom: 12,
          display: "grid",
          gap: 6,
        }}
      >
        <div>
          <span className="badge blue" style={{ marginRight: 6 }}>Option 1: CNAME</span>
          Host: <code>{cleanInput || "www.yourdomain.com"}</code> → Target: <code>cname.vercel-dns.com</code>
        </div>
        <div>
          <span className="badge blue" style={{ marginRight: 6 }}>Option 2: TXT</span>
          Host: <code>{txtHost}</code> → Value: <code>{txtValue}</code>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          className="input"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="www.yourdomain.com"
          style={{ maxWidth: 270 }}
        />
        <button className="btn btn-primary" onClick={verifyAndPublishDomain} disabled={busy || !cleanInput}>
          {busy ? "Checking DNS…" : "⚡ Verify & Publish Now"}
        </button>
      </div>

      {site.custom_domain_status === "approved" && (
        <p style={{ fontSize: 12.5, color: "#4ade80", marginTop: 8 }}>
          ● Verified & Live: <code>https://{site.custom_domain}</code>
        </p>
      )}
      {site.custom_domain_status === "pending" && (
        <p style={{ fontSize: 12, color: "#fbbf24", marginTop: 8 }}>
          Status: Waiting for DNS propagation (CNAME or TXT). Click Verify & Publish Now after adding DNS records.
        </p>
      )}
      {site.custom_domain_status === "rejected" && (
        <p style={{ fontSize: 12, color: "#f87171", marginTop: 8 }}>Status: Rejected.</p>
      )}
      {dnsInfo && !dnsInfo.verified && (
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
          DNS Check: CNAME matched = {dnsInfo.cnameVerified ? "Yes" : "No"}, TXT matched = {dnsInfo.txtVerified ? "Yes" : "No"}
        </div>
      )}
    </div>
  );
}
