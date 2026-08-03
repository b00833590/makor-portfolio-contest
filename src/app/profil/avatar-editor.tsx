"use client";

import { useRef, useState, useTransition, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { updateAvatar, removeAvatar } from "./actions";

const MAX_DIMENSION_PX = 256;
const JPEG_QUALITY = 0.85;

function resizeImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Ce fichier n'est pas une image valide."));
      image.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION_PX / Math.max(image.width, image.height));
        const width = Math.round(image.width * scale);
        const height = Math.round(image.height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Traitement d'image impossible sur ce navigateur."));
          return;
        }
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      image.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function AvatarEditor({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setPreview(dataUrl);
      startTransition(async () => {
        const result = await updateAvatar(dataUrl);
        if (result.error) setError(result.error);
      });
    } catch {
      setError("Impossible de traiter cette image.");
    }
  }

  function handleRemove() {
    setPreview(null);
    setError(null);
    startTransition(async () => {
      const result = await removeAvatar();
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex items-center gap-4">
      <UserAvatar name={name} avatarUrl={preview} className="size-20 text-xl" />
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => inputRef.current?.click()}>
            {preview ? "Changer la photo" : "Ajouter une photo"}
          </Button>
          {preview && (
            <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={handleRemove}>
              Supprimer
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
