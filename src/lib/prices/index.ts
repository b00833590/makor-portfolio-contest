import "server-only";
import { BinanceProvider } from "@/lib/prices/providers/binance-provider";
import { TwelveDataProvider } from "@/lib/prices/providers/twelve-data-provider";
import { YahooProvider } from "@/lib/prices/providers/yahoo-provider";
import { MockPriceProvider } from "@/lib/prices/providers/mock-provider";
import type { PriceProvider } from "@/lib/prices/types";

/**
 * Order matters: callers try each supporting provider in turn until one
 * succeeds (see provider-fallback.ts), not just the first match. For
 * stocks, Yahoo goes first (primary — see yahoo-provider.ts for why Twelve
 * Data can't hold that role), Twelve Data second as a fallback limited to
 * US-shaped symbols (see twelve-data-provider.ts). Add a new source by
 * pushing another provider here in the right position — nothing else needs
 * to change.
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
