import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSpotifyAccessToken } from "@/lib/spotify";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type SpotifyTrackInput = {
  id?: unknown;
  uri?: unknown;
  name?: unknown;
  artist?: unknown;
  album?: unknown;
  image?: unknown;
  explicit?: unknown;
};

type LinkedSongRow = {
  id: string;
  line_dance_id: string;
  spotify_track_id: string;
  spotify_uri: string;
  track_name: string;
  artist_name: string;
  album_name: string | null;
  album_image: string | null;
  is_original_song: boolean;
  created_at?: string;
  updated_at?: string;
};

async function getExplicitBySpotifyTrackId(trackIds: string[]) {
  const explicitById = new Map<string, boolean>();
  const uniqueTrackIds = Array.from(new Set(trackIds.filter(Boolean)));

  if (uniqueTrackIds.length === 0) {
    return explicitById;
  }

  try {
    const accessToken = await getSpotifyAccessToken();

    for (let index = 0; index < uniqueTrackIds.length; index += 50) {
      const chunk = uniqueTrackIds.slice(index, index + 50);
      const spotifyUrl = new URL("https://api.spotify.com/v1/tracks");
      spotifyUrl.searchParams.set("ids", chunk.join(","));
      spotifyUrl.searchParams.set("market", "US");

      const response = await fetch(spotifyUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        continue;
      }

      const data = (await response.json()) as {
        tracks?: Array<{
          id?: string;
          explicit?: boolean;
        } | null>;
      };

      for (const track of data.tracks ?? []) {
        if (track?.id) {
          explicitById.set(track.id, Boolean(track.explicit));
        }
      }
    }
  } catch (error) {
    console.error("Unable to load Spotify explicit flags:", error);
  }

  return explicitById;
}

