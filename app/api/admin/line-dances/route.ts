import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function createSessionToken(
  secret: string
): Promise<string> {
  const encodedSecret =
    new TextEncoder().encode(secret);

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      encodedSecret
    );

  return Array.from(
    new Uint8Array(digest)
  )
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}

async function isAuthenticated() {
  const sessionSecret =
    process.env.ADMIN_SESSION_SECRET;

  if (!sessionSecret) {
    return false;
  }

  const cookieStore = await cookies();

  const savedToken =
    cookieStore.get(
      "big_iron_admin_session"
    )?.value;

  if (!savedToken) {
    return false;
  }

  const expectedToken =
    await createSessionToken(
      sessionSecret
    );

  return savedToken === expectedToken;
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  const { data, error } =
    await supabaseAdmin
      .from("line_dances")
      .select("*")
      .order("name", {
        ascending: true,
      });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    lineDances: data ?? [],
  });
}

export async function POST(
  request: NextRequest
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  let body: {
    name?: string;
    alsoKnownAs?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const name = body.name?.trim();

  const alsoKnownAs =
    body.alsoKnownAs
      ?.split(",")
      .map((alternateName) =>
        alternateName.trim()
      )
      .filter(Boolean)
      .join(", ") || null;

  if (!name) {
    return NextResponse.json(
      {
        error:
          "Dance name is required.",
      },
      { status: 400 }
    );
  }

  const { data, error } =
    await supabaseAdmin
      .from("line_dances")
      .insert({
        name,
        also_known_as:
          alsoKnownAs,
      })
      .select()
      .single();

  if (error) {
    const duplicate =
      error.code === "23505";

    return NextResponse.json(
      {
        error: duplicate
          ? "A line dance with that name already exists."
          : error.message,
      },
      {
        status: duplicate
          ? 409
          : 500,
      }
    );
  }

  return NextResponse.json(
    {
      lineDance: data,
    },
    { status: 201 }
  );
}

export async function DELETE(
  request: NextRequest
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  let body: {
    lineDanceId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const lineDanceId =
    body.lineDanceId?.trim();

  if (!lineDanceId) {
    return NextResponse.json(
      {
        error:
          "Line dance ID is required.",
      },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("line_dances")
    .delete()
    .eq("id", lineDanceId);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
  });
}