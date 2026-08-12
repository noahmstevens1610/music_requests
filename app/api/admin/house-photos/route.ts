import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import sharp from "sharp";
import { createHash, randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_PROJECTOR_DIMENSION = 1920;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

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

  return savedToken === (await createSessionToken(sessionSecret));
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

function housePrefix(eventSlug: string) {
  return `house/${eventSlug}/`;
}

function isHousePath(storagePath: string, eventSlug: string) {
  return storagePath.startsWith(housePrefix(eventSlug));
}

function withImageUrl<T extends { id: string }>(photo: T) {
  return {
    ...photo,
    image_url: `/api/photos/image?photoId=${encodeURIComponent(photo.id)}`,
  };
}


function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function makeBrowserSafeJpeg(sourceBuffer: Buffer) {
  const jpegBuffer = await sharp(sourceBuffer, {
    failOn: "none",
  })
    .rotate()
    .resize({
      width: MAX_PROJECTOR_DIMENSION,
      height: MAX_PROJECTOR_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({
      quality: 86,
      mozjpeg: true,
    })
    .toBuffer();

  const metadata = await sharp(jpegBuffer).metadata();

  if (
    metadata.format !== "jpeg" ||
    !metadata.width ||
    !metadata.height
  ) {
    throw new Error(
      "The selected image could not be converted to a valid JPEG."
    );
  }

  return jpegBuffer;
}

async function uploadAndVerify(
  storagePath: string,
  jpegBuffer: Buffer
) {
  const uploadBlob = new Blob(
    [new Uint8Array(jpegBuffer)],
    { type: "image/jpeg" }
  );

  const { error: uploadError } = await supabaseAdmin.storage
    .from("guest-photos")
    .upload(storagePath, uploadBlob, {
      contentType: "image/jpeg",
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  try {
    const { data: storedFile, error: downloadError } =
      await supabaseAdmin.storage
        .from("guest-photos")
        .download(storagePath);

    if (downloadError || !storedFile) {
      throw new Error(
        downloadError?.message ??
          "Uploaded photo could not be read back from storage."
      );
    }

    const storedBuffer = Buffer.from(
      await storedFile.arrayBuffer()
    );

    if (
      storedBuffer.length !== jpegBuffer.length ||
      sha256(storedBuffer) !== sha256(jpegBuffer)
    ) {
      throw new Error(
        "The stored photo did not match the uploaded image."
      );
    }

    await sharp(storedBuffer).metadata();
  } catch (error) {
    await supabaseAdmin.storage
      .from("guest-photos")
      .remove([storagePath]);

    throw error;
  }
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) return unauthorized();

  const eventSlug =
    request.nextUrl.searchParams.get("event")?.trim() || "big-iron";

  const { data, error } = await supabaseAdmin
    .from("guest_photos")
    .select(
      "id, event_slug, storage_path, image_url, status, original_filename, mime_type, file_size_bytes, created_at, reviewed_at"
    )
    .eq("event_slug", eventSlug)
    .like("storage_path", `${housePrefix(eventSlug)}%`)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: `Unable to load house photos: ${error.message}` },
      { status: 500 }
    );
  }

  const photos = (data ?? []).map((photo) =>
    withImageUrl(photo)
  );

  return NextResponse.json({ photos });
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) return unauthorized();

  try {
    const formData = await request.formData();
    const file = formData.get("photo");
    const eventSlug =
      String(formData.get("eventSlug") ?? "big-iron").trim() ||
      "big-iron";

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please choose a photo." },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          error:
            "Please upload a JPG, PNG, WebP, HEIC, or HEIF image.",
        },
        { status: 400 }
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { error: "The selected photo is empty." },
        { status: 400 }
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Photo must be 10 MB or smaller." },
        { status: 400 }
      );
    }

    const sourceBuffer = Buffer.from(
      await file.arrayBuffer()
    );

    if (sourceBuffer.length !== file.size) {
      return NextResponse.json(
        {
          error:
            "The browser did not send the complete image. Please choose it again.",
        },
        { status: 400 }
      );
    }

    const jpegBuffer =
      await makeBrowserSafeJpeg(sourceBuffer);

    const storagePath =
      `${housePrefix(eventSlug)}${randomUUID()}.jpg`;

    await uploadAndVerify(storagePath, jpegBuffer);

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage
      .from("guest-photos")
      .getPublicUrl(storagePath);

    const { data: photo, error: insertError } =
      await supabaseAdmin
        .from("guest_photos")
        .insert({
          event_slug: eventSlug,
          storage_path: storagePath,
          image_url: publicUrl,
          status: "approved",
          device_id: null,
          original_filename: file.name || null,
          mime_type: "image/jpeg",
          file_size_bytes: jpegBuffer.length,
          reviewed_at: new Date().toISOString(),
        })
        .select(
          "id, event_slug, storage_path, image_url, status, original_filename, mime_type, file_size_bytes, created_at, reviewed_at"
        )
        .single();

    if (insertError) {
      await supabaseAdmin.storage
        .from("guest-photos")
        .remove([storagePath]);

      throw new Error(insertError.message);
    }

    return NextResponse.json(
      { photo: withImageUrl(photo) },
      { status: 201 }
    );
  } catch (error) {
    console.error("House photo upload failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to upload house photo.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await isAuthenticated())) return unauthorized();

  let body: {
    photoId?: string;
    status?: "approved" | "rejected";
    eventSlug?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const photoId = body.photoId?.trim();
  const eventSlug = body.eventSlug?.trim() || "big-iron";
  const status = body.status;

  if (!photoId || (status !== "approved" && status !== "rejected")) {
    return NextResponse.json(
      { error: "Photo ID and a valid status are required." },
      { status: 400 }
    );
  }

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("guest_photos")
    .select("id, event_slug, storage_path")
    .eq("id", photoId)
    .eq("event_slug", eventSlug)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json(
      { error: `Unable to find house photo: ${lookupError.message}` },
      { status: 500 }
    );
  }

  if (!existing || !isHousePath(existing.storage_path, eventSlug)) {
    return NextResponse.json(
      { error: "House photo not found." },
      { status: 404 }
    );
  }

  const { data: photo, error } = await supabaseAdmin
    .from("guest_photos")
    .update({
      status,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", photoId)
    .select(
      "id, event_slug, storage_path, image_url, status, original_filename, mime_type, file_size_bytes, created_at, reviewed_at"
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: `Unable to update house photo: ${error.message}` },
      { status: 500 }
    );
  }

  const imagePhoto = withImageUrl(photo);

  return NextResponse.json({ photo: imagePhoto });
}

export async function DELETE(request: NextRequest) {
  if (!(await isAuthenticated())) return unauthorized();

  let body: { photoId?: string; eventSlug?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const photoId = body.photoId?.trim();
  const eventSlug = body.eventSlug?.trim() || "big-iron";

  if (!photoId) {
    return NextResponse.json(
      { error: "Photo ID is required." },
      { status: 400 }
    );
  }

  const { data: photo, error: lookupError } = await supabaseAdmin
    .from("guest_photos")
    .select("id, storage_path")
    .eq("id", photoId)
    .eq("event_slug", eventSlug)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json(
      { error: `Unable to find house photo: ${lookupError.message}` },
      { status: 500 }
    );
  }

  if (!photo || !isHousePath(photo.storage_path, eventSlug)) {
    return NextResponse.json(
      { error: "House photo not found." },
      { status: 404 }
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
      { error: `Unable to delete house photo record: ${deleteError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
