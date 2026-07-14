import { supabaseAdmin } from "@/lib/supabase-admin";

type SpotifyTokenRow = {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
};

export async function getSpotifyAccessToken(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("spotify_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("id", 1)
    .maybeSingle<SpotifyTokenRow>();

  if (error) {
    throw new Error(`Could not read Spotify token: ${error.message}`);
  }

  if (!data?.refresh_token) {
    throw new Error("Spotify is not connected.");
  }

  const expiresAt = data.expires_at
    ? new Date(data.expires_at).getTime()
    : 0;

  const tokenIsValid =
    data.access_token &&
    expiresAt > Date.now() + 60_000;

  if (tokenIsValid) {
    return data.access_token!;
  }

  return refreshSpotifyAccessToken(data.refresh_token);
}

async function refreshSpotifyAccessToken(
  refreshToken: string
): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Spotify credentials are missing.");
  }

  const basicAuthorization = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString("base64");

  const response = await fetch(
    "https://accounts.spotify.com/api/token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuthorization}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
      cache: "no-store",
    }
  );

  const tokenData = await response.json();

  if (!response.ok) {
    throw new Error(
      tokenData.error_description ??
        tokenData.error ??
        "Could not refresh Spotify access token."
    );
  }

  const expiresAt = new Date(
    Date.now() + tokenData.expires_in * 1000
  ).toISOString();

  const { error } = await supabaseAdmin
    .from("spotify_tokens")
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? refreshToken,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) {
    throw new Error(`Could not save refreshed token: ${error.message}`);
  }

  return tokenData.access_token;
}