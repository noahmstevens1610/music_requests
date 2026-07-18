import { NextRequest, NextResponse } from "next/server";
import { getSpotifyAccessToken } from "@/lib/spotify";
import { supabaseAdmin } from "@/lib/supabase-admin";

type QueueRequestBody = {
  requestId?: string;
};

type SpotifyImage = {
  url?: string;
};

type SpotifyArtist = {
  name?: string;
};

type SpotifyAlbum = {
  name?: string;
  images?: SpotifyImage[];
};

type SpotifyTrack = {
  id?: string;
  uri?: string;
  name?: string;
  artists?: SpotifyArtist[];
  album?: SpotifyAlbum;
  duration_ms?: number;
  explicit?: boolean;
  type?: string;
};

type SpotifyQueueResponse = {
  currently_playing?: SpotifyTrack | null;
  queue?: SpotifyTrack[];
};

type RequestRow = {
  id: string;
  spotify_track_id: string;
  request_type: "swing" | "line_dance";
  created_at?: string | null;
};

type LineDanceSongRow = {
  id: string;
  line_dance_id: string;
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  is_original_song: boolean;
};

type LineDanceRow = {
  id: string;
  name: string;
  also_known_as: string | null;
};

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getTrackImage(track: SpotifyTrack) {
  return track.album?.images?.[0]?.url ?? null;
}

function getTrackArtist(track: SpotifyTrack) {
  return (
    track.artists
      ?.map((artist) => artist.name?.trim())
      .filter((name): name is string => Boolean(name))
      .join(", ") || "Unknown Artist"
  );
}

