"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function formHref(path, returnTo) {
  return returnTo === "/account" ? path : `${path}?next=${encodeURIComponent(returnTo)}`;
}

export default function AuthPanel({ mode, returnTo = "/account", initialNotice = "" }) {
  const router = useRouter();
  const isSignup = mode === "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(initialNotice);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (isSignup && password !== confirmPassword) {
      setError("Those passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${isSignup ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnTo }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not sign you in.");
      if (data.needsEmailConfirmation) {
        setPassword("");
        setConfirmPassword("");
        setNotice("Check your inbox for a confirmation link. Use it to finish creating your account.");
        return;
      }
      router.replace(returnTo);
      router.refresh();
    } catch (requestError) {
      setError(requestError.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <Link className="brand auth-brand" href="/" aria-label="FlixNotMV home">
        <span className="brand-mark"><span aria-hidden="true">▶</span></span>
        <span>FlixNot<span className="brand-accent">MV</span></span>
      </Link>
      <section className="auth-panel" aria-labelledby="auth-title">
        <span className="auth-kicker">YOUR WATCHLIST, YOUR PLACE</span>
        <h1 id="auth-title">{isSignup ? "Create your account" : "Welcome back"}</h1>
        <p className="auth-intro">{isSignup ? "Keep your watch progress and picks together." : "Sign in to pick up where you left off."}</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="account-email">Email</label>
          <input
            id="account-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label htmlFor="account-password">Password</label>
          <input
            id="account-password"
            name="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            minLength={isSignup ? 10 : undefined}
            maxLength={256}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {isSignup && <>
            <label htmlFor="account-confirm-password">Confirm password</label>
            <input
              id="account-confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={10}
              maxLength={256}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            <p className="password-hint">Use at least 10 characters.</p>
          </>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          <button className="auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
          </button>
        </form>
        <p className="auth-switch">
          {isSignup ? "Already have an account?" : "New to FlixNotMV?"}{" "}
          <Link href={formHref(isSignup ? "/login" : "/signup", returnTo)}>{isSignup ? "Sign in" : "Create an account"}</Link>
        </p>
        <Link className="auth-back" href="/">Back to browsing</Link>
      </section>
      <p className="auth-footnote">Your account is protected by Supabase Auth. Watch history is private to your account.</p>
    </main>
  );
}
