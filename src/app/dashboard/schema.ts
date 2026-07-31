import { z } from "zod";
import { AssetType } from "@/generated/prisma/enums";

export const amountOrderSchema = z.object({
  assetId: z.string().min(1, "Choisissez un actif"),
  amount: z.coerce.number().positive("Le montant doit être positif"),
});

/** Achat dynamique : l'actif vient de la recherche de ticker, pas d'une liste pré-créée. */
export const dynamicBuySchema = z.object({
  symbol: z.string().trim().min(1, "Choisissez un actif"),
  name: z.string().trim().min(1, "Choisissez un actif"),
  type: z.enum(AssetType),
  externalId: z.string().trim().optional(),
  currency: z.string().trim().optional(),
  logoUrl: z.string().trim().optional(),
  amount: z.coerce.number().positive("Le montant doit être positif"),
});

export const sellPartialSchema = z.object({
  assetId: z.string().min(1),
  quantity: z.coerce.number().positive("La quantité doit être positive"),
});
