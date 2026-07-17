import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

type RequestType = "swing" | "line_dance";
type RequestStatus = "pending" | "approved" | "added" | "played" | "removed";

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
  const sessionCookie = cookieStore.get("big_iron_admin_session")?.value;

  if (!sessionCookie) {
    return false;
  }

  const expectedToken = await createSessionToken(sessionSecret);
  return sessionCookie === expectedToken;
}

export async function PATCH(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  let body: {
    requestId?: string;
    status?: RequestStatus;
    requestType?: RequestType;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const requestId = body.requestId?.trim();

  if (!requestId) {
    return NextResponse.json(
      { error: "Request ID is required." },
      { status: 400 }
    );
  }

  const updates: {
    status?: RequestStatus;
    request_type?: RequestType;
  } = {};

  if (body.status) {
    const allowedStatuses: RequestStatus[] = [
      "pending",
      "approved",
      "added",
      "played",
      "removed",
    ];

    if (!allowedStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: "Invalid request status." },
        { status: 400 }
      );
    }

    updates.status = body.status;
  }

  if (body.requestType) {
    if (
      body.requestType !== "swing" &&
      body.requestType !== "line_dance"
    ) {
      return NextResponse.json(
        { error: "Invalid request type." },
        { status: 400 }
      );
    }

    updates.request_type = body.requestType;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No changes were supplied." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("requests")
    .update(updates)
    .eq("id", requestId)
    .select(
      "id, status, request_type, spotify_track_id, track_name, artist_name"
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: `Unable to update request: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: "Request updated.",
    request: data,
  });
}