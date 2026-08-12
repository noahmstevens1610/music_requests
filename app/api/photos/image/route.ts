import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(request: NextRequest) {
  try {
    const photoId =
      request.nextUrl.searchParams.get("photoId")?.trim() ?? "";

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
      throw new Error(lookupError.message);
    }

    if (!photo) {
      return NextResponse.json(
        { error: "Photo not found." },
        { status: 404 }
      );
    }

    if (
      photo.status !== "approved" &&
      !(await isAuthenticated())
    ) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const { data: storedFile, error: downloadError } =
      await supabaseAdmin.storage
        .from("guest-photos")
        .download(photo.storage_path);

    if (downloadError || !storedFile) {
      console.error(
        "Photo storage download failed:",
        photo.storage_path,
        downloadError?.message ?? "No file returned."
      );

      return NextResponse.json(
        {
          error:
            "The photo record exists, but the stored image could not be loaded.",
        },
        { status: 404 }
      );
    }

    const sourceBuffer = Buffer.from(
      await storedFile.arrayBuffer()
    );

    if (sourceBuffer.length === 0) {
      return NextResponse.json(
        { error: "The stored photo is empty." },
        { status: 422 }
      );
    }

    // Always normalize the stored file to a browser-safe JPEG before
    // sending it. This avoids mismatched MIME types, HEIC/HEIF browser
    // support problems, and any storage metadata inconsistencies.
    let browserSafeImage: Buffer;

    try {
      browserSafeImage = await sharp(sourceBuffer, {
        failOn: "none",
      })
        .rotate()
        .jpeg({
          quality: 90,
          mozjpeg: true,
        })
        .toBuffer();
    } catch (decodeError) {
      console.error(
        "Stored photo could not be decoded:",
        photo.storage_path,
        decodeError
      );

      return NextResponse.json(
        {
          error:
            "The stored file could not be decoded as an image. Please remove it and upload the photo again.",
        },
        { status: 422 }
      );
    }

    const responseBody = Uint8Array.from(browserSafeImage).buffer;

    return new Response(responseBody, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(browserSafeImage.length),
        "Cache-Control":
          photo.status === "approved"
            ? "public, max-age=300, s-maxage=300"
            : "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Photo image route failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load the photo.",
      },
      { status: 500 }
    );
  }
}
