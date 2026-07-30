import { NextResponse } from "next/server";
import { checkDatabaseReadiness } from "@/lib/database-readiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const databaseReady = await checkDatabaseReadiness();

  return NextResponse.json(
    {
      status: databaseReady ? "ok" : "unavailable",
      service: "fox-point",
      database: databaseReady ? "up" : "down"
    },
    {
      status: databaseReady ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" }
    }
  );
}
