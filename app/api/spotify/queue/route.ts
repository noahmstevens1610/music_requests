import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getSpotifyAccessToken,
} from "@/lib/spotify";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

type QueueRequestBody = {
  requestId?: string;
};

type SpotifyArtist = {
  name?: string;
};

type SpotifyImage = {
  url?: string;
  height?: number | null;
  width?: number | null;
};

type SpotifyAlbum = {
  name?: string;
  images?: SpotifyImage[];
};

type SpotifyTrack = {
  id?: string;
  uri?: string;
  name?: string;
  type?: string;
  artists?: SpotifyArtist[];
  album?: SpotifyAlbum;
  duration_ms?: number;
  explicit?: boolean;
};

type SpotifyQueueResponse = {
  currently_playing?: SpotifyTrack | null;
  queue?: SpotifyTrack[];
};

type RequestRecord = {
  id: string;
  spotify_track_id: string | null;
  spotify_uri: string | null;
  track_name: string | null;
  artist_name: string | null;
  album_name: string | null;
  album_image: string | null;
  request_type:
    | "swing"
    | "line_dance"
    | null;
  status: string | null;
};

type LineDanceSongRecord = {
  id: string;
  line_dance_id: string;
  spotify_track_id: string;
  spotify_uri: string | null;
  track_name: string;
  artist_name: string;
  album_name: string | null;
  album_image: string | null;
  is_original_song: boolean;
};

type LineDanceRecord = {
  id: string;
  name: string;
  also_known_as: string | null;
};

type OriginalSongInfo = {
  trackName: string;
  artistName: string;
};

type LineDanceInfo = {
  id: string;
  name: string;
  alsoKnownAs: string | null;
  isOriginalSong: boolean;
  originalSong: OriginalSongInfo | null;
};

type PlaybackTrack = {
  spotifyTrackId: string;
  spotifyUri: string;
  trackName: string;
  artistName: string;
  albumName: string | null;
  albumImage: string | null;
  durationMs: number | null;
  explicit: boolean;
  requestType:
    | "swing"
    | "line_dance";
  requestId: string | null;
  lineDance: LineDanceInfo | null;
};

function getSpotifyErrorMessage(
  status: number,
  spotifyError: string
): string {
  if (status === 401) {
    return (
      "Spotify authorization expired. " +
      "Reconnect Spotify."
    );
  }

  if (status === 403) {
    return (
      spotifyError ||
      "Spotify denied playback access. " +
        "Reconnect Spotify and confirm " +
        "the account has Premium."
    );
  }

  if (status === 404) {
    return (
      "No active Spotify playback device " +
      "was found. Start playing Spotify " +
      "on the DJ device and try again."
    );
  }

  if (status === 429) {
    return (
      "Spotify rate limit reached. " +
      "Wait briefly and try again."
    );
  }

  return (
    spotifyError ||
    `Spotify request failed with status ${status}.`
  );
}

async function readSpotifyError(
  response: Response
): Promise<string> {
  try {
    const errorData =
      await response.json();

    return (
      errorData?.error?.message ??
      errorData?.error_description ??
      ""
    );
  } catch {
    return "";
  }
}

function getTrackArtist(
  track: SpotifyTrack
): string {
  const artists =
    track.artists
      ?.map((artist) =>
        artist.name?.trim()
      )
      .filter(
        (name): name is string =>
          Boolean(name)
      ) ?? [];

  return (
    artists.join(", ") ||
    "Unknown artist"
  );
}

function getAlbumImage(
  track: SpotifyTrack
): string | null {
  const images =
    track.album?.images ?? [];

  if (images.length === 0) {
    return null;
  }

  const preferredImage =
    images.find(
      (image) =>
        typeof image.width ===
          "number" &&
        image.width >= 300
    ) ?? images[0];

  return preferredImage?.url ?? null;
}

function mapPlaybackTrack(
  track: SpotifyTrack,
  requestRecord:
    | RequestRecord
    | undefined,
  lineDanceSong:
    | LineDanceSongRecord
    | undefined,
  lineDance:
    | LineDanceRecord
    | undefined,
  originalSong:
    | LineDanceSongRecord
    | undefined
): PlaybackTrack {
  let lineDanceInfo:
    | LineDanceInfo
    | null = null;

  if (
    lineDanceSong &&
    lineDance
  ) {
    lineDanceInfo = {
      id: lineDance.id,
      name: lineDance.name,
      alsoKnownAs:
        lineDance.also_known_as ??
        null,
      isOriginalSong:
        Boolean(
          lineDanceSong
            .is_original_song
        ),
      originalSong:
        originalSong
          ? {
              trackName:
                originalSong
                  .track_name,
              artistName:
                originalSong
                  .artist_name,
            }
          : null,
    };
  }

  return {
    spotifyTrackId:
      track.id ?? "",

    spotifyUri:
      track.uri ?? "",

    trackName:
      track.name ??
      lineDanceSong?.track_name ??
      requestRecord?.track_name ??
      "Unknown song",

    artistName:
      getTrackArtist(track),

    albumName:
      track.album?.name ??
      lineDanceSong?.album_name ??
      requestRecord?.album_name ??
      null,

    albumImage:
      getAlbumImage(track) ??
      lineDanceSong?.album_image ??
      requestRecord?.album_image ??
      null,

    durationMs:
      typeof track.duration_ms ===
      "number"
        ? track.duration_ms
        : null,

    explicit:
      Boolean(track.explicit),

    requestType:
      lineDanceInfo ||
      requestRecord?.request_type ===
        "line_dance"
        ? "line_dance"
        : "swing",

    requestId:
      requestRecord?.id ?? null,

    lineDance:
      lineDanceInfo,
  };
}

