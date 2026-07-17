import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function findEvent(eventSlug: string) {
  return supabaseAdmin
    .from("events")
    .select("id, name, slug")
    .eq("slug", eventSlug)
    .maybeSingle();
}

export async function GET(request: NextRequest) {
  const eventSlug = request.nextUrl.searchParams.get("event")?.trim();

  if (!eventSlug) {
    return NextResponse.json({ error: "Event slug is required." }, { status: 400 });
  }

  const { data: event, error: eventError } = await findEvent(eventSlug);

  if (eventError) {
    return NextResponse.json({ error: eventError.message }, { status: 500 });
  }

  if (!event) {
    return NextResponse.json({ error: "Event was not found." }, { status: 404 });
  }

  const { data: requests, error } = await supabaseAdmin
    .from("requests")
    .select(`
      id,
      spotify_track_id,
      spotify_uri,
      track_name,
      artist_name,
      album_name,
      album_image,
      votes,
      status,
      request_type,
      created_at
    `)
    .eq("event_id", event.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ event, requests: requests ?? [] });
}

export async function DELETE(request: NextRequest) {
  let body: { eventSlug?: string; confirmation?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const eventSlug = body.eventSlug?.trim();

  if (!eventSlug) {
    return NextResponse.json({ error: "Event slug is required." }, { status: 400 });
  }

  if (body.confirmation !== "RESET") {
    return NextResponse.json(
      { error: 'Type "RESET" to confirm clearing all requests.' },
      { status: 400 }
    );
  }

  const { data: event, error: eventError } = await findEvent(eventSlug);

  if (eventError) {
    return NextResponse.json({ error: eventError.message }, { status: 500 });
  }

  if (!event) {
    return NextResponse.json({ error: "Event was not found." }, { status: 404 });
  }

  const { data: requestRows, error: requestLookupError } = await supabaseAdmin
    .from("requests")
    .select("id")
    .eq("event_id", event.id);

  if (requestLookupError) {
    return NextResponse.json({ error: requestLookupError.message }, { status: 500 });
  }

  const requestIds = (requestRows ?? []).map((row) => row.id);

  if (requestIds.length > 0) {
    const { error: votesError } = await supabaseAdmin
      .from("votes")
      .delete()
      .in("request_id", requestIds);

    if (votesError) {
      return NextResponse.json({ error: votesError.message }, { status: 500 });
    }
  }

  const { error: deleteError } = await supabaseAdmin
    .from("requests")
    .delete()
    .eq("event_id", event.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    deletedCount: requestIds.length,
    message: `${requestIds.length} request${requestIds.length === 1 ? "" : "s"} cleared.`,
  });
}
