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
      .select("id, storage_path, image_url, created_at")
      .eq("event_slug", eventSlug)
      .eq("status", "approved")
      .order("created_at", { ascending: true })
      .limit(500);

    if (error) {
      throw new Error(error.message);
    }

    const mapped = (data ?? [])
      .filter(
        (photo) =>
          typeof photo.image_url === "string" &&
          photo.image_url.length > 0
      )
      .map((photo) => ({
        id: photo.id,
        imageUrl: photo.image_url,
        createdAt: photo.created_at,
        storagePath: photo.storage_path,
      }));

    const housePrefix = `house/${eventSlug}/`;
    const housePhotos = mapped.filter((photo) =>
      photo.storagePath.startsWith(housePrefix)
    );
    const submittedPhotos = mapped.filter(
      (photo) => !photo.storagePath.startsWith(housePrefix)
    );

    return NextResponse.json(
      {
        housePhotos,
        submittedPhotos,
        // Keep the old key so older projector builds still receive guest photos.
        photos: submittedPhotos,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Unable to load approved photos:", error);

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
