import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSpotifyAccessToken } from "@/lib/spotify";

async function createSessionToken(
  secret: string
): Promise<string> {
  const encodedSecret =
    new TextEncoder().encode(secret);

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      encodedSecret
    );

  return Array.from(
    new Uint8Array(digest)
  )
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}

async function isAuthenticated() {
  const sessionSecret =
    process.env.ADMIN_SESSION_SECRET;

  if (!sessionSecret) {
    return false;
  }

  const cookieStore = await cookies();

  const savedToken =
    cookieStore.get(
      "big_iron_admin_session"
    )?.value;

  if (!savedToken) {
    return false;
  }

  const expectedToken =
    await createSessionToken(
      sessionSecret
    );

  return savedToken === expectedToken;
}

export async function GET(
  request: NextRequest
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json(
      {
        error: "Unauthorized.",
      },
      {
        status: 401,
      }
    );
  }

  const query =
    request.nextUrl.searchParams
      .get("q")
      ?.trim() ?? "";

  if (!query) {
    return NextResponse.json({
      tracks: [],
    });
  }

  try {
   const accessToken =
  await getSpotifyAccessToken();

const response = await fetch(
  `https://api.spotify.com/v1/search?type=track&limit=10&q=${encodeURIComponent(
    query
  )}`,
  {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  }
);

if (!response.ok) {
  const text = await response.text();

  throw new Error(text);
}

    const data =
      await response.json();

    const tracks =
      data.tracks?.items?.map(
        (track: any) => ({
          id: track.id,
          uri: track.uri,
          name: track.name,
          artist:
            track.artists?.[0]?.name ??
            "Unknown Artist",
          album:
            track.album?.name ??
            null,
          image:
            track.album?.images?.[0]
              ?.url ?? null,
        })
      ) ?? [];

    return NextResponse.json({
      tracks,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Spotify search failed.",
      },
      {
        status: 500,
      }
    );
  }
}