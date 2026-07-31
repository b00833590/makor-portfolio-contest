import { NextResponse, type NextRequest } from "next/server";
import { ingestAssetPrices } from "@/lib/prices/ingest";
import { getPriceProviders } from "@/lib/prices";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const results = await ingestAssetPrices(getPriceProviders());
  return NextResponse.json({ results });
}
