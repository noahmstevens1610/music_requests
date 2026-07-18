import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

type PhotoStatus = "pending" | "approved" | "rejected";

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
  const savedToken = cookieStore.get("big_iron_admin_session")?.value;

  if (!savedToken) {
    return false;
  }

  return savedToken === (await createSessionToken(sessionSecret));
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return unauthorized();
  }

  const eventSlug =
    request.nextUrl.searchParams.get("event")?.trim() || "big-iron";

  const { data, error } = await supabaseAdmin
    .from("guest_photos")
    .select(
      "id, event_slug, storage_path, image_url, status, device_id, original_filename, mime_type, file_size_bytes, created_at, reviewed_at"
    )
    .eq("event_slug", eventSlug)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: `Unable to load photos: ${error.message}` },
      { status: 500 }
    );
  }

  const photos = (data ?? []).map((photo) => {
  const {
    data: { publicUrl },
  } = supabaseAdmin.storage
    .from("guest-photos")
    .getPublicUrl(photo.storage_path);

  return {
    ...photo,
    image_url: publicUrl,
  };
});

  return NextResponse.json({
    photos,
    counts: {
      pending: photos.filter((photo) => photo.status === "pending").length,
      approved: photos.filter((photo) => photo.status === "approved").length,
      rejected: photos.filter((photo) => photo.status === "rejected").length,
    },
  });
}

export async function PATCH(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return unauthorized();
  }

  let body: { photoId?: string; status?: PhotoStatus };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const photoId = body.photoId?.trim();
  const status = body.status;

  if (!photoId) {
    return NextResponse.json(
      { error: "Photo ID is required." },
      { status: 400 }
    );
  }

  if (
    status !== "pending" &&
    status !== "approved" &&
    status !== "rejected"
  ) {
    return NextResponse.json(
      { error: "Invalid photo status." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("guest_photos")
    .update({
      status,
      reviewed_at: status === "pending" ? null : new Date().toISOString(),
    })
    .eq("id", photoId)
    .select(
      "id, event_slug, storage_path, image_url, status, device_id, original_filename, mime_type, file_size_bytes, created_at, reviewed_at"
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: `Unable to update photo: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ photo: data });
}

export async function DELETE(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return unauthorized();
  }

  let body: { photoId?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const photoId = body.photoId?.trim();

  if (!photoId) {
    return NextResponse.json(
      { error: "Photo ID is required." },
      { status: 400 }
    );
  }

  const { data: photo, error: lookupError } = await supabaseAdmin
    .from("guest_photos")
    .select("id, storage_path, status")
    .eq("id", photoId)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json(
      { error: `Unable to find photo: ${lookupError.message}` },
      { status: 500 }
    );
  }

  if (!photo) {
    return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  }

  if (photo.status !== "rejected") {
    return NextResponse.json(
      { error: "Only removed photos can be permanently deleted." },
      { status: 400 }
    );
  }

  const { error: storageError } = await supabaseAdmin.storage
    .from("guest-photos")
    .remove([photo.storage_path]);

  if (storageError) {
    return NextResponse.json(
      { error: `Unable to delete stored image: ${storageError.message}` },
      { status: 500 }
    );
  }

  const { error: deleteError } = await supabaseAdmin
    .from("guest_photos")
    .delete()
    .eq("id", photoId);

  if (deleteError) {
    return NextResponse.json(
      { error: `Unable to delete photo record: ${deleteError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
