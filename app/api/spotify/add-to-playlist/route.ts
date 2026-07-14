import { NextRequest, NextResponse } from "next/server";
import { getSpotifyAccessToken } from "@/lib/spotify";
import { supabaseAdmin } from "@/lib/supabase-admin";

const PLAYLIST_ID = "0KVgTHUDnNEI7rchqNdFxS";

type AddToPlaylistBody = {
  requestId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AddToPlaylistBody;

    const requestId =
      typeof body.requestId === "string"
        ? body.requestId.trim()
        : "";

    if (!requestId) {
      return NextResponse.json(
        { error: "Missing requestId." },
        { status: 400 }
      );
    }

    const { data: song, error: songError } =
      await supabaseAdmin
        .from("requests")
        .select(
          "id, spotify_uri, track_name, artist_name, status"
        )
        .eq("id", requestId)
        .maybeSingle();

    if (songError) {
      return NextResponse.json(
        { error: songError.message },
        { status: 500 }
      );
    }

    if (!song) {
      return NextResponse.json(
        { error: "Song request was not found." },
        { status: 404 }
      );
    }

    if (!song.spotify_uri) {
      return NextResponse.json(
        { error: "This request has no Spotify URI." },
        { status: 400 }
      );
    }

    const accessToken = await getSpotifyAccessToken();

    const spotifyResponse = await fetch(
      `https://api.spotify.com/v1/playlists/${PLAYLIST_ID}/items`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uris: [song.spotify_uri],
        }),
        cache: "no-store",
      }
    );

    if (!spotifyResponse.ok) {
      let spotifyMessage = "";

      try {
        const errorData = await spotifyResponse.json();

        spotifyMessage =
          errorData?.error?.message ??
          errorData?.error_description ??
          "";
      } catch {
        spotifyMessage = "";
      }

      return NextResponse.json(
        {
          error:
            spotifyMessage ||
            `Spotify request failed with status ${spotifyResponse.status}.`,
        },
        { status: spotifyResponse.status }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("requests")
      .update({
        status: "added",
      })
      .eq("id", requestId);

    if (updateError) {
      return NextResponse.json(
        {
          error:
            "The song was added to Spotify, but could not be removed from the request lists.",
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${song.track_name} was added to the playlist.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to add song to playlist.",
      },
      { status: 500 }
    );
  }
}