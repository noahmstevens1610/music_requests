import { NextRequest, NextResponse } from "next/server";
import { getSpotifyAccessToken } from "@/lib/spotify";
import { supabaseAdmin } from "@/lib/supabase-admin";

type QueueRequestBody = {
  requestId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as QueueRequestBody;

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

    const { data: songRequest, error: requestError } =
      await supabaseAdmin
        .from("requests")
        .select("id, spotify_uri, track_name, status")
        .eq("id", requestId)
        .maybeSingle();

    if (requestError) {
      return NextResponse.json(
        { error: requestError.message },
        { status: 500 }
      );
    }

    if (!songRequest) {
      return NextResponse.json(
        { error: "Song request was not found." },
        { status: 404 }
      );
    }

    if (!songRequest.spotify_uri) {
      return NextResponse.json(
        { error: "This request has no Spotify URI." },
        { status: 400 }
      );
    }

    const accessToken = await getSpotifyAccessToken();

    const queueUrl = new URL(
      "https://api.spotify.com/v1/me/player/queue"
    );

    queueUrl.searchParams.set(
      "uri",
      songRequest.spotify_uri
    );

    const spotifyResponse = await fetch(queueUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!spotifyResponse.ok) {
      let spotifyError = "";

      try {
        const errorData = await spotifyResponse.json();

        spotifyError =
          errorData?.error?.message ??
          errorData?.error_description ??
          "";
      } catch {
        spotifyError = "";
      }

      if (spotifyResponse.status === 401) {
        return NextResponse.json(
          {
            error:
              "Spotify authorization expired. Reconnect Spotify.",
          },
          { status: 401 }
        );
      }

      if (spotifyResponse.status === 403) {
        return NextResponse.json(
          {
            error:
              spotifyError ||
              "Spotify denied queue access. Reconnect Spotify and confirm the account has Premium.",
          },
          { status: 403 }
        );
      }

      if (spotifyResponse.status === 404) {
        return NextResponse.json(
          {
            error:
              "No active Spotify playback device was found. Start playing Spotify on the DJ device and try again.",
          },
          { status: 404 }
        );
      }

      if (spotifyResponse.status === 429) {
        return NextResponse.json(
          {
            error:
              "Spotify rate limit reached. Wait briefly and try again.",
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          error:
            spotifyError ||
            `Spotify queue request failed with status ${spotifyResponse.status}.`,
        },
        { status: spotifyResponse.status }
      );
    }

    const { data: updatedRequest, error: updateError } =
      await supabaseAdmin
        .from("requests")
        .update({
          status: "added",
        })
        .eq("id", requestId)
        .select()
        .maybeSingle();

    if (updateError) {
      return NextResponse.json(
        {
          error:
            "The song was added to Spotify, but its request status could not be updated.",
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${songRequest.track_name} was added to the Spotify queue.`,
      request: updatedRequest,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to add the song to Spotify.",
      },
      { status: 500 }
    );
  }
}