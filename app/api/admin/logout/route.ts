import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { adminCookie } from "@/lib/admin-session";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(adminCookie)?.value;
  if (token) {
    const hash = createHash("sha256").update(token).digest("hex");
    const { error } = await supabaseAdmin.from("admin_sessions").delete().eq("token_hash", hash);
    if (error) return NextResponse.json({ error: "Unable to revoke session" }, { status: 500 });
  }
  const response = NextResponse.json({ success: true });
  response.cookies.set(adminCookie, "", {
    httpOnly: true, sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/", expires: new Date(0)
  });
  return response;
}
