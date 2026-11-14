"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./auth-provider";

const headings = {
  login: ["Welcome back.", "Sign in to your Fiddle account.", "Sign in"],
  signup: ["Make room for music.", "Create your Fiddle account with your email.", "Create account"],
  forgot: ["Find your way back.", "We’ll email you a link to reset your password.", "Send reset link"],
  reset: ["A fresh start.", "Choose a new password for your Fiddle account.", "Save password"],
};

export default function AuthForm({ mode }) {
  const { client, user, loading, error: sessionError } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [callbackError, setCallbackError] = useState("");
  const [title, description, action] = headings[mode];

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.has("error")) {
      setCallbackError("This email link has expired or is invalid. Please request a new one.");
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (!client || busy) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      let result;
      if (mode === "signup") {
        if (password !== form.get("confirm")) throw new Error("The passwords do not match.");
        result = await client.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/account` } });
      } else if (mode === "forgot") {
        result = await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      } else if (mode === "reset") {
        if (password !== form.get("confirm")) throw new Error("The passwords do not match.");
        result = await client.auth.updateUser({ password });
      } else {
        result = await client.auth.signInWithPassword({ email, password });
      }
      if (result.error) throw result.error;
      if (mode === "forgot" || (mode === "signup" && !result.data.session)) {
        setEmailSent(true);
        setNotice(mode === "forgot"
          ? "If an account exists for that email, you’ll receive a password reset link. Check your inbox and spam folder."
          : "Check your inbox to confirm your email address, then sign in. You can keep using Practice Studio meanwhile.");
      } else {
        router.replace("/account");
      }
    } catch (failure) {
      setError(failure.message || "We couldn’t complete this request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const unavailable = !loading && !client;
  const recoveryMissing = mode === "reset" && !loading && !user;
  return (
    <main className="site-width auth-page">
      <section className="auth-story" aria-label="Fiddle accounts">
        <span className="auth-music" aria-hidden="true">♫</span>
        <p className="eyebrow">YOUR PRACTICE ROOM</p>
        <h1>{title}</h1>
        <p>{description}</p>
        <Link href="/practice">Continue to Practice Studio <span aria-hidden="true">↗</span></Link>
      </section>
      <section className="auth-card" aria-labelledby="auth-title">
        <h2 id="auth-title">{action}</h2>
        {loading ? <p role="status">Checking your account…</p> : unavailable ? (
          <p role="status">Accounts aren’t available yet. You can still use <Link href="/practice">Practice Studio</Link>.</p>
        ) : user && (mode === "login" || mode === "signup") ? (
          <p>You’re already signed in. <Link href="/account">Open your account</Link>.</p>
        ) : recoveryMissing ? (
          <p>Open the link from your reset email to choose a password. <Link href="/forgot-password">Request a new link</Link>.</p>
        ) : (
          <form className="auth-form" onSubmit={submit} aria-busy={busy}>
            {mode !== "reset" && <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} disabled={busy || emailSent} /></label>}
            {mode !== "forgot" && <label>Password<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "login" ? 1 : 8} disabled={busy || emailSent} />{mode !== "login" && <small>Use at least 8 characters.</small>}</label>}
            {(mode === "signup" || mode === "reset") && <label>Confirm password<input name="confirm" type="password" autoComplete="new-password" required minLength={8} disabled={busy || emailSent} /></label>}
            {!emailSent && <button className="primary-button" disabled={busy}>{busy ? "Please wait…" : action}<span aria-hidden="true">↗</span></button>}
            {emailSent && <button className="auth-text-button" type="button" onClick={() => { setEmailSent(false); setNotice(""); }}>Use a different email</button>}
          </form>
        )}
        {(error || callbackError || sessionError) && <p className="error" role="alert">{error || callbackError || sessionError}</p>}
        {notice && <p className="auth-notice" role="status">{notice}</p>}
        <div className="auth-links">
          {mode === "login" ? <><Link href="/signup">Create an account</Link><Link href="/forgot-password">Forgot password?</Link></> : <Link href="/login">Back to sign in</Link>}
        </div>
      </section>
    </main>
  );
}
