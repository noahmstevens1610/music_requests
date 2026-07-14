import crypto from "crypto";
import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Spotify environment variables are missing." },
      { status: 500 }
    );
  }

  const state = crypto.randomBytes(24).toString("hex");

  const scopes = [
  "playlist-modify-public",
  "playlist-modify-private",
  "user-read-currently-playing",
  "user-read-recently-played",
].join(" ");

  const spotifyUrl = new URL(
    "https://accounts.spotify.com/authorize"
  );

  spotifyUrl.searchParams.set("response_type", "code");
  spotifyUrl.searchParams.set("client_id", clientId);
  spotifyUrl.searchParams.set("scope", scopes);
  spotifyUrl.searchParams.set("redirect_uri", redirectUri);
  spotifyUrl.searchParams.set("state", state);
  spotifyUrl.searchParams.set("show_dialog", "true");

  const response = NextResponse.redirect(spotifyUrl);

  response.cookies.set("spotify_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });

  return response;
}