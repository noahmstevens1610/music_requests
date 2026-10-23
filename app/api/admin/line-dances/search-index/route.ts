import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/admin-session";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  if (!(await getSession(request))) {
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