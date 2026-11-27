"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { generatePassword } from "@/lib/authHelpers";

export default function SignupPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [usernameState, setUsernameState] = useState(null); // 'checking' | 'ok' | 'bad'

  useEffect(() => {
    const clean = username.trim().toLowerCase();
    if (clean.length < 3) {
      setUsernameState(null);
      return;
    }
    setUsernameState("checking");
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("is_username_available", {
        p_username: clean,
      });
      setUsernameState(data ? "ok" : "bad");
    }, 350);
    return () => clearTimeout(t);
  }, [username]);

  async function handleSignup(e) {
    e.preventDefault();
    setError("");

    if (usernameState !== "ok") {
      setError("Pick a username that's available first.");
      return;
    }
    if (password.length < 8) {
      setError("Password should be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setBusy(true);
    const { error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          username: username.trim().toLowerCase(),
          full_name: `${firstName} ${lastName}`.trim(),
        },
      },
    });

    setBusy(false);
    if (signUpErr) {
      setError(signUpErr.message);
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
          Sign up
        </h1>

        {error && (
          <div className="notice error" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSignup}>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <span className="field-label">First name</span>
              <input
                className="input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <span className="field-label">Last name</span>
              <input
                className="input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <span className="field-label">Username</span>
            <input
              className={`input ${usernameState === "ok" ? "ok" : usernameState === "bad" ? "bad" : ""}`}
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
              placeholder="at-least-3-characters"
              required
            />
            {usernameState === "ok" && (
              <span className="availability ok">
                <span className="availability-dot" /> Available
              </span>
            )}
            {usernameState === "bad" && (
              <span className="availability bad">
                <span className="availability-dot" /> Already taken
              </span>
            )}
          </div>

          <div className="field">
            <span className="field-label">Email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="field-label">Password</span>
              <button
                type="button"
                onClick={() => {
                  const p = generatePassword();
                  setPassword(p);
                  setConfirm(p);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--accent-2)",
                  fontSize: 12.5,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Generate one
              </button>
            </div>
            <input
              className="input"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
            />
          </div>

          <div className="field">
            <span className="field-label">Confirm password</span>
            <input
              className="input"
              type="text"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>

          <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
            {busy ? "Creating your account…" : "Sign up"}
          </button>
        </form>

        <p className="auth-foot">
          Already have an account? <a href="/login">Log in</a>
        </p>
      
      </div>
    </div>
  );
}
