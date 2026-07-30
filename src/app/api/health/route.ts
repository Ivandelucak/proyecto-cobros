import { NextResponse } from "next/server";
import { checkDatabaseReadiness } from "@/lib/database-readiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const databaseReady = await checkDatabaseReadiness();

  if (databaseReady) {
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "up"
    }, {
      status: 200,
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  }

  return NextResponse.json({
    status: "error",
    timestamp: new Date().toISOString(),
    database: "down"
  }, {
    status: 503,
    headers: { "Cache-Control": "no-store, max-age=0" }
  });
}
