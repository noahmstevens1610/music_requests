import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");
  const spotifyError = request.nextUrl.searchParams.get("error");

  const savedState = request.cookies.get("spotify_oauth_state")?.value;

  if (spotifyError) {
    return NextResponse.json(
      { error: `Spotify authorization failed: ${spotifyError}` },
      { status: 400 }
    );
  }

  if (!code || !returnedState || returnedState !== savedState) {
    return NextResponse.json(
      { error: "Invalid Spotify authorization response." },
      { status: 400 }
    );
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: "Spotify environment variables are missing." },
      { status: 500 }
    );
  }

  const basicAuthorization = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString("base64");

  const tokenResponse = await fetch(
    "https://accounts.spotify.com/api/token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuthorization}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
      cache: "no-store",
    }
  );

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok) {
    return NextResponse.json(
      {
        error:
          tokenData.error_description ??
          tokenData.error ??
          "Spotify token exchange failed.",
      },
      { status: tokenResponse.status }
    );
  }

  const expiresAt = new Date(
    Date.now() + tokenData.expires_in * 1000
  ).toISOString();

  const { error: databaseError } = await supabaseAdmin
    .from("spotify_tokens")
    .upsert({
      id: 1,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    });

  if (databaseError) {
    return NextResponse.json(
      { error: databaseError.message },
      { status: 500 }
    );
  }

  const response = NextResponse.redirect(
    new URL("/api/spotify/status", request.url)
  );

  response.cookies.delete("spotify_oauth_state");

  return response;
}