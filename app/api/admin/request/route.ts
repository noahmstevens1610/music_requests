import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type RequestStatus =
  | "pending"
  | "approved"
  | "added"
  | "played"
  | "removed";

const allowedStatuses: RequestStatus[] = [
  "pending",
  "approved",
  "added",
  "played",
  "removed",
];

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const requestId =
      typeof body.requestId === "string"
        ? body.requestId.trim()
        : "";

    const status = body.status as RequestStatus;

    if (!requestId) {
      return NextResponse.json(
        { error: "Missing requestId." },
        { status: 400 }
      );
    }

    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid request status." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("requests")
      .update({ status })
      .eq("id", requestId)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Song request was not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      request: data,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400 }
    );
  }
}