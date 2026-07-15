import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type SongCategory =
  | "line_dance"
  | "swing_song"
  | "special";

type SongMetadataBody = {
  spotifyTrackId?: string;
  trackName?: string;
  artistName?: string;
  spotifyUri?: string;
  albumName?: string;
  albumImage?: string;

  category?: SongCategory;
  choreography?: string;
  alsoKnownAs?: string;

  isSongSwap?: boolean;
  originalSpotifyTrackId?: string | null;
};

const validCategories: SongCategory[] = [
  "line_dance",
  "swing_song",
  "special",
];

export async function GET(
  request: NextRequest
) {
  const spotifyTrackId =
    request.nextUrl.searchParams.get(
      "spotifyTrackId"
    );

  if (!spotifyTrackId) {
    return NextResponse.json(
      {
        error:
          "spotifyTrackId is required.",
      },
      { status: 400 }
    );
  }

  const { data, error } =
    await supabaseAdmin
      .from("song_metadata")
      .select("*")
      .eq(
        "spotify_track_id",
        spotifyTrackId
      )
      .maybeSingle();

  if (error) {
    console.error(
      "Unable to load song metadata:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to load song details.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    songMetadata: data ?? null,
  });
}

export async function PATCH(
  request: NextRequest
) {
  let body: SongMetadataBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "Invalid request body.",
      },
      { status: 400 }
    );
  }

  const {
    spotifyTrackId,
    trackName,
    artistName,
    spotifyUri,
    albumName,
    albumImage,
    category,
    choreography,
    alsoKnownAs,
    isSongSwap = false,
    originalSpotifyTrackId,
  } = body;

  if (
    !spotifyTrackId ||
    !trackName ||
    !artistName ||
    !category
  ) {
    return NextResponse.json(
      {
        error:
          "spotifyTrackId, trackName, artistName, and category are required.",
      },
      { status: 400 }
    );
  }

  if (
    !validCategories.includes(category)
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid song category.",
      },
      { status: 400 }
    );
  }

  if (
    isSongSwap &&
    originalSpotifyTrackId &&
    originalSpotifyTrackId ===
      spotifyTrackId
  ) {
    return NextResponse.json(
      {
        error:
          "A song cannot be a song swap for itself.",
      },
      { status: 400 }
    );
  }

  const metadata = {
    spotify_track_id:
      spotifyTrackId,
    track_name: trackName.trim(),
    artist_name: artistName.trim(),
    spotify_uri:
      spotifyUri?.trim() || null,
    album_name:
      albumName?.trim() || null,
    album_image:
      albumImage?.trim() || null,

    category,

    choreography:
      choreography?.trim() || null,

    also_known_as:
      alsoKnownAs?.trim() || null,

    is_song_swap: isSongSwap,

    original_spotify_track_id:
      isSongSwap &&
      originalSpotifyTrackId
        ? originalSpotifyTrackId
        : null,

    updated_at:
      new Date().toISOString(),
  };

  const { data, error } =
    await supabaseAdmin
      .from("song_metadata")
      .upsert(metadata, {
        onConflict:
          "spotify_track_id",
      })
      .select()
      .single();

  if (error) {
    console.error(
      "Unable to save song metadata:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to save song details.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    songMetadata: data,
  });
}