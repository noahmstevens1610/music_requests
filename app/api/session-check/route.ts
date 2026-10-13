import { NextRequest, NextResponse } from "next/server";
import { adminCookie, getSession } from "@/lib/admin-session";

// Safe diagnostic: never reveal cookie values or credentials.
export async function GET(req: NextRequest) {
  const cookiePresent = Boolean(req.cookies.get(adminCookie)?.value);
  let role: "owner" | "staff" | null = null;
  try {
    role = (await getSession(req))?.role ?? null;
  } catch {
    return NextResponse.json({ cookiePresent, validSession: false, checkError: true }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(
    { cookiePresent, validSession: Boolean(role), role },
    { headers: { "Cache-Control": "no-store" } }
  );
}
