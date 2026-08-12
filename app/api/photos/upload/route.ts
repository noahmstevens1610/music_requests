import { NextRequest, NextResponse } from "next/server";
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

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function makeBrowserSafeJpeg(sourceBuffer: Buffer) {
  try {
    const optimizedBuffer = await sharp(sourceBuffer, {
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

    // Verify the bytes before they ever leave the server.
    const metadata = await sharp(optimizedBuffer).metadata();

    if (
      metadata.format !== "jpeg" ||
      !metadata.width ||
      !metadata.height
    ) {
      throw new Error("Image conversion did not produce a valid JPEG.");
    }

    return optimizedBuffer;
  } catch (error) {
    console.error("Unable to process submitted image:", error);

    throw new Error(
      "This photo could not be processed. Please try another copy of the image or export it as JPG, PNG, or WebP first."
    );
  }
}

async function uploadAndVerify(
  storagePath: string,
  jpegBuffer: Buffer
) {
  // Use a Blob so Supabase Storage receives an actual binary file body,
  // rather than relying on Buffer handling in the server fetch stack.
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

    // Verify the stored object is byte-for-byte what we uploaded.
    if (
      storedBuffer.length !== jpegBuffer.length ||
      sha256(storedBuffer) !== sha256(jpegBuffer)
    ) {
      throw new Error(
        "The stored photo did not match the uploaded image."
      );
    }

    const metadata = await sharp(storedBuffer).metadata();

    if (
      metadata.format !== "jpeg" ||
      !metadata.width ||
      !metadata.height
    ) {
      throw new Error(
        "The stored photo could not be verified as a JPEG."
      );
    }
  } catch (error) {
    await supabaseAdmin.storage
      .from("guest-photos")
      .remove([storagePath]);

    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const file = formData.get("photo");
    const eventSlug =
      String(formData.get("eventSlug") ?? "big-iron").trim() ||
      "big-iron";
    const deviceId =
      String(formData.get("deviceId") ?? "").trim() || null;

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
            "The browser did not send the complete image. Please choose the photo again.",
        },
        { status: 400 }
      );
    }

    const jpegBuffer =
      await makeBrowserSafeJpeg(sourceBuffer);

    const photoId = randomUUID();
    const storagePath = `${eventSlug}/${photoId}.jpg`;

    await uploadAndVerify(storagePath, jpegBuffer);

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage
      .from("guest-photos")
      .getPublicUrl(storagePath);

    const { data: photoRecord, error: insertError } =
      await supabaseAdmin
        .from("guest_photos")
        .insert({
          event_slug: eventSlug,
          storage_path: storagePath,
          image_url: publicUrl,
          status: "pending",
          device_id: deviceId,
          original_filename: file.name || null,
          mime_type: "image/jpeg",
          file_size_bytes: jpegBuffer.length,
        })
        .select(
          `
            id,
            event_slug,
            image_url,
            status,
            created_at
          `
        )
        .single();

    if (insertError) {
      await supabaseAdmin.storage
        .from("guest-photos")
        .remove([storagePath]);

      throw new Error(insertError.message);
    }

    return NextResponse.json({
      success: true,
      photo: photoRecord,
      message:
        "Thanks! Your photo has been submitted for approval.",
    });
  } catch (error) {
    console.error("Guest photo upload failed:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to upload the photo.";

    const isProcessingError =
      message.includes("could not be processed") ||
      message.includes("browser did not send");

    return NextResponse.json(
      { error: message },
      { status: isProcessingError ? 400 : 500 }
    );
  }
}
