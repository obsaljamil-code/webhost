"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { resolveLoginEmail } from "@/lib/authHelpers";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setBusy(true);
    setError("");

    const email = await resolveLoginEmail(identifier);
    if (!email) {
      setError("We couldn't find an account with that username or email.");
      setBusy(false);
      return;
    }

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setBusy(false);
    if (signInErr) {
      setError("Wrong username/email or password.");
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand" style={{ justifyContent: "center", marginBottom: 32 }}>
          <img src="/mark.svg" alt="" className="mark" />
          <span className="brand-name">WebHost LavaMC</span>
        </div>

        <h1 style={{ fontSize: 22, textAlign: "center", marginBottom: 24 }}>
          Log in
        </h1>

        {error && (
          <div className="notice error" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="field">
            <span className="field-label">Username or email</span>
            <input
              className="input"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>
          <div className="field">
            <span className="field-label">Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <div style={{ textAlign: "right", marginTop: 6 }}>
              <a href="/forgot-password" style={{ fontSize: 13 }}>
                Forgot password?
              </a>
            </div>
          </div>
          <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="auth-foot">
          Don't have an account? <a href="/signup">Sign up</a>
        </p>
      
      </div>
    </div>
  );
}
