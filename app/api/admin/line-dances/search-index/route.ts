import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function createSessionToken(
  secret: string
): Promise<string> {
  const encodedSecret = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encodedSecret
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function isAuthenticated(): Promise<boolean> {
  const sessionSecret =
    process.env.ADMIN_SESSION_SECRET;

  if (!sessionSecret) {
    return false;
  }

  const cookieStore = await cookies();
  const savedToken = cookieStore.get(
    "big_iron_admin_session"
  )?.value;

  if (!savedToken) {
    return false;
  }

  const expectedToken =
    await createSessionToken(sessionSecret);

  return savedToken === expectedToken;
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json(
      {
        error: "Unauthorized.",
      },
      {
        status: 401,
      }
    );
  }

  const { data: songs, error } =
    await supabaseAdmin
      .from("line_dance_songs")
      .select("line_dance_id, track_name")
      .order("track_name", {
        ascending: true,
      });

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    songs: songs ?? [],
  });
}