import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const active = await supabaseAdmin.from("spotify_accounts")
    .select("slot, display_name, expires_at, updated_at")
    .eq("active", true).maybeSingle();
  if (active.error) return NextResponse.json({ connected: false, error: active.error.message }, { status: 500 });
  if (active.data) {
    return NextResponse.json({
      connected: true, slot: active.data.slot,
      accountName: active.data.display_name,
      expiresAt: active.data.expires_at,
      updatedAt: active.data.updated_at
    });
  }
  const legacy = await supabaseAdmin.from("spotify_tokens")
    .select("expires_at, updated_at").eq("id", 1).maybeSingle();
  if (legacy.error) return NextResponse.json({ connected: false, error: legacy.error.message }, { status: 500 });
  return NextResponse.json({
    connected: Boolean(legacy.data), legacy: true,
    expiresAt: legacy.data?.expires_at ?? null,
    updatedAt: legacy.data?.updated_at ?? null
  });
}
