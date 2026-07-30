import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  defaultSiteContent,
  normalizeSiteContent,
} from "@/lib/site-content";

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

  if (!sessionSecret) {
    return false;
  }

  const cookieStore = await cookies();
  const sessionCookie =
    cookieStore.get("big_iron_admin_session")?.value;

  if (!sessionCookie) {
    return false;
  }

  const expectedToken = await createSessionToken(sessionSecret);
  return sessionCookie === expectedToken;
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("site_content")
    .select("content, updated_at")
    .eq("id", "homepage")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      {
        error:
          "Unable to load the site editor. Make sure the site_content SQL has been run in Supabase.",
        details: error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    content: data?.content
      ? normalizeSiteContent(data.content)
      : defaultSiteContent,
    updatedAt: data?.updated_at ?? null,
  });
}

export async function PUT(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  let body: { content?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const content = normalizeSiteContent(body.content);
  const updatedAt = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("site_content")
    .upsert(
      {
        id: "homepage",
        content,
        updated_at: updatedAt,
      },
      { onConflict: "id" }
    )
    .select("content, updated_at")
    .single();

  if (error) {
    return NextResponse.json(
      {
        error:
          "Unable to save the website. Make sure the site_content SQL has been run in Supabase.",
        details: error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: "Website saved.",
    content: normalizeSiteContent(data.content),
    updatedAt: data.updated_at,
  });
}
