import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { adminCookie, getSession } from "@/lib/admin-session";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Report only session state, never the session token, cookie value, or password.
export async function GET(request: NextRequest) {
  const token = request.cookies.get(adminCookie)?.value;
  const headers = { "Cache-Control": "no-store" };
  if (!token) return NextResponse.json({ cookiePresent: false, sessionRecordFound: false, validSession: false, reason: "missing_cookie" }, { headers });

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data, error } = await supabaseAdmin.from("admin_sessions")
    .select("password_id, expires_at").eq("token_hash", tokenHash).maybeSingle();
  if (error) {
    console.error("Admin session diagnostic database failure:", error.message);
    return NextResponse.json({ cookiePresent: true, sessionRecordFound: false, validSession: false, reason: "database_query_failed" }, { headers });
  }
  if (!data) return NextResponse.json({ cookiePresent: true, sessionRecordFound: false, validSession: false, reason: "session_not_found" }, { headers });
  if (Date.parse(data.expires_at) <= Date.now()) return NextResponse.json({ cookiePresent: true, sessionRecordFound: true, validSession: false, reason: "expired_session" }, { headers });
  const session = await getSession(request);
  return NextResponse.json({
    cookiePresent: true, sessionRecordFound: true,
    validSession: Boolean(session),
    role: session?.role ?? null,
    reason: session ? "ok" : "password_disabled_or_session_invalid"
  }, { headers });
}
