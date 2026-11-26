"use client";

import AdSenseBanner from "@/app/components/AdSenseBanner";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "host.lavamc.dpdns.org";

export default function HomePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/dashboard");
      } else {
        setChecking(false);
      }
    });
  }, [router]);

  if (checking) return null;

  return (
    <main style={{ position: "relative", overflow: "hidden", minHeight: "100vh" }}>
      <div className="glow" aria-hidden="true" />

      {/* Top Navigation */}
      <header
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1140,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "22px 24px",
        }}
      >
        <div className="brand">
          <img src="/mark.svg" alt="" className="mark" />
          <span className="brand-name">WebHost LavaMC</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => router.push("/login")}>
            Log in
          </button>
          <button className="btn btn-primary" onClick={() => router.push("/signup")}>
            Get Started Free
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 740,
          margin: "0 auto",
          padding: "64px 24px 48px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(37, 99, 235, 0.14)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            color: "#7dd3fc",
            padding: "6px 16px",
            borderRadius: 99,
            fontSize: 13,
            fontWeight: 500,
            marginBottom: 24,
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#38bdf8" }} />
          Zero-Config Cloud Static Hosting · Instant Live Deploy
        </div>

        <h1
          style={{
            fontSize: "clamp(32px, 5.5vw, 52px)",
            lineHeight: 1.12,
            marginBottom: 20,
            background: "linear-gradient(180deg, #ffffff 40%, #94a3b8 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Deploy your website in seconds, completely free.
        </h1>

        <p
          style={{
            color: "var(--text-muted)",
            fontSize: 17,
            maxWidth: 580,
            margin: "0 auto 34px",
            lineHeight: 1.65,
          }}
        >
          Upload HTML, CSS, JS, entire project folders, or ZIP archives with our built-in Pro File Manager and live code editor. Every save publishes immediately—no build pipelines, no ads, $0 forever.
        </p>

        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            className="btn btn-primary"
            style={{ padding: "13px 28px", fontSize: 15 }}
            onClick={() => router.push("/signup")}
          >
            Create Free Website →
          </button>
          <button
            className="btn btn-ghost"
            style={{ padding: "13px 24px", fontSize: 15 }}
            onClick={() => router.push("/login")}
          >
            Open Control Panel
          </button>
        </div>

        {/* Live URL Preview Bar */}
        <div
          style={{
            marginTop: 42,
            background: "var(--bg-raised)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: "12px 18px",
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            maxWidth: "100%",
            boxShadow: "0 16px 40px rgba(0,0,0,0.4)",
          }}
        >
          <span style={{ display: "flex", gap: 6 }}>
            <i style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444", display: "block" }} />
            <i style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b", display: "block" }} />
            <i style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", display: "block" }} />
          </span>
          <div
            style={{
              background: "var(--bg-sunken)",
              border: "1px solid var(--line-soft)",
              borderRadius: 8,
              padding: "6px 16px",
              fontSize: 13.5,
              color: "#cbd5e1",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            https://{ROOT_DOMAIN}/<span style={{ color: "#38bdf8", fontWeight: 600 }}>your-project</span>
          </div>
          <span className="badge good">● SSL Active</span>
        </div>
      </section>

      {/* How It Works */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1020,
          margin: "36px auto 72px",
          padding: "0 24px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 20,
        }}
      >
        <HowStep
          n="01"
          title="Create your account"
          body="Sign up in 30 seconds with your username and email—instant access to your hosting control panel."
        />
        <HowStep
          n="02"
          title="Manage files like cPanel"
          body="Open the dedicated File Manager to upload files, folders, or ZIPs—or edit HTML/CSS/JS live in your browser."
        />
        <HowStep
          n="03"
          title="Instant global delivery"
          body="Every upload or delete updates your live URL immediately with zero cache delay and free HTTPS."
        />
      </section>

      {/* Features Grid */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1020,
          margin: "0 auto 80px",
          padding: "0 24px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 22,
        }}
      >
        <Feature
          icon={<IconBolt />}
          title="0-Second Instant Deploy"
          body="Replace index.html or delete old files and your public site updates the very same second."
        />
        <Feature
          icon={<IconFolder />}
          title="Pro File Manager & IDE"
          body="Dedicated file explorer with ZIP auto-unpacking, folder tree support, rename/move, and built-in code editor."
        />
        <Feature
          icon={<IconLock />}
          title="Custom Domains & Free SSL"
          body="Start with a free instant address or connect your own custom domain with full HTTPS protection."
        />
      </section>

      {/* Pricing Card */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 460,
          margin: "0 auto 90px",
          padding: "0 24px",
        }}
      >
        <div
          style={{
            border: "1px solid #1d4ed8",
            borderRadius: 16,
            padding: "32px 28px",
            background: "linear-gradient(180deg, rgba(23, 37, 84, 0.5) 0%, var(--bg-raised) 100%)",
            boxShadow: "0 20px 50px rgba(37, 99, 235, 0.15)",
          }}
        >
          <div className="badge blue" style={{ marginBottom: 12 }}>Free Cloud Plan</div>
          <div style={{ fontSize: 38, fontFamily: "Unbounded, sans-serif", marginBottom: 18 }}>
            $0 <span style={{ fontSize: 14, color: "var(--text-muted)", fontFamily: "Inter, sans-serif", fontWeight: 400 }}>/ forever</span>
          </div>
          <ul style={{ listStyle: "none", margin: "0 0 24px", padding: 0, display: "grid", gap: 12 }}>
            <PlanLine text="Host up to 3 independent websites" />
            <PlanLine text="Dedicated File Manager + Live Code Editor" />
            <PlanLine text="Single files, full folders & auto-ZIP extraction" />
            <PlanLine text="Instant zero-cache publishing & free SSL" />
            <PlanLine text="Custom domain support + zero forced ads" />
          </ul>
          <button className="btn btn-primary" style={{ width: "100%", padding: "12px" }} onClick={() => router.push("/signup")}>
            Start Hosting Free
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          position: "relative",
          zIndex: 1,
          borderTop: "1px solid var(--line-soft)",
          padding: "26px 40px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div className="brand">
          <img src="/mark.svg" alt="" className="mark" style={{ width: 22, height: 22 }} />
          <span className="brand-name" style={{ fontSize: 14 }}>WebHost LavaMC</span>
        </div>
        <span style={{ fontSize: 13, color: "var(--text-faint)" }}>
          Next-Gen Static Cloud Hosting · Powered by Edge Network
        </span>
      </footer>

      <style>{`
        .glow {
          position: absolute;
          top: -280px;
          left: 50%;
          transform: translateX(-50%);
          width: 860px;
          height: 580px;
          border-radius: 50%;
          background: radial-gradient(circle at 40% 40%, #38bdf8, #2563eb 45%, transparent 72%);
          filter: blur(28px);
          opacity: 0.25;
          pointer-events: none;
        }
      `}</style>
    
      <AdSenseBanner />
      </main>
  );
}

