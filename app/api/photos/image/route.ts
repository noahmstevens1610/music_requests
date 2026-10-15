import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/admin-session";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


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
      !(await getSession(request))
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

    // Uploads are already normalized to browser-safe JPEG. Serve bytes directly
    // so previewing a photo does not require native Sharp/libvips at runtime.
    const mime = storedFile.type?.startsWith("image/")
      ? storedFile.type
      : "image/jpeg";

    return new Response(new Uint8Array(sourceBuffer), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(sourceBuffer.length),
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
