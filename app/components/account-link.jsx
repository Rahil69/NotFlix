"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AccountLink() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/session", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((data) => setSignedIn(Boolean(data.user)))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return (
    <Link className="account-link" href={signedIn ? "/account" : "/login"}>
      <span className="account-link-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
        </svg>
      </span>
      <span className="account-link-label">{signedIn ? "My Account" : "Sign in"}</span>
    </Link>
  );
}
