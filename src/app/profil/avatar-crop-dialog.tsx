"use client";

import { useState } from "react";
import type { Area, Point } from "react-easy-crop";
import Cropper from "react-easy-crop";
import { ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cropImageToDataUrl } from "./crop-image";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export function AvatarCropDialog({
  imageSrc,
  onCancel,
  onConfirm,
}: {
  imageSrc: string;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
}) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!croppedAreaPixels) return;
    setIsProcessing(true);
    setError(null);
    try {
      const dataUrl = await cropImageToDataUrl(imageSrc, croppedAreaPixels);
      onConfirm(dataUrl);
    } catch {
      setError("Impossible de traiter cette image.");
      setIsProcessing(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Recadrer la photo de profil</DialogTitle>
        </DialogHeader>

        <div className="relative h-72 w-full overflow-hidden rounded-lg bg-muted">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
          />
        </div>

        <div className="flex items-center gap-3">
          <ZoomIn className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="w-full accent-primary"
            aria-label="Zoom"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={isProcessing} onClick={onCancel}>
            Annuler
          </Button>
          <Button type="button" disabled={isProcessing || !croppedAreaPixels} onClick={handleConfirm}>
            Valider le recadrage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
