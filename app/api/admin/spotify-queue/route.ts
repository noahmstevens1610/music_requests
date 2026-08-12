import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSpotifyAccessToken } from "@/lib/spotify";
import { supabaseAdmin } from "@/lib/supabase-admin";

type RequestType = "swing" | "line_dance";

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
  explicit?: boolean;
  type?: string;
};

type SpotifyQueuePayload = {
  currently_playing?: SpotifyTrack | null;
  queue?: SpotifyTrack[];
};

type RequestRow = {
  id: string;
  spotify_track_id: string;
  request_type: RequestType;
  status: string | null;
  created_at: string | null;
};

type SongMetadataRow = {
  spotify_track_id: string;
  category: "line_dance" | "swing_song" | "special" | null;
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

type QueueOverrideBody = {
  requestId?: string | null;
  requestType?: RequestType;
  track?: {
    id?: string;
    uri?: string;
    name?: string;
    artist?: string;
    album?: string | null;
    image?: string | null;
  };
};

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

  const expectedToken = await createSessionToken(sessionSecret);
  return sessionCookie === expectedToken;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getArtist(track: SpotifyTrack) {
  return (
    track.artists
      ?.map((artist) => artist.name?.trim())
      .filter((name): name is string => Boolean(name))
      .join(", ") || "Unknown Artist"
  );
}

function metadataCategoryToRequestType(
  category: SongMetadataRow["category"]
): RequestType | null {
  if (category === "line_dance") return "line_dance";
  if (category === "swing_song") return "swing";
  return null;
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

    const data = (await response.json()) as SpotifyQueuePayload & {
      error?: { message?: string };
    };

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

    const currentTrack =
      data.currently_playing?.type === "track"
        ? data.currently_playing
        : null;

    const queuedTracks = (data.queue ?? []).filter(
      (track) => track.type === "track"
    );

    const allTracks = [
      ...(currentTrack ? [currentTrack] : []),
      ...queuedTracks,
    ];

    const spotifyTrackIds = uniqueStrings(
      allTracks
        .map((track) => track.id?.trim() ?? "")
        .filter(Boolean)
    );

    const requestsByTrackId = new Map<string, RequestRow>();
    const metadataByTrackId = new Map<string, SongMetadataRow>();
    const lineDanceSongsByTrackId =
      new Map<string, LineDanceSongRow>();
    const lineDancesById = new Map<string, LineDanceRow>();
    const originalSongsByDanceId =
      new Map<string, LineDanceSongRow>();

    if (spotifyTrackIds.length > 0) {
      const { data: requestRows, error: requestError } =
        await supabaseAdmin
          .from("requests")
          .select(
            "id, spotify_track_id, request_type, status, created_at"
          )
          .in("spotify_track_id", spotifyTrackIds)
          .in("status", ["added", "pending", "approved"])
          .order("created_at", { ascending: false });

      if (requestError) {
        console.error(
          "Unable to load request metadata for Spotify queue:",
          requestError.message
        );
      } else {
        for (const row of (requestRows ?? []) as RequestRow[]) {
          const existing = requestsByTrackId.get(row.spotify_track_id);

          if (
            !existing ||
            (row.status === "added" && existing.status !== "added")
          ) {
            requestsByTrackId.set(row.spotify_track_id, row);
          }
        }
      }

      const { data: metadataRows, error: metadataError } =
        await supabaseAdmin
          .from("song_metadata")
          .select("spotify_track_id, category")
          .in("spotify_track_id", spotifyTrackIds);

      if (metadataError) {
        console.error(
          "Unable to load song metadata for Spotify queue:",
          metadataError.message
        );
      } else {
        for (const row of (metadataRows ?? []) as SongMetadataRow[]) {
          metadataByTrackId.set(row.spotify_track_id, row);
        }
      }

      const {
        data: matchingLineDanceSongs,
        error: lineDanceError,
      } = await supabaseAdmin
        .from("line_dance_songs")
        .select(
          "id, line_dance_id, spotify_track_id, track_name, artist_name, is_original_song"
        )
        .in("spotify_track_id", spotifyTrackIds);

      if (lineDanceError) {
        console.error(
          "Unable to load line dance mappings for Spotify queue:",
          lineDanceError.message
        );
      } else {
        const matchingSongs =
          (matchingLineDanceSongs ?? []) as LineDanceSongRow[];

        for (const song of matchingSongs) {
          if (!lineDanceSongsByTrackId.has(song.spotify_track_id)) {
            lineDanceSongsByTrackId.set(
              song.spotify_track_id,
              song
            );
          }
        }

        const lineDanceIds = uniqueStrings(
          matchingSongs.map((song) => song.line_dance_id)
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
              "Unable to load line dance details for Spotify queue:",
              lineDancesError.message
            );
          } else {
            for (const lineDance of (lineDanceRows ??
              []) as LineDanceRow[]) {
              lineDancesById.set(lineDance.id, lineDance);
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
              "Unable to load original line dance songs for Spotify queue:",
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
      const id = track.id?.trim() ?? "";
      const requestRow = requestsByTrackId.get(id) ?? null;
      const metadataRow = metadataByTrackId.get(id) ?? null;
      const metadataType = metadataCategoryToRequestType(
        metadataRow?.category ?? null
      );

      const matchingLineDanceSong =
        lineDanceSongsByTrackId.get(id) ?? null;

      const matchingLineDance = matchingLineDanceSong
        ? lineDancesById.get(
            matchingLineDanceSong.line_dance_id
          ) ?? null
        : null;

      const originalSong = matchingLineDanceSong
        ? originalSongsByDanceId.get(
            matchingLineDanceSong.line_dance_id
          ) ?? null
        : null;

      const detectedLineDance =
        matchingLineDanceSong && matchingLineDance
          ? {
              id: matchingLineDance.id,
              name: matchingLineDance.name,
              alsoKnownAs: matchingLineDance.also_known_as,
              isOriginalSong:
                matchingLineDanceSong.is_original_song,
              originalSong:
                !matchingLineDanceSong.is_original_song &&
                originalSong
                  ? {
                      trackName: originalSong.track_name,
                      artistName: originalSong.artist_name,
                    }
                  : null,
            }
          : null;

      const requestType: RequestType =
        requestRow?.request_type ??
        metadataType ??
        (detectedLineDance ? "line_dance" : "swing");

      return {
        id,
        uri: track.uri ?? (id ? `spotify:track:${id}` : ""),
        name: track.name?.trim() || "Unknown Song",
        artist: getArtist(track),
        album: track.album?.name?.trim() || null,
        image: track.album?.images?.[0]?.url ?? null,
        explicit: Boolean(track.explicit),
        requestId: requestRow?.id ?? null,
        requestType,
        categorySource: requestRow
          ? "request"
          : metadataType
            ? "override"
            : detectedLineDance
              ? "line_dance_library"
              : "default",
        lineDance:
          requestType === "line_dance"
            ? detectedLineDance
            : null,
      };
    }

    return NextResponse.json({
      currentlyPlaying: currentTrack ? formatTrack(currentTrack) : null,
      queue: queuedTracks.map(formatTrack),
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

export async function PATCH(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  let body: QueueOverrideBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const requestType = body.requestType;
  const track = body.track;
  const spotifyTrackId = track?.id?.trim() ?? "";

  if (
    requestType !== "swing" &&
    requestType !== "line_dance"
  ) {
    return NextResponse.json(
      { error: "Choose Line Dance or Swing Song." },
      { status: 400 }
    );
  }

  if (!spotifyTrackId) {
    return NextResponse.json(
      { error: "Spotify track ID is required." },
      { status: 400 }
    );
  }

  const requestId = body.requestId?.trim() || null;

  if (requestId) {
    let selectedLineDanceId: string | null = null;

    if (requestType === "line_dance") {
      const {
        data: matchingLineDances,
        error: lineDanceLookupError,
      } = await supabaseAdmin
        .from("line_dance_songs")
        .select("line_dance_id")
        .eq("spotify_track_id", spotifyTrackId);

      if (lineDanceLookupError) {
        return NextResponse.json(
          { error: lineDanceLookupError.message },
          { status: 500 }
        );
      }

      const uniqueDanceIds = Array.from(
        new Set(
          (matchingLineDances ?? []).map(
            (dance) => dance.line_dance_id
          )
        )
      );

      if (uniqueDanceIds.length === 1) {
        selectedLineDanceId = uniqueDanceIds[0];
      }
    }

    const { data: updatedRequest, error: updateError } =
      await supabaseAdmin
        .from("requests")
        .update({
          request_type: requestType,
          selected_line_dance_id:
            requestType === "line_dance"
              ? selectedLineDanceId
              : null,
        })
        .eq("id", requestId)
        .select(
          "id, request_type, selected_line_dance_id"
        )
        .maybeSingle();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    if (!updatedRequest) {
      return NextResponse.json(
        { error: "Linked request was not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      requestType,
      source: "request",
    });
  }

  const trackName = track?.name?.trim() || "Unknown Song";
  const artistName = track?.artist?.trim() || "Unknown Artist";

  const metadata = {
    spotify_track_id: spotifyTrackId,
    track_name: trackName,
    artist_name: artistName,
    spotify_uri: track?.uri?.trim() || null,
    album_name: track?.album?.trim() || null,
    album_image: track?.image?.trim() || null,
    category:
      requestType === "line_dance" ? "line_dance" : "swing_song",
    updated_at: new Date().toISOString(),
  };

  const { error: metadataError } = await supabaseAdmin
    .from("song_metadata")
    .upsert(metadata, {
      onConflict: "spotify_track_id",
    });

  if (metadataError) {
    return NextResponse.json(
      { error: metadataError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    requestType,
    source: "override",
  });
}
