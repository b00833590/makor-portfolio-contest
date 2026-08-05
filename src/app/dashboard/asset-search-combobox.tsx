"use client";

import { useEffect, useRef, useState } from "react";
import {
  Combobox,
  ComboboxClear,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxIcon,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
} from "@/components/ui/combobox";
import type { AssetSearchResult } from "@/lib/assets/search-providers";
import { AssetLogo } from "./asset-logo";

const SEARCH_DEBOUNCE_MS = 300;

const typeLabels = { STOCK: "Action", CRYPTO: "Crypto" } as const;

/**
 * Recherche de tickers en direct (Twelve Data pour les actions, CoinGecko
 * pour la crypto) avec autocomplétion — remplace la liste figée d'actifs
 * pré-créés par l'admin (voir /api/assets/search).
 */
export function AssetSearchCombobox({
  onSelect,
  disabled,
}: {
  onSelect: (asset: AssetSearchResult | null) => void;
  disabled?: boolean;
}) {
  const [results, setResults] = useState<AssetSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  function handleInputValueChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();
    if (trimmed.length < 1) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(`/api/assets/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const body: unknown = await response.json();
        const list =
          body && typeof body === "object" && Array.isArray((body as { results?: unknown }).results)
            ? ((body as { results: AssetSearchResult[] }).results)
            : [];
        setResults(list);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  }

  return (
    <Combobox
      items={results}
      filter={null}
      disabled={disabled}
      itemToStringLabel={(item: AssetSearchResult) => `${item.symbol} — ${item.name}`}
      onInputValueChange={handleInputValueChange}
      onValueChange={(value) => onSelect(value as AssetSearchResult | null)}
    >
      <ComboboxInputGroup>
        <ComboboxInput placeholder="Rechercher un ticker (AAPL, BTC, IWDA...)" />
        {loading ? <ComboboxIcon loading /> : <ComboboxClear />}
      </ComboboxInputGroup>
      <ComboboxContent>
        <ComboboxEmpty>{loading ? "Recherche..." : "Aucun résultat."}</ComboboxEmpty>
        {results.map((item) => (
          <ComboboxItem key={item.symbol} value={item}>
            <AssetLogo symbol={item.symbol} logoUrl={item.logoUrl} className="size-6" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{item.symbol}</span>
              <span className="truncate text-xs text-muted-foreground">
                {item.name}
                {item.exchangeLabel && ` — ${item.exchangeLabel}`}
              </span>
            </span>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">{typeLabels[item.type]}</span>
          </ComboboxItem>
        ))}
      </ComboboxContent>
    </Combobox>
  );
}