export async function GET() {
  try {
    const accessToken = await getSpotifyAccessToken();

    const spotifyResponse = await fetch(
      "https://api.spotify.com/v1/me/player/queue",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

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
              "Spotify denied playback access. Reconnect Spotify and confirm the account has Premium.",
          },
          { status: 403 }
        );
      }

      if (spotifyResponse.status === 404) {
        return NextResponse.json(
          {
            error:
              "No active Spotify playback device was found. Start playing Spotify on the DJ device.",
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
            `Spotify playback request failed with status ${spotifyResponse.status}.`,
        },
        { status: spotifyResponse.status }
      );
    }

    const spotifyData =
      (await spotifyResponse.json()) as SpotifyQueueResponse;

    const currentTrack =
      spotifyData.currently_playing?.type === "track"
        ? spotifyData.currently_playing
        : null;

    const queuedTracks = (spotifyData.queue ?? []).filter(
      (track) => track.type === "track"
    );

    const allSpotifyTracks = [
      ...(currentTrack ? [currentTrack] : []),
      ...queuedTracks,
    ];

    const spotifyTrackIds = uniqueStrings(
      allSpotifyTracks
        .map((track) => track.id?.trim() ?? "")
        .filter(Boolean)
    );

    const requestsByTrackId = new Map<string, RequestRow>();
    const lineDanceSongsByTrackId =
      new Map<string, LineDanceSongRow>();
    const lineDancesById = new Map<string, LineDanceRow>();
    const originalSongsByDanceId =
      new Map<string, LineDanceSongRow>();

    if (spotifyTrackIds.length > 0) {
      const { data: requestRows, error: requestsError } =
        await supabaseAdmin
          .from("requests")
          .select(
            "id, spotify_track_id, request_type, created_at"
          )
          .in("spotify_track_id", spotifyTrackIds)
          .order("created_at", {
            ascending: false,
          });

      if (requestsError) {
        console.error(
          "Unable to load matching requests:",
          requestsError.message
        );
      } else {
        for (const requestRow of (requestRows ??
          []) as RequestRow[]) {
          if (
            !requestsByTrackId.has(
              requestRow.spotify_track_id
            )
          ) {
            requestsByTrackId.set(
              requestRow.spotify_track_id,
              requestRow
            );
          }
        }
      }

      const {
        data: matchingLineDanceSongs,
        error: lineDanceSongsError,
      } = await supabaseAdmin
        .from("line_dance_songs")
        .select(
          "id, line_dance_id, spotify_track_id, track_name, artist_name, is_original_song"
        )
        .in("spotify_track_id", spotifyTrackIds);

      if (lineDanceSongsError) {
        console.error(
          "Unable to load line dance songs:",
          lineDanceSongsError.message
        );
      } else {
        const matchingSongs =
          (matchingLineDanceSongs ??
            []) as LineDanceSongRow[];

        for (const song of matchingSongs) {
          if (
            !lineDanceSongsByTrackId.has(
              song.spotify_track_id
            )
          ) {
            lineDanceSongsByTrackId.set(
              song.spotify_track_id,
              song
            );
          }
        }

        const lineDanceIds = uniqueStrings(
          matchingSongs.map(
            (song) => song.line_dance_id
          )
        );

        if (lineDanceIds.length > 0) {
          const {
            data: lineDanceRows,
            error: lineDancesError,
          } = await supabaseAdmin
            .from("line_dances")
            .select("id, name, also_known_as")
            .in("id", lineDanceIds);

          if (lineDancesError) {
            console.error(
              "Unable to load line dances:",
              lineDancesError.message
            );
          } else {
            for (const lineDance of (lineDanceRows ??
              []) as LineDanceRow[]) {
              lineDancesById.set(
                lineDance.id,
                lineDance
              );
            }
          }

          const {
            data: originalSongRows,
            error: originalSongsError,
          } = await supabaseAdmin
            .from("line_dance_songs")
            .select(
              "id, line_dance_id, spotify_track_id, track_name, artist_name, is_original_song"
            )
            .in("line_dance_id", lineDanceIds)
            .eq("is_original_song", true);

          if (originalSongsError) {
            console.error(
              "Unable to load original line dance songs:",
              originalSongsError.message
            );
          } else {
            for (const originalSong of (originalSongRows ??
              []) as LineDanceSongRow[]) {
              if (
                !originalSongsByDanceId.has(
                  originalSong.line_dance_id
                )
              ) {
                originalSongsByDanceId.set(
                  originalSong.line_dance_id,
                  originalSong
                );
              }
            }
          }
        }
      }
    }

    function formatTrack(track: SpotifyTrack) {
      const spotifyTrackId = track.id?.trim() ?? "";
      const matchingRequest =
        requestsByTrackId.get(spotifyTrackId) ?? null;
      const matchingLineDanceSong =
        lineDanceSongsByTrackId.get(
          spotifyTrackId
        ) ?? null;

      const matchingLineDance =
        matchingLineDanceSong
          ? lineDancesById.get(
              matchingLineDanceSong.line_dance_id
            ) ?? null
          : null;

      const originalSong =
        matchingLineDanceSong
          ? originalSongsByDanceId.get(
              matchingLineDanceSong.line_dance_id
            ) ?? null
          : null;

      const lineDance =
        matchingLineDanceSong && matchingLineDance
          ? {
              id: matchingLineDance.id,
              name: matchingLineDance.name,
              alsoKnownAs:
                matchingLineDance.also_known_as,
              isOriginalSong:
                matchingLineDanceSong.is_original_song,
              originalSong:
                !matchingLineDanceSong.is_original_song &&
                originalSong
                  ? {
                      trackName:
                        originalSong.track_name,
                      artistName:
                        originalSong.artist_name,
                    }
                  : null,
            }
          : null;

      const requestType:
        | "swing"
        | "line_dance" = lineDance
        ? "line_dance"
        : matchingRequest?.request_type ??
          "swing";

      return {
        spotifyTrackId,
        spotifyUri:
          track.uri ??
          (spotifyTrackId
            ? `spotify:track:${spotifyTrackId}`
            : ""),
        trackName:
          track.name?.trim() || "Unknown Song",
        artistName: getTrackArtist(track),
        albumName:
          track.album?.name?.trim() || null,
        albumImage: getTrackImage(track),
        durationMs:
          typeof track.duration_ms === "number"
            ? track.duration_ms
            : null,
        explicit: Boolean(track.explicit),
        requestType,
        requestId: matchingRequest?.id ?? null,
        lineDance,
      };
    }

    return NextResponse.json({
      isPlaying: Boolean(currentTrack),
      nowPlaying: currentTrack
        ? formatTrack(currentTrack)
        : null,
      upcoming: queuedTracks.map(formatTrack),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Spotify playback.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body =
      (await request.json()) as QueueRequestBody;

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
        .select(
          "id, spotify_uri, track_name, status"
        )
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
        {
          error: "Song request was not found.",
        },
        { status: 404 }
      );
    }

    if (!songRequest.spotify_uri) {
      return NextResponse.json(
        {
          error:
            "This request has no Spotify URI.",
        },
        { status: 400 }
      );
    }

    const accessToken =
      await getSpotifyAccessToken();

    const queueUrl = new URL(
      "https://api.spotify.com/v1/me/player/queue"
    );

    queueUrl.searchParams.set(
      "uri",
      songRequest.spotify_uri
    );

    const spotifyResponse = await fetch(
      queueUrl,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    if (!spotifyResponse.ok) {
      let spotifyError = "";

      try {
        const errorData =
          await spotifyResponse.json();

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
        {
          status: spotifyResponse.status,
        }
      );
    }

    const {
      data: updatedRequest,
      error: updateError,
    } = await supabaseAdmin
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
