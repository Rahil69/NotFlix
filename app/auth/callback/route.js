import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

function safeReturnTo(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/account";
}

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const otpType = url.searchParams.get("type");
  const destination = new URL(safeReturnTo(url.searchParams.get("next")), url.origin);

  try {
    const supabase = await createSupabaseServerClient();
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(destination);
    } else if (tokenHash && ["email", "signup"].includes(otpType)) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
      if (!error) return NextResponse.redirect(destination);
    }
  } catch {
    // Fall through to the sign-in error page.
  }

  const signInUrl = new URL("/login", url.origin);
  signInUrl.searchParams.set("error", "email-confirmation");
  return NextResponse.redirect(signInUrl);
}
