import { NextResponse } from "next/server";
import { isSameOrigin } from "../../../../lib/request-security";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

function privateJson(body, options = {}) {
  return NextResponse.json(body, {
    ...options,
    headers: { "Cache-Control": "private, no-store", ...options.headers },
  });
}

function safeReturnTo(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/account";
}

export async function POST(request) {
  if (!isSameOrigin(request)) return privateJson({ error: "Request origin could not be verified." }, { status: 403 });

  let body;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Enter a valid email and password." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return privateJson({ error: "Enter a valid email and password." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return privateJson({ error: "Enter a valid email address." }, { status: 400 });
  }
  if ([...password].length < 10 || password.length > 256) {
    return privateJson({ error: "Use a password between 10 and 256 characters." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const callbackUrl = new URL("/auth/callback", new URL(request.url).origin);
    callbackUrl.searchParams.set("next", safeReturnTo(body.returnTo));
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: callbackUrl.toString() },
    });

    if (error) {
      const status = error.status === 429 ? 429 : /already registered/i.test(error.message) ? 409 : 400;
      const message = status === 429
        ? "Too many signup attempts. Please try again later."
        : status === 409
          ? "Could not create an account with that email. Try signing in instead."
          : /password/i.test(error.message)
            ? "Use a stronger password and try again."
            : "Could not create your account. Check your email and try again.";
      return privateJson({ error: message }, { status });
    }

    return privateJson({
      user: data.user ? { id: data.user.id, email: data.user.email } : null,
      needsEmailConfirmation: !data.session,
    }, { status: 201 });
  } catch {
    return privateJson({ error: "Account service is temporarily unavailable." }, { status: 503 });
  }
}
