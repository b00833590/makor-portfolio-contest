import { z } from "zod";
import { AssetType } from "@/generated/prisma/enums";

export const amountOrderSchema = z.object({
  assetId: z.string().min(1, "Choisissez un actif"),
  amount: z.coerce.number().positive("Le montant doit être positif"),
});

/**
 * Achat dynamique : l'actif vient de la recherche de ticker, pas d'une liste
 * pré-créée. Les champs texte sont bornés — ils sont persistés dans le catalogue
 * partagé et affichés à tous les participants dès qu'un actif est détenu, donc
 * pas de chaîne libre non contrainte via une requête forgée.
 */
export const dynamicBuySchema = z.object({
  symbol: z.string().trim().min(1, "Choisissez un actif").max(20),
  name: z.string().trim().min(1, "Choisissez un actif").max(120),
  type: z.enum(AssetType),
  externalId: z.string().trim().max(64).optional(),
  currency: z.string().trim().max(10).optional(),
  logoUrl: z.string().trim().max(500).optional(),
  amount: z.coerce.number().positive("Le montant doit être positif"),
});

export const sellPartialSchema = z.object({
  assetId: z.string().min(1),
  quantity: z.coerce.number().positive("La quantité doit être positive"),
});
