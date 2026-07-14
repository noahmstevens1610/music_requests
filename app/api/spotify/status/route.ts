import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("spotify_tokens")
    .select("expires_at, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      {
        connected: false,
        error: error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    connected: Boolean(data),
    expiresAt: data?.expires_at ?? null,
    updatedAt: data?.updated_at ?? null,
  });
}