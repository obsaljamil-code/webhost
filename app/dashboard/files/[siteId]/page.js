"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "host.lavamc.dpdns.org";
const EDITABLE_EXTENSIONS = ["html", "htm", "css", "js", "json", "txt", "svg", "md", "xml"];

function isEditablePath(path) {
  const ext = path.split(".").pop().toLowerCase();
  return EDITABLE_EXTENSIONS.includes(ext);
}

function guessContentType(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  const map = {
    html: "text/html",
    htm: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
    ico: "image/x-icon",
    txt: "text/plain",
    xml: "application/xml",
    md: "text/markdown",
    pdf: "application/pdf",
    woff: "font/woff",
    woff2: "font/woff2",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
  };
  return map[ext] || "application/octet-stream";
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function DedicatedFileManagerPage() {
  const params = useParams();
  const siteId = params?.siteId;
  const router = useRouter();

  const [session, setSession] = useState(null);
  const [site, setSite] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Loading…");
  const [message, setMessage] = useState(null);

  const [selected, setSelected] = useState(new Set());
  const [openRowMenuId, setOpenRowMenuId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  // Live code editor
  const [editingFile, setEditingFile] = useState(null);
  const [editorContent, setEditorContent] = useState("");
  const [editorBusy, setEditorBusy] = useState(false);

  // Create new file modal
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");

  // Page & Unique Link Builder modal (no API key input/save UI for end-users)
  const [builderOpen, setBuilderOpen] = useState(false);
  const [pagePrompt, setPagePrompt] = useState("");
  const [customPath, setCustomPath] = useState("");
  const [buildingPage, setBuildingPage] = useState(false);
  const [generatedPageUrl, setGeneratedPageUrl] = useState("");

  const loadFiles = useCallback(async () => {
    if (!siteId) return [];
    const { data } = await supabase
      .from("site_files")
      .select("id, file_path, storage_path, content_type, size_bytes")
      .eq("site_id", siteId)
      .order("file_path");
    const list = data || [];
    setFiles(list);
    return list;
  }, [siteId]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setSession(data.session);

      const { data: siteRow, error } = await supabase
        .from("sites")
        .select("id, subdomain, title, owner_id")
        .eq("id", siteId)
        .eq("owner_id", data.session.user.id)
        .maybeSingle();

      if (error || !siteRow) {
        router.replace("/dashboard");
        return;
      }

      setSite(siteRow);
      await loadFiles();
      setLoading(false);
    });
  }, [siteId, router, loadFiles]);

  // Silently runs server-side path & image fix on HTML files without showing internal analysis jargon
  async function silentlyOptimizeHtmlEntries(entries, allFilePaths) {
    const processed = [];
    for (const item of entries) {
      const cleanPath = item.path.replace(/^\/+/, "");
      const isHtml = /\.(html?)$/i.test(cleanPath);
      if (!isHtml) {
        processed.push({ ...item, path: cleanPath });
        continue;
      }
      try {
        const rawHtml = await item.blob.text();
        const res = await fetch("/api/ai-studio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "analyze_and_fix",
            siteSlug: site.subdomain,
            siteTitle: site.title || site.subdomain,
            htmlContent: rawHtml,
            uploadedFilePaths: allFilePaths,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.ok && data.html) {
            processed.push({
              path: cleanPath,
              blob: new Blob([data.html], { type: "text/html" }),
              contentType: "text/html",
            });
            continue;
          }
        }
      } catch {}
      processed.push({ ...item, path: cleanPath });
    }
    return processed;
  }

  async function uploadEntries(entries, options = { silentFix: true }) {
    if (!session || !site || entries.length === 0) return;
    setBusy(true);
    setLoadingLabel("Loading & publishing…");
    setMessage(null);

    try {
      const existingPaths = files.map((f) => f.file_path.replace(/^\/+/, ""));
      const newPaths = entries.map((e) => e.path.replace(/^\/+/, ""));
      const combinedPaths = Array.from(new Set([...existingPaths, ...newPaths]));

      const finalEntries = options.silentFix
        ? await silentlyOptimizeHtmlEntries(entries, combinedPaths)
        : entries.map((e) => ({ ...e, path: e.path.replace(/^\/+/, "") }));

      for (const { path, blob, contentType } of finalEntries) {
        if (!path) continue;
        const storagePath = `${session.user.id}/${site.id}/${path}`;

        const { error: upErr } = await supabase.storage
          .from("site-files")
          .upload(storagePath, blob, { contentType, upsert: true, cacheControl: "0" });
        if (upErr) throw upErr;

        const { error: dbErr } = await supabase.from("site_files").upsert(
          {
            site_id: site.id,
            file_path: "/" + path,
            storage_path: storagePath,
            content_type: contentType,
            size_bytes: blob.size,
          },
          { onConflict: "site_id,file_path" }
        );
        if (dbErr) throw dbErr;
      }

      setMessage({
        tone: "info",
        text: `✓ Live now at https://${ROOT_DOMAIN}/${site.subdomain} (${finalEntries.length} file(s) updated)`,
      });
      await loadFiles();
    } catch (err) {
      setMessage({ tone: "error", text: `Upload failed: ${err.message}` });
    } finally {
      setBusy(false);
    }
  }

  async function handleFilesUpload(e) {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return;
    const entries = picked.map((f) => ({
      path: f.name,
      blob: f,
      contentType: guessContentType(f.name),
    }));
    await uploadEntries(entries);
    e.target.value = "";
  }

  // Preserves folder hierarchy when uploading a folder
  async function handleFolderUpload(e) {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return;
    const entries = picked
      .filter((f) => !f.name.startsWith(".") && !(f.webkitRelativePath || "").includes("__MACOSX"))
      .map((f) => {
        const rel = f.webkitRelativePath || f.name;
        const withoutRoot = rel.includes("/") ? rel.split("/").slice(1).join("/") : rel;
        return {
          path: withoutRoot || rel,
          blob: f,
          contentType: guessContentType(f.name),
        };
      });
    await uploadEntries(entries);
    e.target.value = "";
  }

  // Preserves folders & images inside ZIP archives
  async function handleZipUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setLoadingLabel("Loading ZIP & folders…");
    setMessage(null);

    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(file);
      const rawPaths = Object.entries(zip.files)
        .filter(([p, entry]) => !entry.dir && !p.startsWith("__MACOSX/") && !p.endsWith(".DS_Store"))
        .map(([p]) => p);

      let commonPrefix = "";
      if (rawPaths.length > 0 && rawPaths.every((p) => p.includes("/"))) {
        const firstSeg = rawPaths[0].split("/")[0] + "/";
        if (rawPaths.every((p) => p.startsWith(firstSeg))) {
          commonPrefix = firstSeg;
        }
      }

      const entries = [];
      for (const relPath of rawPaths) {
        const entry = zip.files[relPath];
        const cleanRel = commonPrefix ? relPath.slice(commonPrefix.length) : relPath;
        if (!cleanRel) continue;
        const blob = await entry.async("blob");
        entries.push({
          path: cleanRel,
          blob,
          contentType: guessContentType(cleanRel),
        });
      }

      setBusy(false);
      await uploadEntries(entries);
    } catch (err) {
      setBusy(false);
      setMessage({ tone: "error", text: `ZIP extraction failed: ${err.message}` });
    }
    e.target.value = "";
  }

  async function handleCreateNewFile(e) {
    e.preventDefault();
    const clean = newFileName.trim().replace(/^\/+/, "");
    if (!clean) return;

    const starter = clean.endsWith(".html")
      ? `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${clean} — ${site.subdomain}</title>\n</head>\n<body>\n  <h1>${clean}</h1>\n</body>\n</html>\n`
      : clean.endsWith(".css")
      ? "body { margin: 0; font-family: system-ui, sans-serif; }\n"
      : "";

    const contentType = guessContentType(clean);
    const blob = new Blob([starter], { type: contentType });

    setNewFileName("");
    setNewModalOpen(false);
    await uploadEntries([{ path: clean, blob, contentType }]);
  }

  // Generates a unique route URL per created page under /<siteSlug>/...
  async function handleBuildUniquePage(e) {
    e.preventDefault();
    if (!pagePrompt.trim()) return;

    setBuildingPage(true);
    setGeneratedPageUrl("");

    try {
      const allPaths = files.map((f) => f.file_path.replace(/^\/+/, ""));
      const res = await fetch("/api/ai-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "generate_page",
          prompt: pagePrompt.trim(),
          siteSlug: site.subdomain,
          siteTitle: site.title || site.subdomain,
          targetPath: customPath.trim(),
          uploadedFilePaths: allPaths,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok || !data.html) {
        throw new Error(data?.error || "Could not create page");
      }

      const relPath = (data.filePath || "/page.html").replace(/^\/+/, "");
      await uploadEntries(
        [{ path: relPath, blob: new Blob([data.html], { type: "text/html" }), contentType: "text/html" }],
        { silentFix: false }
      );

      const pageLink = `https://${ROOT_DOMAIN}/${site.subdomain}/${relPath}`;
      setGeneratedPageUrl(pageLink);
    } catch (err) {
      setMessage({ tone: "error", text: err.message });
    } finally {
      setBuildingPage(false);
    }
  }

  async function deleteFile(file) {
    setOpenRowMenuId(null);
    setBusy(true);
    setLoadingLabel("Deleting file…");
    await supabase.storage.from("site-files").remove([file.storage_path]);
    await supabase.from("site_files").delete().eq("id", file.id);
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(file.id);
      return next;
    });
    if (editingFile?.id === file.id) setEditingFile(null);
    setMessage({ tone: "info", text: `Deleted ${file.file_path} — removed from live site.` });
    await loadFiles();
    setBusy(false);
  }

  async function deleteSelected() {
    const toDelete = files.filter((f) => selected.has(f.id));
    if (toDelete.length === 0) return;
    setBusy(true);
    setLoadingLabel("Deleting files…");
    await supabase.storage.from("site-files").remove(toDelete.map((f) => f.storage_path));
    await supabase.from("site_files").delete().in("id", toDelete.map((f) => f.id));
    setSelected(new Set());
    setMessage({ tone: "info", text: `Deleted ${toDelete.length} file(s).` });
    await loadFiles();
    setBusy(false);
  }

  function startRename(file) {
    setOpenRowMenuId(null);
    setRenamingId(file.id);
    setRenameValue(file.file_path.replace(/^\/+/, ""));
  }

  async function confirmRename(file) {
    const newPath = "/" + renameValue.trim().replace(/^\/+/, "");
    setRenamingId(null);
    if (!renameValue.trim() || newPath === file.file_path) return;

    setBusy(true);
    setLoadingLabel("Renaming file…");
    try {
      const newStoragePath = `${session.user.id}/${site.id}${newPath}`;
      const { data: blob, error: dlErr } = await supabase.storage
        .from("site-files")
        .download(file.storage_path);
      if (dlErr) throw dlErr;

      const { error: upErr } = await supabase.storage
        .from("site-files")
        .upload(newStoragePath, blob, { contentType: file.content_type, upsert: true, cacheControl: "0" });
      if (upErr) throw upErr;

      await supabase.storage.from("site-files").remove([file.storage_path]);

      const { error: dbErr } = await supabase
        .from("site_files")
        .update({ file_path: newPath, storage_path: newStoragePath })
        .eq("id", file.id);
      if (dbErr) throw dbErr;

      setMessage({ tone: "info", text: `Renamed to ${newPath} — live immediately.` });
      await loadFiles();
    } catch (err) {
      setMessage({ tone: "error", text: `Rename failed: ${err.message}` });
    } finally {
      setBusy(false);
    }
  }

  async function openEditor(file) {
    setOpenRowMenuId(null);
    setBusy(true);
    setLoadingLabel("Opening file…");
    const { data: blob, error } = await supabase.storage
      .from("site-files")
      .download(file.storage_path);
    setBusy(false);

    if (error) {
      setMessage({ tone: "error", text: `Couldn't open file: ${error.message}` });
      return;
    }
    setEditorContent(await blob.text());
    setEditingFile(file);
  }

  async function saveEditor() {
    if (!editingFile) return;
    setEditorBusy(true);
    try {
      const allPaths = files.map((f) => f.file_path.replace(/^\/+/, ""));
      let contentToSave = editorContent;
      if (/\.(html?)$/i.test(editingFile.file_path)) {
        const [fixed] = await silentlyOptimizeHtmlEntries(
          [{ path: editingFile.file_path, blob: new Blob([editorContent], { type: "text/html" }), contentType: "text/html" }],
          allPaths
        );
        if (fixed?.blob) contentToSave = await fixed.blob.text();
      }

      const blob = new Blob([contentToSave], { type: editingFile.content_type || "text/plain" });
      const { error: upErr } = await supabase.storage
        .from("site-files")
        .upload(editingFile.storage_path, blob, {
          contentType: editingFile.content_type,
          upsert: true,
          cacheControl: "0",
        });
      if (upErr) throw upErr;

      await supabase.from("site_files").update({ size_bytes: blob.size }).eq("id", editingFile.id);
      setEditorContent(contentToSave);
      setMessage({ tone: "info", text: `✓ Saved & published ${editingFile.file_path} — live right now!` });
      await loadFiles();
    } catch (err) {
      setMessage({ tone: "error", text: `Save failed: ${err.message}` });
    } finally {
      setEditorBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="auth-shell">
        <div style={{ color: "var(--accent-2)", fontSize: 15 }}>Loading…</div>
      </div>
    );
  }

  const liveBaseUrl = `https://${ROOT_DOMAIN}/${site.subdomain}`;
  const totalBytes = files.reduce((acc, f) => acc + (f.size_bytes || 0), 0);

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
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={() => router.push("/dashboard")}
            className="btn btn-ghost"
            style={{ padding: "8px 14px", fontSize: 13 }}
          >
            ← Dashboard
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 17.5 }}>📁 File Manager</h1>
              <span className="badge blue">/{site.subdomain}</span>
              <span className="badge good">● Live</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
              {site.title || site.subdomain} · {files.length} files ({formatBytes(totalBytes)})
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => setBuilderOpen(true)}
            className="btn btn-ghost"
            style={{ padding: "8px 14px", borderColor: "#38bdf8", color: "#38bdf8" }}
          >
            + Create Unique Page Link
          </button>
          <a href={liveBaseUrl} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ padding: "8px 16px" }}>
            🌐 Visit Live Site ↗
          </a>
        </div>
      </header>

      <main style={{ maxWidth: 1120, margin: "26px auto", padding: "0 20px 64px" }}>
        {message && (
          <div className={`notice ${message.tone === "error" ? "error" : ""}`} style={{ marginBottom: 18 }}>
            {message.text}
          </div>
        )}

        <div
          style={{
            background: "var(--bg-raised)",
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: "15px 18px",
            marginBottom: 18,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            <label className="btn btn-primary" style={{ padding: "8px 15px", fontSize: 13 }}>
              {busy ? loadingLabel : "⬆️ Upload Files / Images"}
              <input type="file" multiple onChange={handleFilesUpload} disabled={busy} style={{ display: "none" }} />
            </label>

            <label className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 13 }}>
              📂 Upload Folder
              <input
                type="file"
                multiple
                onChange={handleFolderUpload}
                disabled={busy}
                webkitdirectory="true"
                directory="true"
                style={{ display: "none" }}
              />
            </label>

            <label className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 13 }}>
              📦 Upload ZIP
              <input type="file" accept=".zip" onChange={handleZipUpload} disabled={busy} style={{ display: "none" }} />
            </label>

            <button
              onClick={() => setNewModalOpen(true)}
              className="btn btn-ghost"
              disabled={busy}
              style={{ padding: "8px 14px", fontSize: 13, borderColor: "#1d4ed8", color: "#7dd3fc" }}
            >
              + New File
            </button>
          </div>

          {selected.size > 0 && (
            <button onClick={deleteSelected} className="btn btn-danger" style={{ padding: "8px 14px", fontSize: 12.5 }}>
              🗑️ Delete ({selected.size})
            </button>
          )}
        </div>

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
                <th style={{ width: 38 }}>
                  <input
                    type="checkbox"
                    checked={files.length > 0 && selected.size === files.length}
                    onChange={() =>
                      setSelected(selected.size === files.length ? new Set() : new Set(files.map((f) => f.id)))
                    }
                  />
                </th>
                <th>File / Folder / Page Path</th>
                <th>Size</th>
                <th style={{ textAlign: "right" }}>Actions (⋮)</th>
              </tr>
            </thead>
            <tbody>
              {files.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "44px 20px", color: "var(--text-muted)" }}>
                    No files yet. Upload files, folders, ZIPs, or create a unique page link.
                  </td>
                </tr>
              ) : (
                files.map((f) => {
                  const editable = isEditablePath(f.file_path);
                  const isIndex = f.file_path === "/index.html";
                  const fullFileUrl = `${liveBaseUrl}${f.file_path}`;

                  return (
                    <tr key={f.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(f.id)}
                          onChange={() =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(f.id)) next.delete(f.id);
                              else next.add(f.id);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td>
                        {renamingId === f.id ? (
                          <input
                            className="input"
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && confirmRename(f)}
                            onBlur={() => confirmRename(f)}
                            style={{ maxWidth: 320, padding: "5px 10px" }}
                          />
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <code
                              style={{ cursor: editable ? "pointer" : "default", color: isIndex ? "#38bdf8" : "#f1f5f9" }}
                              onClick={() => editable && openEditor(f)}
                            >
                              {f.file_path}
                            </code>
                            {isIndex && <span className="badge blue">Main</span>}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                          {formatBytes(f.size_bytes)}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {editable && (
                            <button
                              onClick={() => openEditor(f)}
                              className="btn btn-ghost"
                              style={{ padding: "5px 10px", fontSize: 12, color: "#38bdf8" }}
                            >
                              ✏️ Edit
                            </button>
                          )}
                          <a
                            href={fullFileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-ghost"
                            style={{ padding: "5px 10px", fontSize: 12 }}
                          >
                            Open ↗
                          </a>

                          <div className="menu-wrap">
                            <button
                              onClick={() => setOpenRowMenuId(openRowMenuId === f.id ? null : f.id)}
                              className="btn btn-ghost"
                              style={{ padding: "5px 9px", fontSize: 14, lineHeight: 1 }}
                              aria-label="File menu"
                            >
                              ⋮
                            </button>

                            {openRowMenuId === f.id && (
                              <div className="menu-popover" onMouseLeave={() => setOpenRowMenuId(null)}>
                                <button
                                  className="menu-item"
                                  onClick={() => {
                                    navigator.clipboard?.writeText(fullFileUrl);
                                    setOpenRowMenuId(null);
                                    setMessage({ tone: "info", text: `Copied link: ${fullFileUrl}` });
                                  }}
                                >
                                  🔗 Copy Link
                                </button>
                                <button className="menu-item" onClick={() => startRename(f)}>
                                  ✏️ Rename
                                </button>
                                <button className="menu-item danger" onClick={() => deleteFile(f)}>
                                  🗑️ Delete File
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {editingFile && (
          <div
            style={{
              marginTop: 22,
              background: "var(--bg-raised)",
              border: "1px solid var(--accent-2)",
              borderRadius: 14,
              padding: 20,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, color: "#38bdf8" }}>
                ✏️ Editor: <code>{editingFile.file_path}</code>
              </h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={saveEditor}
                  disabled={editorBusy}
                  className="btn btn-primary"
                  style={{ padding: "8px 16px", fontSize: 13 }}
                >
                  {editorBusy ? "Publishing…" : "💾 Save & Publish Live"}
                </button>
                <button onClick={() => setEditingFile(null)} className="btn btn-ghost" style={{ padding: "8px 13px", fontSize: 13 }}>
                  Close
                </button>
              </div>
            </div>
            <textarea
              value={editorContent}
              onChange={(e) => setEditorContent(e.target.value)}
              spellCheck={false}
              style={{
                width: "100%",
                height: 380,
                background: "#03060c",
                color: "#e2e8f0",
                border: "1px solid #2b3f63",
                borderRadius: 10,
                padding: 14,
                fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                fontSize: 13,
                lineHeight: 1.55,
              }}
            />
          </div>
        )}
      </main>

      {newModalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setNewModalOpen(false)}>
          <form onSubmit={handleCreateNewFile} className="modal-card">
            <h2 style={{ fontSize: 18, marginBottom: 10 }}>Create New File</h2>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 14px" }}>
              Example: <code>gallery.html</code>, <code>pages/team.html</code>, or <code>css/main.css</code>
            </p>
            <input
              className="input"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="pages/gallery.html"
              autoFocus
              required
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setNewModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {builderOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setBuilderOpen(false)}>
          <form onSubmit={handleBuildUniquePage} className="modal-card" style={{ maxWidth: 490 }}>
            <h2 style={{ fontSize: 18, marginBottom: 6 }}>Create Page & Unique Link</h2>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 14px" }}>
              Generates a page and publishes it under a unique URL for <code>/{site.subdomain}/</code>.
            </p>

            <div className="field">
              <span className="field-label">Custom Path Prefix (optional — auto-unique suffix added)</span>
              <input
                className="input"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                placeholder="offer-page (optional)"
              />
            </div>

            <div className="field">
              <span className="field-label">Page Details</span>
              <textarea
                className="input"
                rows={4}
                value={pagePrompt}
                onChange={(e) => setPagePrompt(e.target.value)}
                placeholder="Describe the layout, sections, or content for this page..."
                required
              />
            </div>

            {generatedPageUrl && (
              <div className="notice" style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: "#4ade80", marginBottom: 4 }}>✓ Live Page Link:</div>
                <a href={generatedPageUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, wordBreak: "break-all" }}>
                  {generatedPageUrl} ↗
                </a>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setBuilderOpen(false)}>
                Close
              </button>
              <button type="submit" className="btn btn-primary" disabled={buildingPage}>
                {buildingPage ? "Loading…" : "Publish & Get Link"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
