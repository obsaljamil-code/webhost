"use client";

import AdSenseBanner from "@/app/components/AdSenseBanner";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { resolveLoginEmail } from "@/lib/authHelpers";

const STEPS = ["email", "code", "password"];

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState("email");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function sendCode(e) {
    e.preventDefault();
    setBusy(true);
    setError("");

    const resolved = await resolveLoginEmail(identifier);
    if (!resolved) {
      setBusy(false);
      setError("We couldn't find an account with that username or email.");
      return;
    }

    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email: resolved,
      options: { shouldCreateUser: false },
    });

    setBusy(false);
    if (otpErr) {
      setError(otpErr.message);
      return;
    }
    setEmail(resolved);
    setNotice(`We sent a 6-digit code to ${resolved}.`);
    setStep("code");
  }

  async function verifyCode(e) {
    e.preventDefault();
    setBusy(true);
    setError("");

    const { error: verifyErr } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });

    setBusy(false);
    if (verifyErr) {
      setError("That code didn't work - check it and try again.");
      return;
    }
    setNotice("");
    setStep("password");
  }

  async function setNewPassword(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password should be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setBusy(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateErr) {
      setError(updateErr.message);
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

        <div className="step-dots">
          {STEPS.map((s) => (
            <span key={s} className={`step-dot ${s === step ? "active" : ""}`} />
          ))}
        </div>

        <h1 style={{ fontSize: 22, marginBottom: 20 }}>Reset your password</h1>

        {notice && <div className="notice" style={{ marginBottom: 16 }}>{notice}</div>}
        {error && <div className="notice error" style={{ marginBottom: 16 }}>{error}</div>}

        {step === "email" && (
          <form onSubmit={sendCode}>
            <div className="field">
              <span className="field-label">Username or email</span>
              <input
                className="input"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoFocus
              />
            </div>
            <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
              {busy ? "Sending…" : "Send code"}
            </button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={verifyCode}>
            <div className="field">
              <span className="field-label">6-digit code</span>
              <input
                className="input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                inputMode="numeric"
                required
                autoFocus
              />
            </div>
            <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
              {busy ? "Verifying…" : "Verify"}
            </button>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={setNewPassword}>
            <div className="field">
              <span className="field-label">New password</span>
              <input
                className="input"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="field">
              <span className="field-label">Confirm new password</span>
              <input
                className="input"
                type="text"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
              {busy ? "Saving…" : "Save password & log in"}
            </button>
          </form>
        )}

        <p className="auth-foot">
          Remembered it after all? <a href="/login">Log in</a>
        </p>
      
      <AdSenseBanner style={{ position: "fixed", bottom: 8, left: 0, right: 0, zIndex: 10 }} />
      </div>
    </div>
  );
}
