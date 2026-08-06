import { AssetType } from "@/generated/prisma/enums";
import type { Asset } from "@/generated/prisma/client";
import type { FetchedPrice, PriceProvider } from "@/lib/prices/types";

/**
 * Suffixe de bourse (convention Yahoo, déjà utilisée pour tous les tickers stockés — voir
 * yahoo-provider.ts) -> préfixe d'échange TradingView. Couvre les bourses européennes
 * actuellement suivies par ce concours ; à étendre si un nouveau suffixe apparaît.
 */
const EXCHANGE_SUFFIX_TO_TRADINGVIEW: Record<string, string> = {
  ".PA": "EURONEXT",
  ".AS": "EURONEXT",
  ".DE": "XETR",
  ".L": "LSE",
  ".SW": "SIX",
  ".ST": "OMXSTO",
};

/**
 * Quelques tickers LSE ont un vrai ticker se terminant par un point (ex. BAE Systems : "BA."),
 * que Yahoo stocke sans ce point final (symbole stocké ici : "BA.L", pas "BA..L") mais que
 * TradingView exige explicitement ("LSE:BA.", "LSE:BA" seul ne résout à rien — vérifié en
 * direct, pas déductible de la convention générale de suffixe). Table volontairement limitée aux
 * cas confirmés plutôt qu'une règle générale non vérifiée pour les autres tickers LSE.
 */
const TRADINGVIEW_SYMBOL_OVERRIDES: Record<string, string> = {
  "BA.L": "LSE:BA.",
};

/**
 * Convertit un symbole stocké au format Yahoo (ex. "MC.PA", "BA.L", "SECT-B.ST") vers le format
 * `EXCHANGE:TICKER` attendu par le scanner TradingView (ex. "EURONEXT:MC", "LSE:BA.",
 * "OMXSTO:SECT_B") — `null` si le suffixe n'est pas dans la table de correspondance ci-dessus.
 *
 * Particularité vérifiée en direct, pas déduite de la documentation (TradingView n'en publie pas
 * pour cet endpoint) : un tiret avant le suffixe (classe d'action, ex. Stockholm "SECT-B") doit
 * être remplacé par un underscore pour OMXSTO — "SECT-B.ST" -> "OMXSTO:SECT_B", pas
 * "OMXSTO:SECT-B" (ne résout pas). Voir aussi TRADINGVIEW_SYMBOL_OVERRIDES pour les tickers LSE
 * à point final.
 */
export function toTradingViewSymbol(yahooSymbol: string): string | null {
  if (yahooSymbol in TRADINGVIEW_SYMBOL_OVERRIDES) return TRADINGVIEW_SYMBOL_OVERRIDES[yahooSymbol];

  for (const [suffix, exchange] of Object.entries(EXCHANGE_SUFFIX_TO_TRADINGVIEW)) {
    if (!yahooSymbol.endsWith(suffix)) continue;
    const base = yahooSymbol.slice(0, -suffix.length);
    if (base.length === 0) return null;
    const ticker = exchange === "OMXSTO" ? base.replace(/-/g, "_") : base;
    return `${exchange}:${ticker}`;
  }
  return null;
}

interface TradingViewScanResponse {
  data?: { s: string; d: unknown[] }[];
}

/**
 * Repli non officiel pour les tickers à suffixe de bourse (essentiellement européens) que
 * Twelve Data ne sait pas résoudre sur son plan gratuit — voir twelve-data-provider.ts, dont le
 * plan gratuit exclut explicitement les marchés hors US (vérifié sur leur page tarifaire, pas
 * seulement supposé). Endpoint de scanner interne de TradingView, non documenté publiquement et
 * sans clé — même catégorie de risque que Yahoo (peut changer sans préavis, voir
 * yahoo-provider.ts) : ni Financial Modeling Prep ni Twelve Data ne donnent accès aux bourses
 * européennes sur leur plan gratuit (vérifié en direct le 2026-08-06, pas seulement dans leur
 * documentation marketing), donc pas d'alternative "officielle" gratuite trouvée à ce jour.
 *
 * Vérifié en direct le 2026-08-06 : donne des cotations à jour (mode "delayed_streaming_900",
 * soit 15 minutes de délai — standard pour un flux gratuit — ou "streaming" pour certains
 * titres) sur Euronext, Xetra, LSE, SIX et Stockholm, précisément pendant que le flux Yahoo pour
 * ces mêmes titres était figé depuis plus de 7h (voir isStaleDuringMarketHours dans
 * yahoo-provider.ts).
 */
export class TradingViewProvider implements PriceProvider {
  readonly source = "tradingview";

  supports(asset: Pick<Asset, "type" | "symbol">): boolean {
    return asset.type === AssetType.STOCK && toTradingViewSymbol(asset.symbol) !== null;
  }

  async fetchPrice(asset: Pick<Asset, "symbol">): Promise<FetchedPrice | null> {
    const symbol = toTradingViewSymbol(asset.symbol);
    if (!symbol) return null;

    const response = await fetch("https://scanner.tradingview.com/global/scan", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols: { tickers: [symbol] }, columns: ["close"] }),
    });
    if (!response.ok) {
      console.error(`[ingest:tradingview] ${asset.symbol}: HTTP ${response.status} — ${await response.text()}`);
      return null;
    }

    const body = (await response.json()) as TradingViewScanResponse;
    const price = body.data?.[0]?.d?.[0];
    if (typeof price !== "number" || !Number.isFinite(price)) {
      console.error(`[ingest:tradingview] ${asset.symbol}: pas de cotation dans la réponse (symbole "${symbol}" introuvable ?)`);
      return null;
    }

    // Le scanner ne renvoie pas d'horodatage exploitable par titre — le délai de 15 minutes
    // annoncé par TradingView ("delayed_streaming_900") n'est pas assez précis pour reconstruire
    // un horodatage fiable, donc on utilise l'instant de la requête comme pour Twelve Data (voir
    // twelve-data-provider.ts), qui a la même limitation.
    return { price, timestamp: new Date(), source: this.source };
  }
}
