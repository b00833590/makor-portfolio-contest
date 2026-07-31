import { z } from "zod";
import { TransactionType, AssetType } from "@/generated/prisma/enums";
import { parisDateTimeLocalSchema } from "@/lib/timezone";

export const createTransactionSchema = z.object({
  symbol: z.string().trim().min(1, "Choisissez un actif"),
  name: z.string().trim().min(1, "Choisissez un actif"),
  assetType: z.enum(AssetType),
  type: z.enum(TransactionType),
  externalId: z.string().trim().optional(),
  currency: z.string().trim().optional(),
  logoUrl: z.string().trim().optional(),
  quantity: z.coerce.number().positive("La quantité doit être positive"),
  price: z.coerce.number().positive("Le prix doit être positif"),
  createdAt: parisDateTimeLocalSchema,
});

export const updateTransactionSchema = z.object({
  type: z.enum(TransactionType),
  quantity: z.coerce.number().positive("La quantité doit être positive"),
  price: z.coerce.number().positive("Le prix doit être positif"),
  createdAt: parisDateTimeLocalSchema,
});
