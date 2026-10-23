import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/admin-session";
import { getSpotifyAccessToken } from "@/lib/spotify";

export async function GET(
  request: NextRequest
) {
  if (!(await getSession(request))) {
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
          explicit: Boolean(track.explicit),
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