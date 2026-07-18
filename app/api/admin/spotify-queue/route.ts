import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSpotifyAccessToken } from "@/lib/spotify";

async function createSessionToken(secret: string): Promise<string> {
  const encodedSecret = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest("SHA-256", encodedSecret);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function isAuthenticated(): Promise<boolean> {
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;

  if (!sessionSecret) {
    return false;
  }

  const cookieStore = await cookies();
  const sessionCookie =
    cookieStore.get("big_iron_admin_session")?.value;

  if (!sessionCookie) {
    return false;
  }

  const expectedToken =
    await createSessionToken(sessionSecret);

  return sessionCookie === expectedToken;
}

type SpotifyQueueTrack = {
  id: string;
  uri: string;
  name: string;
  artist: string;
  album: string | null;
  image: string | null;
};

function formatTrack(track: any): SpotifyQueueTrack | null {
  if (!track?.id || !track?.uri || !track?.name) {
    return null;
  }

  return {
    id: track.id,
    uri: track.uri,
    name: track.name,
    artist:
      track.artists
        ?.map((artist: { name?: string }) => artist.name)
        .filter(Boolean)
        .join(", ") ?? "Unknown Artist",
    album: track.album?.name ?? null,
    image: track.album?.images?.[0]?.url ?? null,
  };
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const accessToken = await getSpotifyAccessToken();

    const response = await fetch(
      "https://api.spotify.com/v1/me/player/queue",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    if (response.status === 204) {
      return NextResponse.json({
        currentlyPlaying: null,
        queue: [],
      });
    }

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data?.error?.message ??
            "Unable to read Spotify queue.",
        },
        { status: response.status }
      );
    }

    const currentlyPlaying =
      formatTrack(data.currently_playing);

    const queue = (data.queue ?? [])
      .map(formatTrack)
      .filter(
        (
          track: SpotifyQueueTrack | null
        ): track is SpotifyQueueTrack => track !== null
      );

    return NextResponse.json({
      currentlyPlaying,
      queue,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to read Spotify queue.",
      },
      { status: 500 }
    );
  }
}