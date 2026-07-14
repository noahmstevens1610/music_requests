import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("events")
    .select("*");

  return NextResponse.json({
    success: !error,
    error,
    data,
  });
}