async function createSessionToken(secret: string): Promise<string> {
  const encodedSecret = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest("SHA-256", encodedSecret);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function isAuthenticated(): Promise<boolean> {
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;

  if (!sessionSecret) return false;

  const cookieStore = await cookies();
  const savedToken = cookieStore.get("big_iron_admin_session")?.value;

  if (!savedToken) return false;

  const expectedToken = await createSessionToken(sessionSecret);
  return savedToken === expectedToken;
}

async function getLineDance(lineDanceId: string) {
  return supabaseAdmin
    .from("line_dances")
    .select("*")
    .eq("id", lineDanceId)
    .maybeSingle();
}

export async function GET(_request: NextRequest, context: RouteContext) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id: lineDanceId } = await context.params;

  if (!lineDanceId?.trim()) {
    return NextResponse.json(
      { error: "Line dance ID is required." },
      { status: 400 }
    );
  }

  const { data: lineDance, error: lineDanceError } =
    await getLineDance(lineDanceId);

  if (lineDanceError) {
    return NextResponse.json(
      { error: lineDanceError.message },
      { status: 500 }
    );
  }

  if (!lineDance) {
    return NextResponse.json(
      { error: "Line dance not found." },
      { status: 404 }
    );
  }

  const { data: songs, error: songsError } = await supabaseAdmin
    .from("line_dance_songs")
    .select("*")
    .eq("line_dance_id", lineDanceId)
    .order("is_original_song", { ascending: false })
    .order("track_name", { ascending: true });

  if (songsError) {
    return NextResponse.json(
      { error: songsError.message },
      { status: 500 }
    );
  }

  const songRows = (songs ?? []) as LinkedSongRow[];
  const explicitById = await getExplicitBySpotifyTrackId(
    songRows.map((song) => song.spotify_track_id)
  );

  return NextResponse.json({
    lineDance,
    songs: songRows.map((song) => ({
      ...song,
      explicit: explicitById.get(song.spotify_track_id) ?? false,
    })),
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id: lineDanceId } = await context.params;

  let body: { track?: SpotifyTrackInput };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const track = body.track;
  const spotifyTrackId = typeof track?.id === "string" ? track.id.trim() : "";
  const spotifyUri = typeof track?.uri === "string" ? track.uri.trim() : "";
  const trackName = typeof track?.name === "string" ? track.name.trim() : "";
  const artistName =
    typeof track?.artist === "string" ? track.artist.trim() : "";
  const albumName =
    typeof track?.album === "string" && track.album.trim()
      ? track.album.trim()
      : null;
  const albumImage =
    typeof track?.image === "string" && track.image.trim()
      ? track.image.trim()
      : null;
  const explicit = track?.explicit === true;

  if (!lineDanceId?.trim() || !spotifyTrackId || !spotifyUri || !trackName || !artistName) {
    return NextResponse.json(
      { error: "Complete Spotify track information is required." },
      { status: 400 }
    );
  }

  const { data: lineDance, error: lineDanceError } =
    await getLineDance(lineDanceId);

  if (lineDanceError) {
    return NextResponse.json(
      { error: lineDanceError.message },
      { status: 500 }
    );
  }

  if (!lineDance) {
    return NextResponse.json(
      { error: "Line dance not found." },
      { status: 404 }
    );
  }

  const { data: existingSong, error: existingError } = await supabaseAdmin
    .from("line_dance_songs")
    .select("*")
    .eq("line_dance_id", lineDanceId)
    .eq("spotify_track_id", spotifyTrackId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { error: existingError.message },
      { status: 500 }
    );
  }

  if (existingSong) {
    return NextResponse.json(
      { error: "That song is already connected to this line dance." },
      { status: 409 }
    );
  }

  const { count, error: countError } = await supabaseAdmin
    .from("line_dance_songs")
    .select("id", { count: "exact", head: true })
    .eq("line_dance_id", lineDanceId);

  if (countError) {
    return NextResponse.json(
      { error: countError.message },
      { status: 500 }
    );
  }

  const isOriginalSong = (count ?? 0) === 0;

  const { data: song, error: insertError } = await supabaseAdmin
    .from("line_dance_songs")
    .insert({
      line_dance_id: lineDanceId,
      spotify_track_id: spotifyTrackId,
      spotify_uri: spotifyUri,
      track_name: trackName,
      artist_name: artistName,
      album_name: albumName,
      album_image: albumImage,
      is_original_song: isOriginalSong,
    })
    .select("*")
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      song: {
        ...song,
        explicit,
      },
      message: "Song connected to line dance.",
    },
    { status: 201 }
  );
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id: lineDanceId } = await context.params;

  let body: {
    songId?: unknown;
    action?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const songId = typeof body.songId === "string" ? body.songId.trim() : "";
  const action = typeof body.action === "string" ? body.action : "";

  if (!lineDanceId?.trim() || !songId) {
    return NextResponse.json(
      { error: "Line dance ID and song ID are required." },
      { status: 400 }
    );
  }

  if (action !== "make_original") {
    return NextResponse.json(
      { error: "Unsupported song update." },
      { status: 400 }
    );
  }

  const { data: song, error: updateError } = await supabaseAdmin
    .from("line_dance_songs")
    .update({ is_original_song: true })
    .eq("id", songId)
    .eq("line_dance_id", lineDanceId)
    .select("*")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 }
    );
  }

  if (!song) {
    return NextResponse.json(
      { error: "Connected song not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    song,
    message: "Song marked as original.",
  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id: lineDanceId } = await context.params;

  let body: { songId?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const songId = typeof body.songId === "string" ? body.songId.trim() : "";

  if (!lineDanceId?.trim() || !songId) {
    return NextResponse.json(
      { error: "Line dance ID and song ID are required." },
      { status: 400 }
    );
  }

  const { data: song, error: lookupError } = await supabaseAdmin
    .from("line_dance_songs")
    .select("id, is_original_song")
    .eq("id", songId)
    .eq("line_dance_id", lineDanceId)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json(
      { error: lookupError.message },
      { status: 500 }
    );
  }

  if (!song) {
    return NextResponse.json(
      { error: "Connected song not found." },
      { status: 404 }
    );
  }

  const { error: deleteError } = await supabaseAdmin
    .from("line_dance_songs")
    .delete()
    .eq("id", songId)
    .eq("line_dance_id", lineDanceId);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message },
      { status: 500 }
    );
  }

  if (song.is_original_song) {
    const { data: remainingSongs, error: remainingError } = await supabaseAdmin
      .from("line_dance_songs")
      .select("id, is_original_song, created_at")
      .eq("line_dance_id", lineDanceId)
      .order("created_at", { ascending: true });

    if (!remainingError && (remainingSongs ?? []).length > 0) {
      const stillHasOriginal = (remainingSongs ?? []).some(
        (remainingSong) => remainingSong.is_original_song
      );

      if (!stillHasOriginal) {
        await supabaseAdmin
          .from("line_dance_songs")
          .update({ is_original_song: true })
          .eq("id", remainingSongs![0].id);
      }
    }
  }

  return NextResponse.json({
    success: true,
    message: "Song removed from line dance.",
  });
}
