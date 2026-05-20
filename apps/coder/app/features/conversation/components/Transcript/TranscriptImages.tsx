import type { CodexTranscriptImage } from "@taylordb/codex";
import { useEffect, useState } from "react";
import styles from "./Transcript.module.css";

const registeredAssetUrlByPath = new Map<string, string>();

export function TranscriptImageStrip({
  blockId,
  compact = false,
  images
}: {
  blockId?: string;
  compact?: boolean;
  images: readonly CodexTranscriptImage[];
}) {
  const className = compact ? styles.messageImages : styles.imageStrip;
  return (
    <div className={className} data-block-id={blockId} data-testid="transcript-images">
      {images.map((image) => (
        <TranscriptImage
          className={styles.messageImage}
          image={image}
          key={image.id}
        />
      ))}
    </div>
  );
}

function immediateImageSrc(image: CodexTranscriptImage) {
  return image.asset?.url ?? image.url ?? image.dataUrl;
}

function TranscriptImage({
  className,
  image
}: {
  className?: string;
  image: CodexTranscriptImage;
}) {
  const src = useTranscriptImageSrc(image);
  return src ? <img alt={image.alt ?? "Image"} className={className} src={src} /> : null;
}

function useTranscriptImageSrc(image: CodexTranscriptImage): string | undefined {
  const immediateSrc = immediateImageSrc(image);
  const [registeredSrc, setRegisteredSrc] = useState(() => image.path ? registeredAssetUrlByPath.get(image.path) : undefined);

  useEffect(() => {
    if (immediateSrc || image.kind !== "localPath" || !image.path) {
      return;
    }

    const path = image.path;
    const cached = registeredAssetUrlByPath.get(path);
    if (cached) {
      setRegisteredSrc(cached);
      return;
    }

    let cancelled = false;
    void registerLocalImagePath(path).then((url) => {
      if (!url || cancelled) {
        return;
      }
      registeredAssetUrlByPath.set(path, url);
      setRegisteredSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [image.kind, image.path, immediateSrc]);

  return immediateSrc ?? registeredSrc;
}

async function registerLocalImagePath(path: string): Promise<string | undefined> {
  const response = await fetch("/codex-assets/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path })
  });
  if (!response.ok) {
    return undefined;
  }
  const payload = await response.json() as { asset?: { url?: string } };
  return payload.asset?.url;
}
