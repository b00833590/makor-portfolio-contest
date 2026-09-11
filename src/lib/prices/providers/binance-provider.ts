import { AssetType } from "@/generated/prisma/enums";
import type { Asset } from "@/generated/prisma/client";
import type { FetchedPrice, HistoryPoint, HistoryRequest, PriceProvider } from "@/lib/prices/types";

type BinanceKline = [number, string, string, string, string, string, number, ...unknown[]];

/** Klines Binance les plus fines capables de couvrir `days` en <= 1000 points (max de l'API publique). */
function resolveInterval(request: HistoryRequest): { interval: string; limit: number } {
  if (request.interval === "auto") {
    if (request.days <= 1) return { interval: "5m", limit: 288 };
    if (request.days <= 7) return { interval: "1h", limit: 168 };
    return { interval: "1d", limit: Math.min(Math.ceil(request.days) + 2, 1000) };
  }
  if (request.interval === "5min") return { interval: "5m", limit: 288 };
  if (request.interval === "1h") return { interval: "1h", limit: 168 };
  return { interval: "1d", limit: Math.min(Math.ceil(request.days) + 2, 1000) };
}

/** Actif-pont utilisé quand la paire directe `<SYMBOL><CURRENCY>` n'existe pas sur Binance
 * (voir {@link resolveBridgedPrice}) — USDT est coté contre à peu près tout sur Binance. */
const BRIDGE_ASSET = "USDT";

/**
 * Combine jusqu'à 3 cotations Binance (déjà récupérées) en un prix dans la devise du
 * portefeuille — pure, donc testable sans mock réseau.
 *
 * - Paire directe dispo (`directPrice`, ex. BTCEUR) : utilisée telle quelle, c'est le cas
 *   normal pour la plupart des cryptos.
 * - Sinon, on passe par l'actif-pont ({@link BRIDGE_ASSET}) : de nombreux stablecoins
 *   (USDT, USDC…) n'ont PAS de paire directe contre l'EUR sur Binance (`USDTEUR`,
 *   `USDCEUR` répondent HTTP 400 — vérifié sur l'API publique), alors que `<SYMBOL>USDT`
 *   et `<CURRENCY>USDT` existent quasiment toujours.
 *   - Si l'actif à prix est lui-même le pont (ex. USDT priced en EUR), `assetInBridge`
 *     vaut trivialement 1 (une paire "USDTUSDT" n'existe pas et n'a pas de sens).
 *   - Sinon `assetInBridge` = cours de l'actif en USDT (ex. BTCUSDT).
 *   - `currencyInBridge` = cours de la devise cible en USDT (ex. EURUSDT).
 *   - Prix final = assetInBridge / currencyInBridge (USDT/actif ÷ USDT/devise = devise/actif).
 */
export function resolveBridgedPrice(params: {
  symbol: string;
  currency: string;
  directPrice: number | null;
  assetInBridge: number | null;
  currencyInBridge: number | null;
}): number | null {
  const { symbol, currency, directPrice, assetInBridge, currencyInBridge } = params;

  if (directPrice != null) return directPrice;
  if (currencyInBridge == null || currencyInBridge === 0) return null;

  const isAssetTheBridge = symbol.toUpperCase() === BRIDGE_ASSET;
  const assetInBridgeResolved = isAssetTheBridge ? 1 : assetInBridge;
  if (assetInBridgeResolved == null) return null;

  return assetInBridgeResolved / currencyInBridge;
}

/**
 * Binance, marché public — aucune clé requise, aucun quota significatif pour
 * notre usage. Remplace CoinGecko comme fournisseur de PRIX pour la crypto
 * (CoinGecko reste utilisé pour la RECHERCHE de tickers dans
 * src/lib/assets/search-providers.ts, qui a besoin du nom/logo/rang par
 * capitalisation que Binance ne fournit pas). C'est ce qui permet un
 * rafraîchissement quasi temps réel de la seule crypto active à la fois
 * autorisée par le règlement (docs/CONCEPTION.md section 6) — voir
 * src/lib/prices/staleness.ts pour le seuil de péremption appliqué.
 *
 * https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints
 */
export class BinanceProvider implements PriceProvider {
  readonly source = "binance";

  supports(asset: Pick<Asset, "type">): boolean {
    return asset.type === AssetType.CRYPTO;
  }

  private pairSymbol(asset: Pick<Asset, "symbol" | "currency">): string {
    return `${asset.symbol}${asset.currency}`.toUpperCase();
  }

  /** Cours brut d'une paire Binance, ou `null` si la paire n'existe pas (HTTP 400) ou en cas d'erreur réseau. */
  private async fetchTickerPrice(pairSymbol: string): Promise<number | null> {
    const url = `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(pairSymbol)}`;

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      // Binance renvoie 400 pour un symbole inexistant (ex. USDTEUR) — attendu pour les
      // paires-pont, ne pas polluer les logs avec ce qui n'est pas une vraie erreur.
      if (response.status !== 400) {
        console.error(`[ingest:binance] ${pairSymbol}: HTTP ${response.status} — ${await response.text()}`);
      }
      return null;
    }

    const body = (await response.json()) as { price?: string };
    if (!body.price) return null;

    const price = Number(body.price);
    return Number.isFinite(price) ? price : null;
  }

  async fetchPrice(asset: Pick<Asset, "symbol" | "currency" | "externalId">): Promise<FetchedPrice | null> {
    const symbol = asset.symbol.toUpperCase();
    const currency = asset.currency.toUpperCase();

    const directPrice = await this.fetchTickerPrice(this.pairSymbol(asset));

    let price: number | null;
    if (directPrice != null) {
      price = directPrice;
    } else {
      const isAssetTheBridge = symbol === BRIDGE_ASSET;
      const [assetInBridge, currencyInBridge] = await Promise.all([
        isAssetTheBridge ? Promise.resolve(null) : this.fetchTickerPrice(`${symbol}${BRIDGE_ASSET}`),
        this.fetchTickerPrice(`${currency}${BRIDGE_ASSET}`),
      ]);
      price = resolveBridgedPrice({ symbol, currency, directPrice: null, assetInBridge, currencyInBridge });
    }

    if (price == null) return null;
    return { price, timestamp: new Date(), source: this.source };
  }

  /**
   * Contrairement à {@link fetchPrice}, ne passe pas par l'actif-pont quand la paire directe
   * manque (ex. USDT) — renvoie `null` dans ce cas. Non bloquant : `getAssetPriceHistory`
   * retombe alors sur l'historique accumulé en base (voir get-asset-price-history.ts), donc
   * seul le graphique perd en granularité, l'achat/la vente ne sont jamais affectés.
   */
  async fetchHistory(
    asset: Pick<Asset, "symbol" | "currency" | "externalId">,
    request: HistoryRequest,
  ): Promise<HistoryPoint[] | null> {
    const { interval, limit } = resolveInterval(request);
    const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(this.pairSymbol(asset))}&interval=${interval}&limit=${limit}`;

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;

    const body: unknown = await response.json();
    if (!Array.isArray(body)) return null;

    return (body as BinanceKline[])
      .map(([, , , , close, , closeTime]) => ({ timestamp: new Date(closeTime), price: Number(close) }))
      .filter((point) => Number.isFinite(point.price))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
}
