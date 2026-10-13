import { NextRequest, NextResponse } from "next/server";
import { isOwner } from "@/lib/admin-session";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  if (!(await isOwner(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const state = req.nextUrl.searchParams.get("state");
  const code = req.nextUrl.searchParams.get("code");
  const slot = Number(req.cookies.get("spotify_oauth_slot")?.value);
  if (!state || state !== req.cookies.get("spotify_oauth_state")?.value || !code || ![1,2].includes(slot)) {
    return NextResponse.json({ error: "Invalid Spotify authorization" }, { status: 400 });
  }
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirect = process.env.SPOTIFY_REDIRECT_URI;
  if (!id || !secret || !redirect) return NextResponse.json({ error: "Spotify configuration missing" }, { status: 500 });

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(id + ":" + secret).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirect }),
    cache: "no-store"
  });
  if (!tokenRes.ok) return NextResponse.json({ error: "Spotify authorization failed" }, { status: 400 });
  const token = await tokenRes.json();
  if (!token.access_token || !token.refresh_token) return NextResponse.json({ error: "Missing Spotify credentials" }, { status: 400 });

  const meRes = await fetch("https://api.spotify.com/v1/me", { headers: { Authorization: "Bearer " + token.access_token }, cache: "no-store" });
  if (!meRes.ok) return NextResponse.json({ error: "Unable to verify Spotify account" }, { status: 400 });
  const profile = await meRes.json();
  if (typeof profile.id !== "string") return NextResponse.json({ error: "Invalid Spotify account" }, { status: 400 });

  const { data: duplicate, error: duplicateError } = await supabaseAdmin.from("spotify_accounts").select("slot").eq("spotify_user_id", profile.id).neq("slot", slot).maybeSingle();
  if (duplicateError) return NextResponse.json({ error: duplicateError.message }, { status: 500 });
  if (duplicate) return NextResponse.json({ error: "Account already connected in another slot" }, { status: 409 });
  const { data: current } = await supabaseAdmin.from("spotify_accounts").select("active").eq("slot", slot).maybeSingle();
  const { data: active } = await supabaseAdmin.from("spotify_accounts").select("slot").eq("active", true).maybeSingle();

  const { error } = await supabaseAdmin.from("spotify_accounts").upsert({
    slot, spotify_user_id: profile.id, display_name: profile.display_name || profile.id,
    access_token: token.access_token, refresh_token: token.refresh_token,
    expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    active: current?.active ?? !active, updated_at: new Date().toISOString()
  }, { onConflict: "slot" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const res = NextResponse.redirect(new URL("/admin/settings?spotify=connected", req.url));
  res.cookies.delete("spotify_oauth_state");
  res.cookies.delete("spotify_oauth_slot");
  return res;
}
