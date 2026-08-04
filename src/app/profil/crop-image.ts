/** Taille de sortie cible pour un avatar — cohérente avec la limite `avatarDataUrlSchema` (schema.ts). */
export const AVATAR_OUTPUT_PX = 256;
export const AVATAR_JPEG_QUALITY = 0.85;

export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Ne jamais agrandir au-delà de la résolution réellement capturée par le
 * recadrage (ça ne ferait qu'ajouter du flou) : on ne redimensionne que
 * vers le bas, jusqu'à `maxDimensionPx`.
 */
export function computeAvatarOutputSize(cropSizePx: number, maxDimensionPx: number = AVATAR_OUTPUT_PX): number {
  return Math.round(Math.min(cropSizePx, maxDimensionPx));
}

/** Découpe `pixelCrop` (carré, coordonnées dans l'image source) et l'encode en JPEG, prêt pour `updateAvatar`. */
export function cropImageToDataUrl(
  imageSrc: string,
  pixelCrop: PixelCrop,
  maxDimensionPx: number = AVATAR_OUTPUT_PX,
  quality: number = AVATAR_JPEG_QUALITY,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onerror = () => reject(new Error("Ce fichier n'est pas une image valide."));
    image.onload = () => {
      const outputPx = computeAvatarOutputSize(pixelCrop.width, maxDimensionPx);

      const canvas = document.createElement("canvas");
      canvas.width = outputPx;
      canvas.height = outputPx;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Traitement d'image impossible sur ce navigateur."));
        return;
      }

      context.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        outputPx,
        outputPx,
      );
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    image.src = imageSrc;
  });
}
