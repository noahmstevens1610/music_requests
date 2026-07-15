import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type RequestType = "swing" | "line_dance";

type TrackInput = {
  id?: string;
  uri?: string;
  name?: string;
  artist?: string;
  album?: string;
  image?: string | null;
  explicit?: boolean;
};

type RequestBody = {
  eventSlug?: string;
  deviceId?: string;
  requestType?: RequestType;
  track?: TrackInput;
};

export async function GET(request: NextRequest) {
  const eventSlug = request.nextUrl.searchParams.get("event");

  if (!eventSlug) {
    return NextResponse.json(
      { error: "Event slug is required." },
      { status: 400 }
    );
  }

  const { data: event, error: eventError } = await supabaseAdmin
    .from("events")
    .select("id, name")
    .eq("slug", eventSlug)
    .eq("active", true)
    .maybeSingle();

  if (eventError) {
    return NextResponse.json(
      { error: eventError.message },
      { status: 500 }
    );
  }

  if (!event) {
    return NextResponse.json(
      { error: "Event was not found." },
      { status: 404 }
    );
  }

  const { data: songRequests, error } = await supabaseAdmin
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
        explicit,
        votes,
        host_priority,
        status,
        request_type,
        created_at
      `
    )
    .eq("event_id", event.id)
    .in("status", ["pending", "approved"])
    .order("host_priority", { ascending: false })
    .order("votes", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const allRequests = songRequests ?? [];

  const swingRequests = allRequests.filter(
    (songRequest) => songRequest.request_type === "swing"
  );

  const lineDanceRequests = allRequests.filter(
    (songRequest) => songRequest.request_type === "line_dance"
  );

  return NextResponse.json({
    event,
    swingRequests,
    lineDanceRequests,
  });
}

export async function POST(request: NextRequest) {
  let body: RequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "The request body is invalid." },
      { status: 400 }
    );
  }

  const eventSlug = body.eventSlug?.trim();
  const deviceId = body.deviceId?.trim();
  const requestType = body.requestType;
  const track = body.track;

  if (
    !eventSlug ||
    !deviceId ||
    !track?.id ||
    !track.uri ||
    !track.name ||
    !track.artist
  ) {
    return NextResponse.json(
      { error: "Required song information is missing." },
      { status: 400 }
    );
  }

  if (
    requestType !== "swing" &&
    requestType !== "line_dance"
  ) {
    return NextResponse.json(
      { error: "Choose Swing Song or Line Dance." },
      { status: 400 }
    );
  }

  const { data: event, error: eventError } =
    await supabaseAdmin
      .from("events")
      .select("id")
      .eq("slug", eventSlug)
      .eq("active", true)
      .maybeSingle();

  if (eventError) {
    return NextResponse.json(
      { error: eventError.message },
      { status: 500 }
    );
  }

  if (!event) {
    return NextResponse.json(
      {
        error:
          "Event was not found or is inactive.",
      },
      { status: 404 }
    );
  }

  const {
    data: existingRequest,
    error: existingError,
  } = await supabaseAdmin
    .from("requests")
    .select("id, votes")
    .eq("event_id", event.id)
    .eq("spotify_track_id", track.id)
    .eq("request_type", requestType)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { error: existingError.message },
      { status: 500 }
    );
  }

  if (existingRequest) {
    const { error: voteError } =
      await supabaseAdmin
        .from("votes")
        .insert({
          request_id: existingRequest.id,
          device_id: deviceId,
        });

    if (voteError?.code === "23505") {
      return NextResponse.json(
        {
          error:
            "You already voted for this song in this category.",
        },
        { status: 409 }
      );
    }

    if (voteError) {
      return NextResponse.json(
        { error: voteError.message },
        { status: 500 }
      );
    }

    const {
      data: updatedRequest,
      error: updateError,
    } = await supabaseAdmin
      .from("requests")
      .update({
        votes:
          existingRequest.votes + 1,
      })
      .eq("id", existingRequest.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Vote added.",
      request: updatedRequest,
    });
  }

  let selectedLineDanceId: string | null =
    null;

  if (requestType === "line_dance") {
    const {
      data: matchingLineDances,
      error: lineDanceLookupError,
    } = await supabaseAdmin
      .from("line_dance_songs")
      .select("line_dance_id")
      .eq(
        "spotify_track_id",
        track.id
      );

    if (lineDanceLookupError) {
      return NextResponse.json(
        {
          error:
            lineDanceLookupError.message,
        },
        {
          status: 500,
        }
      );
    }

    const uniqueDanceIds = [
      ...new Set(
        (matchingLineDances ?? []).map(
          (dance) =>
            dance.line_dance_id
        )
      ),
    ];

    if (uniqueDanceIds.length === 1) {
      selectedLineDanceId =
        uniqueDanceIds[0];
    }
  }

  const {
    data: createdRequest,
    error: createError,
  } = await supabaseAdmin
    .from("requests")
    .insert({
      event_id: event.id,
      spotify_track_id: track.id,
      spotify_uri: track.uri,
      track_name: track.name,
      artist_name: track.artist,
      album_name: track.album ?? null,
      album_image: track.image ?? null,
      explicit:
        track.explicit ?? false,
      device_id: deviceId,
      votes: 1,
      status: "pending",
      request_type: requestType,
      selected_line_dance_id:
        selectedLineDanceId,
    })
    .select()
    .single();

  if (createError) {
    return NextResponse.json(
      { error: createError.message },
      { status: 500 }
    );
  }

  const { error: firstVoteError } =
    await supabaseAdmin
      .from("votes")
      .insert({
        request_id: createdRequest.id,
        device_id: deviceId,
      });

  if (firstVoteError) {
    await supabaseAdmin
      .from("requests")
      .delete()
      .eq("id", createdRequest.id);

    return NextResponse.json(
      { error: firstVoteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      message:
        requestType === "swing"
          ? "Swing song requested."
          : "Line dance requested.",
      request: createdRequest,
    },
    { status: 201 }
  );
}