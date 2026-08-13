import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const SETTINGS_ID = "photo_slideshow_settings";
const MIN_DURATION_SECONDS = 2;
const MAX_DURATION_SECONDS = 60;

const DEFAULT_SETTINGS = {
  houseDurationSeconds: 7,
  guestDurationSeconds: 7,
};

type PhotoSlideshowSettings = typeof DEFAULT_SETTINGS;

function clampDuration(value: unknown, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(
    MAX_DURATION_SECONDS,
    Math.max(MIN_DURATION_SECONDS, Math.round(parsed))
  );
}

function normalizeSettings(value: unknown): PhotoSlideshowSettings {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    houseDurationSeconds: clampDuration(
      raw.houseDurationSeconds,
      DEFAULT_SETTINGS.houseDurationSeconds
    ),
    guestDurationSeconds: clampDuration(
      raw.guestDurationSeconds,
      DEFAULT_SETTINGS.guestDurationSeconds
    ),
  };
}

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
  const sessionCookie =
    cookieStore.get("big_iron_admin_session")?.value;

  if (!sessionCookie) return false;

  return sessionCookie === (await createSessionToken(sessionSecret));
}

async function loadSettings(): Promise<PhotoSlideshowSettings> {
  const { data, error } = await supabaseAdmin
    .from("site_content")
    .select("content")
    .eq("id", SETTINGS_ID)
    .maybeSingle();

  if (error) {
    console.error("Unable to load photo slideshow settings:", error.message);
    return DEFAULT_SETTINGS;
  }

  return normalizeSettings(data?.content);
}

export async function GET() {
  const settings = await loadSettings();

  return NextResponse.json(
    { settings },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}

export async function PUT(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;

  try {
    const parsed = await request.json();
    body =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const current = await loadSettings();

  const settings: PhotoSlideshowSettings = {
    houseDurationSeconds:
      body.houseDurationSeconds === undefined
        ? current.houseDurationSeconds
        : clampDuration(
            body.houseDurationSeconds,
            current.houseDurationSeconds
          ),
    guestDurationSeconds:
      body.guestDurationSeconds === undefined
        ? current.guestDurationSeconds
        : clampDuration(
            body.guestDurationSeconds,
            current.guestDurationSeconds
          ),
  };

  const { error } = await supabaseAdmin
    .from("site_content")
    .upsert(
      {
        id: SETTINGS_ID,
        content: settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) {
    return NextResponse.json(
      {
        error: "Unable to save photo slideshow settings.",
        details: error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: "Photo timing saved.",
    settings,
  });
}
