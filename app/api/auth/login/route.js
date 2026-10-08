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

export async function POST(request) {
  if (!isSameOrigin(request)) return privateJson({ error: "Request origin could not be verified." }, { status: 403 });

  let body;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Enter your email and password." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return privateJson({ error: "Enter your email and password." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !password || password.length > 256) {
    return privateJson({ error: "Email or password is incorrect." }, { status: 401 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.status === 429) {
        return privateJson({ error: "Too many attempts. Try again in a few minutes." }, { status: 429, headers: { "Retry-After": "60" } });
      }
      if (error.code === "email_not_confirmed") {
        return privateJson({ error: "Confirm your email before signing in." }, { status: 403 });
      }
      return privateJson({ error: "Email or password is incorrect." }, { status: 401 });
    }

    return privateJson({ user: { id: data.user.id, email: data.user.email } });
  } catch {
    return privateJson({ error: "Account service is temporarily unavailable." }, { status: 503 });
  }
}
