/**
 * Twelve Data returns every exchange listing for a ticker, and the same raw
 * symbol can legitimately refer to two unrelated companies on different
 * markets (e.g. "MC" is both LVMH on Euronext Paris and Moelis & Company on
 * the NYSE). Storing the raw ticker alone as the catalog symbol would let one
 * silently shadow the other. Non-US listings get a market suffix (the same
 * convention as Yahoo/Google Finance — ".PA", ".DE", ".L"...) so the catalog
 * symbol stays globally unambiguous without changing the database's existing
 * unique-by-symbol constraint. US listings keep their plain ticker (no
 * suffix) to match every asset already in the catalog today.
 */
const MIC_CODE_SUFFIXES: Record<string, string> = {
  XPAR: ".PA", // Euronext Paris
  XAMS: ".AS", // Euronext Amsterdam
  XBRU: ".BR", // Euronext Brussels
  XLIS: ".LS", // Euronext Lisbon
  XETR: ".DE", // Deutsche Börse Xetra
  XLON: ".L", // London Stock Exchange
  XSWX: ".SW", // SIX Swiss Exchange
  XMIL: ".MI", // Borsa Italiana
  XSTO: ".ST", // Nasdaq Stockholm
  XCSE: ".CO", // Nasdaq Copenhagen
  XHEL: ".HE", // Nasdaq Helsinki
  XOSL: ".OL", // Oslo Børs
};

/** Falls back to `.{micCode}` for exchanges outside the curated table, so any market stays representable. */
export function marketSuffixFor(micCode: string | null | undefined): string {
  if (!micCode) return "";
  return MIC_CODE_SUFFIXES[micCode] ?? `.${micCode}`;
}

/** Inverse of appending `marketSuffixFor(micCode)` — recovers the raw ticker Twelve Data expects for API calls. */
export function stripMarketSuffix(symbol: string, micCode: string | null | undefined): string {
  const suffix = marketSuffixFor(micCode);
  return suffix && symbol.endsWith(suffix) ? symbol.slice(0, -suffix.length) : symbol;
}
