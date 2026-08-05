import "server-only";
import { BinanceProvider } from "@/lib/prices/providers/binance-provider";
import { TwelveDataProvider } from "@/lib/prices/providers/twelve-data-provider";
import { YahooProvider } from "@/lib/prices/providers/yahoo-provider";
import { MockPriceProvider } from "@/lib/prices/providers/mock-provider";
import type { PriceProvider } from "@/lib/prices/types";

/**
 * Providers are tried in order; the first one whose `supports()` matches the
 * asset is used. Add a new source by pushing another provider here —
 * nothing else needs to change.
 *
 * Stocks split by market rather than a single source: Twelve Data's free
 * plan only covers US exchanges, so non-US listings (externalId = mic_code,
 * see search-providers.ts) go to YahooProvider instead — each provider's
 * `supports()` is mutually exclusive on that, not just array order.
 */
export function getPriceProviders(): PriceProvider[] {
  const providers: PriceProvider[] = [new BinanceProvider(), new YahooProvider()];

  if (process.env.TWELVE_DATA_API_KEY) {
    providers.push(new TwelveDataProvider(process.env.TWELVE_DATA_API_KEY));
  } else {
    // No real stock provider configured yet — fall back to the mock so
    // the ingestion pipeline and downstream features stay testable locally.
    providers.push(new MockPriceProvider());
  }

  return providers;
}
