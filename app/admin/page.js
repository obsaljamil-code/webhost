"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "host.lavamc.dpdns.org";
const ADMIN_CHAT_STORAGE_KEY = "obs_admin_ai_chat_history_v1";

export default function AdminPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [domains, setDomains] = useState([]);
  const [allSites, setAllSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("ai-diagnostics");

  // Persistent Admin AI Chat History state
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(ADMIN_CHAT_STORAGE_KEY) || "[]");
      if (Array.isArray(saved)) setChatHistory(saved);
    } catch {}
  }, []);

  function persistChat(nextList) {
    setChatHistory(nextList);
    try {
      localStorage.setItem(ADMIN_CHAT_STORAGE_KEY, JSON.stringify(nextList));
    } catch {}
  }

  function deleteChatMessage(msgId) {
    persistChat(chatHistory.filter((m) => m.id !== msgId));
  }

  function clearAllChatHistory() {
    persistChat([]);
  }

  async function loadAll() {
    setError("");
    const [uRes, dRes, sRes] = await Promise.all([
      fetch("/api/admin/users"),
      fetch("/api/admin/domains"),
      supabase
        .from("sites")
        .select("id, subdomain, title, owner_id, is_published, view_count, custom_domain, custom_domain_status, created_at")
        .order("created_at", { ascending: false }),
    ]);

    if (uRes.status === 403 || uRes.status === 401) {
      setError("Admin access required.");
      setLoading(false);
      return;
    }

    const uData = await uRes.json();
    const dData = await dRes.json();
    setUsers(uData.users || []);
    setDomains(dData.domains || []);
    setAllSites(sRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setMe(data.session.user);
      loadAll();
    });
  }, [router]);

  // Compute site health / warning checks across published sites
  const siteDiagnostics = allSites.map((site) => {
    const warnings = [];
    if (!site.is_published) {
      warnings.push("Site is currently unpublished / draft");
    }
    if ((site.view_count || 0) === 0) {
      warnings.push("Published with 0 views — verify homepage index.html & asset paths");
    }
    if (site.custom_domain && site.custom_domain_status === "pending") {
      warnings.push(`Custom domain "${site.custom_domain}" awaiting approval`);
    }
    if (site.custom_domain && site.custom_domain_status === "rejected") {
      warnings.push(`Custom domain "${site.custom_domain}" was rejected`);
    }
    return {
      ...site,
      warnings,
      statusLabel: warnings.length > 0 ? "Needs Check" : "Healthy",
    };
  });

  async function handleAskAdminAi(e) {
    e.preventDefault();
    const question = chatInput.trim();
    if (!question || chatBusy) return;

    const userMsg = {
      id: `msg_${Date.now()}_u`,
      role: "user",
      text: question,
      time: new Date().toLocaleTimeString(),
    };
    const nextWithUser = [...chatHistory, userMsg];
    persistChat(nextWithUser);
    setChatInput("");
    setChatBusy(true);

    const warningSummary = siteDiagnostics
      .filter((s) => s.warnings.length > 0)
      .map((s) => `/${s.subdomain}: ${s.warnings.join("; ")}`)
      .join(" | ");

    const contextSnapshot = `Total Users: ${users.length}. Total Sites: ${allSites.length}. Sites with warnings/checks: ${
      warningSummary || "None flagged automatically"
    }. Pending Domains: ${domains.length}.`;

    try {
      const res = await fetch("/api/ai-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "generate_page",
          siteSlug: "admin-console",
          siteTitle: "Admin Diagnostic Assistant",
          targetPath: "admin-report.html",
          prompt: `You are an Admin Hosting Diagnostic Assistant. Answer the admin's question clearly and concisely in Bengali/English matching the question. Platform context: ${contextSnapshot}. Admin question: ${question}`,
        }),
      });

      let replyText = "";
      if (res.ok) {
        const data = await res.json();
        if (data?.html) {
          // Strip HTML tags for clean chat readout if full HTML was returned
          const plain = data.html
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          replyText = plain.slice(0, 1200);
        }
      }

      if (!replyText) {
        replyText =
          siteDiagnostics.filter((s) => s.warnings.length > 0).length > 0
            ? `Checked ${allSites.length} site(s). Warnings found: ${warningSummary}`
            : `Checked ${allSites.length} site(s) and ${users.length} user(s). No critical status warnings detected; inspect individual site files if a published site renders unexpectedly.`;
      }

      const aiMsg = {
        id: `msg_${Date.now()}_a`,
        role: "assistant",
        text: replyText,
        time: new Date().toLocaleTimeString(),
      };
      persistChat([...nextWithUser, aiMsg]);
    } catch {
      const fallbackMsg = {
        id: `msg_${Date.now()}_a`,
        role: "assistant",
        text: `Diagnostic snapshot: ${allSites.length} total sites, ${
          siteDiagnostics.filter((s) => s.warnings.length > 0).length
        } site(s) with warnings/checks.`,
        time: new Date().toLocaleTimeString(),
      };
      persistChat([...nextWithUser, fallbackMsg]);
    } finally {
      setChatBusy(false);
    }
  }

  async function toggleBan(u) {
    await fetch("/api/admin/ban", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: u.id, banned: !u.is_banned }),
    });
    loadAll();
  }

  async function changeLimit(u, siteLimit) {
    await fetch("/api/admin/limit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: u.id, siteLimit: Number(siteLimit) }),
    });
    loadAll();
  }

  async function decideDomain(siteId, decision) {
    await fetch("/api/admin/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, decision }),
    });
    loadAll();
  }

  if (loading) {
    return (
      <div className="auth-shell">
        <div style={{ color: "var(--accent-2)" }}>Loading Admin Console…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="auth-shell">
        <div className="notice error">{error}</div>
      </div>
    );
  }

  const warningCount = siteDiagnostics.filter((s) => s.warnings.length > 0).length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <header
        style={{
          background: "var(--bg-raised)",
          borderBottom: "1px solid var(--line)",
          padding: "16px 26px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/" className="brand">
            <img src="/mark.svg" alt="" className="mark" />
            <span className="brand-name">WebHost LavaMC</span>
          </a>
          <span className="badge blue">Admin Console</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{me?.email}</span>
          <a href="/dashboard" className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 13 }}>
            ← Dashboard
          </a>
        </div>
      </header>

      <main style={{ maxWidth: 1120, margin: "28px auto", padding: "0 20px 64px" }}>
        {/* Admin Navigation Tabs */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
          <button
            onClick={() => setActiveTab("ai-diagnostics")}
            className={`btn ${activeTab === "ai-diagnostics" ? "btn-primary" : "btn-ghost"}`}
          >
            🤖 AI Assistant & Site Warnings ({warningCount})
          </button>
          <button
            onClick={() => setActiveTab("domains")}
            className={`btn ${activeTab === "domains" ? "btn-primary" : "btn-ghost"}`}
          >
            🌐 Domain Requests ({domains.length})
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`btn ${activeTab === "users" ? "btn-primary" : "btn-ghost"}`}
          >
            👥 Users & Limits ({users.length})
          </button>
        </div>

        {activeTab === "ai-diagnostics" && (
          <div style={{ display: "grid", gap: 24 }}>
            {/* Site Warnings & Published Health Check Table */}
            <section>
              <h2 style={{ fontSize: 18, marginBottom: 12 }}>
                Published Sites Health & Warning Check ({siteDiagnostics.length})
              </h2>
              <div
                style={{
                  background: "var(--bg-raised)",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  overflowX: "auto",
                }}
              >
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Site Slug</th>
                      <th>Published URL</th>
                      <th>Status</th>
                      <th>Warnings / Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {siteDiagnostics.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ color: "var(--text-muted)" }}>
                          No sites created yet.
                        </td>
                      </tr>
                    ) : (
                      siteDiagnostics.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <code>/{s.subdomain}</code>
                          </td>
                          <td>
                            <a
                              href={`https://${ROOT_DOMAIN}/${s.subdomain}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              https://{ROOT_DOMAIN}/{s.subdomain} ↗
                            </a>
                          </td>
                          <td>
                            <span className={`badge ${s.warnings.length > 0 ? "warn" : "good"}`}>
                              {s.statusLabel}
                            </span>
                          </td>
                          <td style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                            {s.warnings.length > 0 ? s.warnings.join(" • ") : "Published & active"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Persistent Admin AI Chat with History + Delete Message / Clear History */}
            <section
              style={{
                background: "var(--bg-raised)",
                border: "1px solid var(--line)",
                borderRadius: 14,
                padding: 22,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <div>
                  <h2 style={{ fontSize: 17, marginBottom: 4 }}>
                    💬 Admin AI Diagnostic Chat (History Saved)
                  </h2>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                    Ask questions about site warnings, published links, or fixes. Chat history stays saved until you delete a message or clear history.
                  </div>
                </div>

                {chatHistory.length > 0 && (
                  <button
                    onClick={clearAllChatHistory}
                    className="btn btn-danger"
                    style={{ padding: "7px 13px", fontSize: 12 }}
                  >
                    🗑️ Clear Chat History
                  </button>
                )}
              </div>

              <div
                style={{
                  background: "var(--bg-sunken)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  padding: 16,
                  maxHeight: 380,
                  overflowY: "auto",
                  marginBottom: 14,
                  display: "grid",
                  gap: 10,
                }}
              >
                {chatHistory.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--text-faint)", textAlign: "center", padding: "24px 12px" }}>
                    No saved messages yet. Ask a question below—e.g. &ldquo;Which published sites have warnings?&rdquo;
                  </div>
                ) : (
                  chatHistory.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        background: m.role === "user" ? "rgba(37, 99, 235, 0.14)" : "var(--bg-raised)",
                        border: "1px solid var(--line)",
                        borderRadius: 10,
                        padding: "11px 14px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 5,
                          fontSize: 11.5,
                          color: "var(--text-muted)",
                        }}
                      >
                        <strong>{m.role === "user" ? "Admin (You)" : "AI Diagnostic"} · {m.time}</strong>
                        <button
                          type="button"
                          onClick={() => deleteChatMessage(m.id)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#f87171",
                            cursor: "pointer",
                            fontSize: 12,
                            padding: "2px 6px",
                          }}
                          title="Delete this message"
                        >
                          Delete ✕
                        </button>
                      </div>
                      <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--text)", whiteSpace: "pre-wrap" }}>
                        {m.text}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleAskAdminAi} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                  className="input"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about warnings, broken pages, or published sites..."
                  style={{ flex: 1, minWidth: 220 }}
                />
                <button type="submit" className="btn btn-primary" disabled={chatBusy || !chatInput.trim()}>
                  {chatBusy ? "Checking…" : "Ask AI"}
                </button>
              </form>
            </section>
          </div>
        )}

        {activeTab === "domains" && (
          <section>
            <h2 style={{ fontSize: 18, marginBottom: 14 }}>
              Custom Domain Requests ({domains.length})
            </h2>
            {domains.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No pending domain requests.</p>
            ) : (
              <div style={{ background: "var(--bg-raised)", border: "1px solid var(--line)", borderRadius: 14, overflowX: "auto" }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Site</th>
                      <th>Requested Domain</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {domains.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <code>/{d.subdomain}</code> — {d.title}
                        </td>
                        <td>
                          <code>{d.custom_domain}</code>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              className="btn btn-primary"
                              style={{ padding: "5px 12px", fontSize: 12 }}
                              onClick={() => decideDomain(d.id, "approve")}
                            >
                              Approve
                            </button>
                            <button
                              className="btn btn-danger"
                              style={{ padding: "5px 12px", fontSize: 12 }}
                              onClick={() => decideDomain(d.id, "reject")}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === "users" && (
          <section>
            <h2 style={{ fontSize: 18, marginBottom: 14 }}>Users ({users.length})</h2>
            <div style={{ background: "var(--bg-raised)", border: "1px solid var(--line)", borderRadius: 14, overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Sites</th>
                    <th>Limit</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ fontWeight: 500, color: "#fff" }}>{u.display_name || "—"}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{u.email}</div>
                      </td>
                      <td>{u.site_count}</td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          defaultValue={u.site_limit}
                          onBlur={(e) => {
                            if (Number(e.target.value) !== u.site_limit) {
                              changeLimit(u, e.target.value);
                            }
                          }}
                          className="input"
                          style={{ width: 68, padding: "5px 8px" }}
                        />
                      </td>
                      <td>
                        {u.is_banned ? (
                          <span className="badge warn">Banned</span>
                        ) : (
                          <span className="badge good">Active</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: "5px 12px", fontSize: 12 }}
                          onClick={() => toggleBan(u)}
                        >
                          {u.is_banned ? "Unban" : "Ban"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
