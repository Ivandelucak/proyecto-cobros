import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Simple light query to verify database connectivity
    await prisma.$queryRaw`SELECT 1`;
    
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "up"
    }, {
      status: 200,
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    console.error("Healthcheck database connectivity error:", error);
    
    return NextResponse.json({
      status: "error",
      timestamp: new Date().toISOString(),
      database: "down"
    }, {
      status: 500,
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  }
}
