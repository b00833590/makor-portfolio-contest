import { NextResponse, type NextRequest } from "next/server";
import { ingestAssetPrices } from "@/lib/prices/ingest";
import { getPriceProviders } from "@/lib/prices";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // Un CRON_SECRET absent est acceptable en local (voir .env.example) mais
    // laisserait cet endpoint totalement ouvert en production, où il n'est
    // couvert par aucune protection de src/proxy.ts (matcher exclut /api) —
    // n'importe qui pourrait le spammer pour épuiser le quota de l'API de
    // prix ou forcer des écritures. On refuse plutôt que d'ouvrir par défaut.
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "CRON_SECRET n'est pas configuré." }, { status: 503 });
    }
  } else {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const results = await ingestAssetPrices(getPriceProviders());
  return NextResponse.json({ results });
}
