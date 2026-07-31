import { z } from "zod";

export const amountOrderSchema = z.object({
  assetId: z.string().min(1, "Choisissez un actif"),
  amount: z.coerce.number().positive("Le montant doit être positif"),
});

export const sellPartialSchema = z.object({
  assetId: z.string().min(1),
  quantity: z.coerce.number().positive("La quantité doit être positive"),
});
