import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: "Song metadata route working",
  });
}

export async function PATCH(request: NextRequest) {
  return NextResponse.json({
    success: true,
  });
}