import {
  NextRequest,
  NextResponse,
} from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type TrackInput = {
  id?: string;
  uri?: string;
  name?: string;
  artist?: string;
  album?: string;
  image?: string | null;
};

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
  _request: NextRequest,
  context: RouteContext
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

  const { id: lineDanceId } =
    await context.params;

  const {
    data: lineDance,
    error: lineDanceError,
  } = await supabaseAdmin
    .from("line_dances")
    .select("*")
    .eq("id", lineDanceId)
    .maybeSingle();

  if (lineDanceError) {
    return NextResponse.json(
      {
        error: lineDanceError.message,
      },
      {
        status: 500,
      }
    );
  }

  if (!lineDance) {
    return NextResponse.json(
      {
        error: "Line dance not found.",
      },
      {
        status: 404,
      }
    );
  }

  const {
    data: songs,
    error: songsError,
  } = await supabaseAdmin
    .from("line_dance_songs")
    .select("*")
    .eq("line_dance_id", lineDanceId)
    .order("is_original_song", {
      ascending: false,
    })
    .order("track_name", {
      ascending: true,
    });

  if (songsError) {
    return NextResponse.json(
      {
        error: songsError.message,
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    lineDance,
    songs: songs ?? [],
  });
}

export async function POST(
  request: NextRequest,
  context: RouteContext
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

  const { id: lineDanceId } =
    await context.params;

  let body: {
    track?: TrackInput;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "Invalid request body.",
      },
      {
        status: 400,
      }
    );
  }

  const spotifyTrackId =
    body.track?.id?.trim();

  const spotifyUri =
    body.track?.uri?.trim();

  const trackName =
    body.track?.name?.trim();

  const artistName =
    body.track?.artist?.trim();

  const albumName =
    body.track?.album?.trim() || null;

  const albumImage =
    body.track?.image?.trim() || null;

  if (
    !spotifyTrackId ||
    !spotifyUri ||
    !trackName ||
    !artistName
  ) {
    return NextResponse.json(
      {
        error:
          "Spotify track information is incomplete.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    data: lineDance,
    error: lineDanceError,
  } = await supabaseAdmin
    .from("line_dances")
    .select("id")
    .eq("id", lineDanceId)
    .maybeSingle();

  if (lineDanceError) {
    return NextResponse.json(
      {
        error: lineDanceError.message,
      },
      {
        status: 500,
      }
    );
  }

  if (!lineDance) {
    return NextResponse.json(
      {
        error: "Line dance not found.",
      },
      {
        status: 404,
      }
    );
  }

  const {
    data: existingSong,
    error: existingSongError,
  } = await supabaseAdmin
    .from("line_dance_songs")
    .select("id")
    .eq("line_dance_id", lineDanceId)
    .eq(
      "spotify_track_id",
      spotifyTrackId
    )
    .maybeSingle();

  if (existingSongError) {
    return NextResponse.json(
      {
        error: existingSongError.message,
      },
      {
        status: 500,
      }
    );
  }

  if (existingSong) {
    return NextResponse.json(
      {
        error:
          "That song is already connected to this line dance.",
      },
      {
        status: 409,
      }
    );
  }

  const {
    count,
    error: countError,
  } = await supabaseAdmin
    .from("line_dance_songs")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("line_dance_id", lineDanceId);

  if (countError) {
    return NextResponse.json(
      {
        error: countError.message,
      },
      {
        status: 500,
      }
    );
  }

  const isFirstSong = (count ?? 0) === 0;

  const {
    data: song,
    error: insertError,
  } = await supabaseAdmin
    .from("line_dance_songs")
    .insert({
      line_dance_id: lineDanceId,
      spotify_track_id:
        spotifyTrackId,
      spotify_uri: spotifyUri,
      track_name: trackName,
      artist_name: artistName,
      album_name: albumName,
      album_image: albumImage,
      is_original_song:
        isFirstSong,
    })
    .select()
    .single();

  if (insertError) {
    const duplicate =
      insertError.code === "23505";

    return NextResponse.json(
      {
        error: duplicate
          ? "That song is already connected to a line dance."
          : insertError.message,
      },
      {
        status: duplicate
          ? 409
          : 500,
      }
    );
  }

  return NextResponse.json(
    {
      song,
    },
    {
      status: 201,
    }
  );
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
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

  const { id: lineDanceId } =
    await context.params;

  let body: {
    songId?: string;
    action?: "make_original";
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "Invalid request body.",
      },
      {
        status: 400,
      }
    );
  }

  const songId = body.songId?.trim();

  if (
    !songId ||
    body.action !== "make_original"
  ) {
    return NextResponse.json(
      {
        error:
          "A valid song ID and action are required.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    data: selectedSong,
    error: selectedSongError,
  } = await supabaseAdmin
    .from("line_dance_songs")
    .select("id, is_original_song")
    .eq("id", songId)
    .eq("line_dance_id", lineDanceId)
    .maybeSingle();

  if (selectedSongError) {
    return NextResponse.json(
      {
        error: selectedSongError.message,
      },
      {
        status: 500,
      }
    );
  }

  if (!selectedSong) {
    return NextResponse.json(
      {
        error:
          "The selected song was not found.",
      },
      {
        status: 404,
      }
    );
  }

  if (selectedSong.is_original_song) {
    return NextResponse.json({
      song: selectedSong,
    });
  }

  const {
    data: song,
    error: updateError,
  } = await supabaseAdmin
    .from("line_dance_songs")
    .update({
      is_original_song: true,
    })
    .eq("id", songId)
    .eq("line_dance_id", lineDanceId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      {
        error: updateError.message,
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    song,
  });
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
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

  const { id: lineDanceId } =
    await context.params;

  let body: {
    songId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "Invalid request body.",
      },
      {
        status: 400,
      }
    );
  }

  const songId =
    body.songId?.trim();

  if (!songId) {
    return NextResponse.json(
      {
        error: "Song ID is required.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    data: songToDelete,
    error: lookupError,
  } = await supabaseAdmin
    .from("line_dance_songs")
    .select(
      "id, is_original_song"
    )
    .eq("id", songId)
    .eq("line_dance_id", lineDanceId)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json(
      {
        error: lookupError.message,
      },
      {
        status: 500,
      }
    );
  }

  if (!songToDelete) {
    return NextResponse.json(
      {
        error: "Song not found.",
      },
      {
        status: 404,
      }
    );
  }

  const { error: deleteError } =
    await supabaseAdmin
      .from("line_dance_songs")
      .delete()
      .eq("id", songId)
      .eq(
        "line_dance_id",
        lineDanceId
      );

  if (deleteError) {
    return NextResponse.json(
      {
        error: deleteError.message,
      },
      {
        status: 500,
      }
    );
  }

  let replacementOriginalId:
    | string
    | null = null;

  if (
    songToDelete.is_original_song
  ) {
    const {
      data: replacementSong,
      error: replacementError,
    } = await supabaseAdmin
      .from("line_dance_songs")
      .select("id")
      .eq(
        "line_dance_id",
        lineDanceId
      )
      .order("created_at", {
        ascending: true,
      })
      .limit(1)
      .maybeSingle();

    if (replacementError) {
      return NextResponse.json(
        {
          error:
            replacementError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (replacementSong) {
      const {
        error:
          replacementUpdateError,
      } = await supabaseAdmin
        .from("line_dance_songs")
        .update({
          is_original_song: true,
        })
        .eq(
          "id",
          replacementSong.id
        );

      if (
        replacementUpdateError
      ) {
        return NextResponse.json(
          {
            error:
              replacementUpdateError.message,
          },
          {
            status: 500,
          }
        );
      }

      replacementOriginalId =
        replacementSong.id;
    }
  }

  return NextResponse.json({
    success: true,
    replacementOriginalId,
  });
}