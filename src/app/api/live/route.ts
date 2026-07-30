import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { status: "ok", service: "fox-point" },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
