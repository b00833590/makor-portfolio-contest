import { z } from "zod";

/** Data URL générée côté client (canvas, redimensionnée) — 400 Ko couvre largement une image 256x256 en JPEG. */
export const avatarDataUrlSchema = z
  .string()
  .regex(/^data:image\/(png|jpeg|webp);base64,/, "Format d'image non supporté")
  .max(400_000, "Image trop volumineuse");
