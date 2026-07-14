import { NextRequest, NextResponse } from "next/server";
import { getSpotifyAccessToken } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json({ tracks: [] });
  }

  try {
    const accessToken = await getSpotifyAccessToken();

    const spotifyUrl = new URL(
      "https://api.spotify.com/v1/search"
    );

    spotifyUrl.searchParams.set("q", query);
    spotifyUrl.searchParams.set("type", "track");
    spotifyUrl.searchParams.set("limit", "10");
    spotifyUrl.searchParams.set("market", "US");

    const response = await fetch(spotifyUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data.error?.message ??
            "Spotify search failed.",
        },
        { status: response.status }
      );
    }

    const tracks = (data.tracks?.items ?? []).map(
      (track: any) => ({
        id: track.id,
        uri: track.uri,
        name: track.name,
        artist: track.artists
          .map((artist: any) => artist.name)
          .join(", "),
        album: track.album?.name ?? "",
        image:
          track.album?.images?.[1]?.url ??
          track.album?.images?.[0]?.url ??
          null,
        explicit: Boolean(track.explicit),
      })
    );

    return NextResponse.json({ tracks });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Spotify search failed.",
      },
      { status: 500 }
    );
  }
}