function HowStep({ n, title, body }) {
  return (
    <div
      style={{
        background: "var(--bg-raised)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: 24,
        textAlign: "left",
      }}
    >
      <div
        style={{
          fontFamily: "Unbounded, sans-serif",
          fontSize: 13,
          color: "var(--accent-2)",
          marginBottom: 10,
        }}
      >
        STEP {n}
      </div>
      <h3 style={{ fontSize: 16, marginBottom: 8 }}>{title}</h3>
      <p style={{ color: "var(--text-muted)", fontSize: 13.5, margin: 0 }}>{body}</p>
    </div>
  );
}

function Feature({ icon, title, body }) {
  return (
    <div
      style={{
        background: "rgba(15, 23, 42, 0.55)",
        border: "1px solid var(--line-soft)",
        borderRadius: 14,
        padding: 24,
        textAlign: "left",
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          background: "rgba(37, 99, 235, 0.16)",
          border: "1px solid rgba(56, 189, 248, 0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 14,
          color: "var(--accent-2)",
        }}
      >
        {icon}
      </div>
      <h3 style={{ fontSize: 16, marginBottom: 8 }}>{title}</h3>
      <p style={{ color: "var(--text-muted)", fontSize: 13.5, margin: 0 }}>{body}</p>
    </div>
  );
}

function PlanLine({ text }) {
  return (
    <li style={{ display: "flex", gap: 10, fontSize: 14, color: "var(--text)" }}>
      <span style={{ color: "#38bdf8", fontWeight: 700 }}>✓</span>
      {text}
    </li>
  );
}

function IconBolt() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" strokeLinejoin="round" />
    </svg>
  );
}

function IconFolder() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" strokeLinejoin="round" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
