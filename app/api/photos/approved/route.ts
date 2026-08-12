import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const eventSlug =
      request.nextUrl.searchParams.get("event")?.trim() ||
      "big-iron";

    const { data, error } = await supabaseAdmin
      .from("guest_photos")
      .select("id, image_url, created_at")
      .eq("event_slug", eventSlug)
      .eq("status", "approved")
      .order("created_at", { ascending: true })
      .limit(250);

    if (error) {
      throw new Error(error.message);
    }

    const photos = (data ?? [])
      .filter(
        (photo) =>
          typeof photo.image_url === "string" &&
          photo.image_url.length > 0
      )
      .map((photo) => ({
        id: photo.id,
        imageUrl: photo.image_url,
        createdAt: photo.created_at,
      }));

    return NextResponse.json(
      { photos },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(
      "Unable to load approved guest photos:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load approved photos.",
      },
      { status: 500 }
    );
  }
}