export async function GET() {
  try {
    const accessToken =
      await getSpotifyAccessToken();

    const spotifyResponse =
      await fetch(
        "https://api.spotify.com/v1/me/player/queue",
        {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
          cache: "no-store",
        }
      );

    if (!spotifyResponse.ok) {
      const spotifyError =
        await readSpotifyError(
          spotifyResponse
        );

      return NextResponse.json(
        {
          error:
            getSpotifyErrorMessage(
              spotifyResponse.status,
              spotifyError
            ),
        },
        {
          status:
            spotifyResponse.status,
        }
      );
    }

    const spotifyData =
      (await spotifyResponse.json()) as SpotifyQueueResponse;

    const currentlyPlaying =
      spotifyData.currently_playing
        ?.type === "track"
        ? spotifyData.currently_playing
        : null;

    const upcomingTracks = (
      spotifyData.queue ?? []
    )
      .filter(
        (item) =>
          item?.type === "track"
      )
      .slice(0, 4);

    const allTracks = [
      ...(currentlyPlaying
        ? [currentlyPlaying]
        : []),
      ...upcomingTracks,
    ];

    const spotifyTrackIds =
      Array.from(
        new Set(
          allTracks
            .map(
              (track) =>
                track.id
            )
            .filter(
              (
                trackId
              ): trackId is string =>
                typeof trackId ===
                  "string" &&
                trackId.length > 0
            )
        )
      );

    let requestRecords:
      RequestRecord[] = [];

    let lineDanceSongs:
      LineDanceSongRecord[] = [];

    if (
      spotifyTrackIds.length > 0
    ) {
      const [
        requestsResult,
        lineDanceSongsResult,
      ] = await Promise.all([
        supabaseAdmin
          .from("requests")
          .select(
            `
              id,
              spotify_track_id,
              spotify_uri,
              track_name,
              artist_name,
              album_name,
              album_image,
              request_type,
              status
            `
          )
          .in(
            "spotify_track_id",
            spotifyTrackIds
          )
          .order("created_at", {
            ascending: false,
          }),

        supabaseAdmin
          .from(
            "line_dance_songs"
          )
          .select(
            `
              id,
              line_dance_id,
              spotify_track_id,
              spotify_uri,
              track_name,
              artist_name,
              album_name,
              album_image,
              is_original_song
            `
          )
          .in(
            "spotify_track_id",
            spotifyTrackIds
          ),
      ]);

      if (
        requestsResult.error
      ) {
        console.error(
          "Unable to match playback tracks to requests:",
          requestsResult.error
        );
      } else {
        requestRecords =
          (requestsResult.data ??
            []) as RequestRecord[];
      }

      if (
        lineDanceSongsResult.error
      ) {
        console.error(
          "Unable to match playback tracks to line dances:",
          lineDanceSongsResult.error
        );
      } else {
        lineDanceSongs =
          (lineDanceSongsResult.data ??
            []) as LineDanceSongRecord[];
      }
    }

    const requestByTrackId =
      new Map<
        string,
        RequestRecord
      >();

    for (
      const requestRecord of
      requestRecords
    ) {
      const trackId =
        requestRecord
          .spotify_track_id;

      if (
        trackId &&
        !requestByTrackId.has(
          trackId
        )
      ) {
        requestByTrackId.set(
          trackId,
          requestRecord
        );
      }
    }

    const lineDanceSongByTrackId =
      new Map<
        string,
        LineDanceSongRecord
      >();

    for (
      const lineDanceSong of
      lineDanceSongs
    ) {
      if (
        lineDanceSong
          .spotify_track_id &&
        !lineDanceSongByTrackId.has(
          lineDanceSong
            .spotify_track_id
        )
      ) {
        lineDanceSongByTrackId.set(
          lineDanceSong
            .spotify_track_id,
          lineDanceSong
        );
      }
    }

    const lineDanceIds =
      Array.from(
        new Set(
          lineDanceSongs.map(
            (song) =>
              song.line_dance_id
          )
        )
      );

    let lineDances:
      LineDanceRecord[] = [];

    let originalSongs:
      LineDanceSongRecord[] = [];

    if (
      lineDanceIds.length > 0
    ) {
      const [
        lineDancesResult,
        originalSongsResult,
      ] = await Promise.all([
        supabaseAdmin
          .from("line_dances")
          .select(
            `
              id,
              name,
              also_known_as
            `
          )
          .in(
            "id",
            lineDanceIds
          ),

        supabaseAdmin
          .from(
            "line_dance_songs"
          )
          .select(
            `
              id,
              line_dance_id,
              spotify_track_id,
              spotify_uri,
              track_name,
              artist_name,
              album_name,
              album_image,
              is_original_song
            `
          )
          .in(
            "line_dance_id",
            lineDanceIds
          )
          .eq(
            "is_original_song",
            true
          ),
      ]);

      if (
        lineDancesResult.error
      ) {
        console.error(
          "Unable to load line dance information:",
          lineDancesResult.error
        );
      } else {
        lineDances =
          (lineDancesResult.data ??
            []) as LineDanceRecord[];
      }

      if (
        originalSongsResult.error
      ) {
        console.error(
          "Unable to load original line dance songs:",
          originalSongsResult.error
        );
      } else {
        originalSongs =
          (originalSongsResult.data ??
            []) as LineDanceSongRecord[];
      }
    }

    const lineDanceById =
      new Map<
        string,
        LineDanceRecord
      >();

    for (
      const lineDance of
      lineDances
    ) {
      lineDanceById.set(
        lineDance.id,
        lineDance
      );
    }

    const originalSongByDanceId =
      new Map<
        string,
        LineDanceSongRecord
      >();

    for (
      const originalSong of
      originalSongs
    ) {
      if (
        !originalSongByDanceId.has(
          originalSong
            .line_dance_id
        )
      ) {
        originalSongByDanceId.set(
          originalSong
            .line_dance_id,
          originalSong
        );
      }
    }

    function createPlaybackTrack(
      track: SpotifyTrack
    ): PlaybackTrack {
      const spotifyTrackId =
        track.id ?? "";

      const requestRecord =
        spotifyTrackId
          ? requestByTrackId.get(
              spotifyTrackId
            )
          : undefined;

      const lineDanceSong =
        spotifyTrackId
          ? lineDanceSongByTrackId.get(
              spotifyTrackId
            )
          : undefined;

      const lineDance =
        lineDanceSong
          ? lineDanceById.get(
              lineDanceSong
                .line_dance_id
            )
          : undefined;

      const originalSong =
        lineDanceSong
          ? originalSongByDanceId.get(
              lineDanceSong
                .line_dance_id
            )
          : undefined;

      return mapPlaybackTrack(
        track,
        requestRecord,
        lineDanceSong,
        lineDance,
        originalSong
      );
    }

    const nowPlaying =
      currentlyPlaying
        ? createPlaybackTrack(
            currentlyPlaying
          )
        : null;

    const upcoming =
      upcomingTracks.map(
        createPlaybackTrack
      );

    return NextResponse.json(
      {
        isPlaying:
          Boolean(nowPlaying),
        nowPlaying,
        upcoming,
        updatedAt:
          new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error(
      "Spotify queue GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Spotify playback.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      (await request.json()) as QueueRequestBody;

    const requestId =
      typeof body.requestId ===
      "string"
        ? body.requestId.trim()
        : "";

    if (!requestId) {
      return NextResponse.json(
        {
          error:
            "Missing requestId.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: songRequest,
      error: requestError,
    } = await supabaseAdmin
      .from("requests")
      .select(
        "id, spotify_uri, track_name, status"
      )
      .eq("id", requestId)
      .maybeSingle();

    if (requestError) {
      return NextResponse.json(
        {
          error:
            requestError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!songRequest) {
      return NextResponse.json(
        {
          error:
            "Song request was not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      !songRequest.spotify_uri
    ) {
      return NextResponse.json(
        {
          error:
            "This request has no Spotify URI.",
        },
        {
          status: 400,
        }
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

    const spotifyResponse =
      await fetch(queueUrl, {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

    if (!spotifyResponse.ok) {
      const spotifyError =
        await readSpotifyError(
          spotifyResponse
        );

      return NextResponse.json(
        {
          error:
            getSpotifyErrorMessage(
              spotifyResponse.status,
              spotifyError
            ),
        },
        {
          status:
            spotifyResponse.status,
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
          details:
            updateError.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        `${songRequest.track_name} was added to the Spotify queue.`,
      request:
        updatedRequest,
    });
  } catch (error) {
    console.error(
      "Spotify queue POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to add the song to Spotify.",
      },
      {
        status: 500,
      }
    );
  }
}