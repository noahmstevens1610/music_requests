import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { randomUUID } from "crypto";
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

function safeExtension(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
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

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Photo must be 10 MB or smaller." },
        { status: 400 }
      );
    }

    const sourceBuffer = Buffer.from(await file.arrayBuffer());

    let optimizedBuffer: Buffer;
    let outputMimeType: string;
    let extension: string;

    try {
      const optimized = await sharp(sourceBuffer, {
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
          quality: 84,
          mozjpeg: true,
        })
        .toBuffer();

      optimizedBuffer = optimized;
      outputMimeType = "image/jpeg";
      extension = "jpg";
    } catch {
      optimizedBuffer = sourceBuffer;
      outputMimeType = file.type;
      extension = safeExtension(file.type);
    }

    const photoId = randomUUID();
    const storagePath = `${eventSlug}/${photoId}.${extension}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("guest-photos")
      .upload(storagePath, optimizedBuffer, {
        contentType: outputMimeType,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

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
          mime_type: outputMimeType,
          file_size_bytes: optimizedBuffer.length,
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

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to upload the photo.",
      },
      { status: 500 }
    );
  }
}