import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Pas de nonce (voir node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md)
// pour rester sur du rendu statique/caché simple — 'unsafe-inline' sur les
// styles reste nécessaire pour Tailwind/shadcn qui injectent du CSS inline.
// img-src autorise https: + data: : logos de tickers (FMP/CoinGecko, voir
// src/lib/assets/ensure-asset.ts) et avatars stockés en data URL en base.
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
`
  .replace(/\s{2,}/g, " ")
  .trim();

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
