import { NextResponse, type NextRequest } from "next/server";
import { snapshotActivePromotions } from "@/lib/trading/snapshot-service";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const results = await snapshotActivePromotions();
  return NextResponse.json({ results });
}
