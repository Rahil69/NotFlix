import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) return NextResponse.json({ user: null }, { headers: { "Cache-Control": "private, no-store" } });
    const user = data.user ? { id: data.user.id, email: data.user.email } : null;
    return NextResponse.json({ user }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ user: null }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
