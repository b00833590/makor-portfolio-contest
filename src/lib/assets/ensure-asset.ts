import "server-only";
import { db } from "@/lib/db";
import { AssetType } from "@/generated/prisma/enums";
import type { Asset } from "@/generated/prisma/client";
import { refreshAssetPriceIfStale } from "@/lib/prices/pull-through";

export interface AssetCandidate {
  symbol: string;
  name: string;
  type: AssetType;
  externalId?: string;
  currency?: string;
  logoUrl?: string;
}

export type EnsureAssetResult = { ok: true; asset: Asset } | { ok: false; error: string };

/**
 * `logoUrl` arrive tel quel depuis un formulaire (recherche de ticker côté
 * participant, ou saisie admin) et est ensuite affiché sans échappement en
 * `<img src>` pour TOUS les participants dès que quelqu'un détient cet actif
 * (voir asset-logo.tsx) — jamais uniquement pour celui qui l'a acheté. Sans
 * cette vérification, n'importe qui pourrait persister une URL de tracking
 * ou de contenu arbitraire vue par tout le monde. On n'autorise donc que les
 * hébergeurs de logos réellement utilisés par nos fournisseurs de recherche
 * (voir src/lib/assets/search-providers.ts) ; toute autre valeur est ignorée
 * (l'actif est quand même créé, juste sans logo) plutôt que de bloquer l'achat.
 */
const TRUSTED_LOGO_HOSTS = ["images.financialmodelingprep.com", "coingecko.com"];

function sanitizeLogoUrl(logoUrl: string | undefined): string | undefined {
  if (!logoUrl) return undefined;
  try {
    const parsed = new URL(logoUrl);
    const isTrusted =
      parsed.protocol === "https:" &&
      TRUSTED_LOGO_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
    return isTrusted ? logoUrl : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Récupère l'actif correspondant au ticker, ou le crée s'il n'existe pas
 * encore — sans toucher aux prix. Utilisé pour la correction manuelle admin
 * (le prix historique est saisi directement, pas rafraîchi depuis l'API).
 *
 * Le nombre maximal de cryptomonnaies qu'un participant peut détenir
 * simultanément (règlement, docs/CONCEPTION.md §6) est une règle de
 * PORTEFEUILLE, pas de catalogue — elle est appliquée une seule fois, au
 * moment de l'ordre, par checkCryptoPositionLimit dans
 * src/lib/trading/rules-engine.ts (qui compte les positions ouvertes du
 * participant, pas les actifs du catalogue). Ajouter le même genre de
 * vérification ici bloquerait à tort l'ajout au catalogue d'une crypto que
 * personne ne détient encore.
 */
export async function ensureAssetExists(candidate: AssetCandidate): Promise<EnsureAssetResult> {
  const symbol = candidate.symbol.trim().toUpperCase();

  let asset = await db.asset.findUnique({ where: { symbol } });

  if (!asset) {
    asset = await db.asset.create({
      data: {
        symbol,
        name: candidate.name,
        type: candidate.type,
        currency: candidate.currency ?? "EUR",
        externalId: candidate.externalId,
        logoUrl: sanitizeLogoUrl(candidate.logoUrl),
      },
    });
  }

  return { ok: true, asset };
}

/**
 * Récupère l'actif correspondant au ticker choisi dans la recherche, ou le
 * crée à la volée s'il n'existe pas encore. Rafraîchit toujours le prix pour
 * qu'un achat juste après création dispose d'une cotation valide.
 */
export async function ensureAssetForPurchase(candidate: AssetCandidate): Promise<EnsureAssetResult> {
  const result = await ensureAssetExists(candidate);
  if (!result.ok) return result;
  const { asset } = result;

  if (!asset.isActive) {
    return { ok: false, error: "Cet actif n'est plus disponible à l'achat." };
  }

  await refreshAssetPriceIfStale(asset);

  const hasPrice = await db.price.findFirst({ where: { assetId: asset.id } });
  if (!hasPrice) {
    return { ok: false, error: "Impossible de récupérer une cotation pour cet actif pour le moment. Réessayez plus tard." };
  }

  return { ok: true, asset };
}
