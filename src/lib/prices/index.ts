import "server-only";
import { BinanceProvider } from "@/lib/prices/providers/binance-provider";
import { TwelveDataProvider } from "@/lib/prices/providers/twelve-data-provider";
import { MockPriceProvider } from "@/lib/prices/providers/mock-provider";
import type { PriceProvider } from "@/lib/prices/types";

/**
 * Providers are tried in order; the first one whose `supports()` matches the
 * asset type is used. Add a new source (e.g. Financial Modeling Prep) by
 * pushing another provider here — nothing else needs to change.
 */
export function getPriceProviders(): PriceProvider[] {
  const providers: PriceProvider[] = [new BinanceProvider()];

  if (process.env.TWELVE_DATA_API_KEY) {
    providers.push(new TwelveDataProvider(process.env.TWELVE_DATA_API_KEY));
  } else {
    // No real stock provider configured yet — fall back to the mock so
    // the ingestion pipeline and downstream features stay testable locally.
    providers.push(new MockPriceProvider());
  }

  return providers;
}
