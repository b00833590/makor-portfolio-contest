"use client";

import { useRef, useState, useTransition, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { AvatarCropDialog } from "./avatar-crop-dialog";
import { updateAvatar, removeAvatar } from "./actions";

export function AvatarEditor({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [pendingImageSrc, setPendingImageSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setPendingImageSrc(URL.createObjectURL(file));
  }

  function closeCropDialog() {
    if (pendingImageSrc) URL.revokeObjectURL(pendingImageSrc);
    setPendingImageSrc(null);
  }

  function handleCropConfirm(dataUrl: string) {
    closeCropDialog();
    setPreview(dataUrl);
    startTransition(async () => {
      const result = await updateAvatar(dataUrl);
      if (result.error) setError(result.error);
    });
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
      {pendingImageSrc && (
        <AvatarCropDialog imageSrc={pendingImageSrc} onCancel={closeCropDialog} onConfirm={handleCropConfirm} />
      )}
    </div>
  );
}
