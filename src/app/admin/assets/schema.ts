import { z } from "zod";
import { AssetType } from "@/generated/prisma/enums";

const assetFieldsSchema = z.object({
  symbol: z.string().trim().min(1).toUpperCase(),
  name: z.string().trim().min(1),
  type: z.enum(AssetType),
  sector: z.string().trim().optional(),
  currency: z.string().trim().min(1).toUpperCase(),
});

export const createAssetSchema = assetFieldsSchema;
export const updateAssetSchema = assetFieldsSchema;
