import {
  NextRequest,
  NextResponse,
} from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

function cleanAlternateNames(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleanedNames = value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  return cleanedNames.length > 0
    ? cleanedNames.join(", ")
    : null;
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
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

  const { id: lineDanceId } =
    await context.params;

  if (!lineDanceId?.trim()) {
    return NextResponse.json(
      {
        error:
          "Line dance ID is required.",
      },
      {
        status: 400,
      }
    );
  }

  let body: {
    name?: unknown;
    alsoKnownAs?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "Invalid request body.",
      },
      {
        status: 400,
      }
    );
  }

  const name =
    typeof body.name === "string"
      ? body.name.trim()
      : "";

  if (!name) {
    return NextResponse.json(
      {
        error:
          "Choreography name is required.",
      },
      {
        status: 400,
      }
    );
  }

  const alsoKnownAs =
    cleanAlternateNames(
      body.alsoKnownAs
    );

  const {
    data: lineDance,
    error: updateError,
  } = await supabaseAdmin
    .from("line_dances")
    .update({
      name,
      also_known_as: alsoKnownAs,
    })
    .eq("id", lineDanceId)
    .select("*")
    .maybeSingle();

  if (updateError) {
    const duplicateName =
      updateError.code === "23505";

    return NextResponse.json(
      {
        error: duplicateName
          ? "A line dance with that name already exists."
          : updateError.message,
      },
      {
        status: duplicateName
          ? 409
          : 500,
      }
    );
  }

  if (!lineDance) {
    return NextResponse.json(
      {
        error: "Line dance not found.",
      },
      {
        status: 404,
      }
    );
  }

  return NextResponse.json({
    lineDance,
    message:
      "Line dance updated.",
  });
}