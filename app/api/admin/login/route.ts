import { NextRequest, NextResponse } from "next/server";

async function createSessionToken(secret: string): Promise<string> {
  const encodedSecret = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encodedSecret
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}

export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const sessionSecret =
    process.env.ADMIN_SESSION_SECRET;

  if (!adminPassword || !sessionSecret) {
    return NextResponse.json(
      {
        error:
          "Admin authentication is not configured.",
      },
      { status: 500 }
    );
  }

  let body: {
    password?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400 }
    );
  }

  if (body.password !== adminPassword) {
    return NextResponse.json(
      { error: "Incorrect password." },
      { status: 401 }
    );
  }

  const sessionToken =
    await createSessionToken(sessionSecret);

  const response = NextResponse.json({
    success: true,
  });

  response.cookies.set(
    "big_iron_admin_session",
    sessionToken,
    {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 60 * 60 * 12,
    }
  );

  return response;
}