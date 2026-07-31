"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Logo d'actif avec repli sur les initiales du ticker si l'image est absente ou en échec. */
export function AssetLogo({
  symbol,
  logoUrl,
  className,
}: {
  symbol: string;
  logoUrl: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!logoUrl || failed) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground",
          className,
        )}
      >
        {symbol.slice(0, 2)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- logo host is unpredictable (any ticker) and needs an onError fallback
    <img
      src={logoUrl}
      alt=""
      className={cn("shrink-0 rounded-full bg-muted object-contain", className)}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
