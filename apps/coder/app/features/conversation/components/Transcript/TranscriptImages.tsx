import type { CodexTranscriptImage } from "@taylordb/codex";
import styles from "./Transcript.module.css";

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

function imageSrc(image: CodexTranscriptImage) {
  return image.asset?.url ?? image.url ?? image.dataUrl;
}

function TranscriptImage({
  className,
  image
}: {
  className?: string;
  image: CodexTranscriptImage;
}) {
  const src = imageSrc(image);
  return src ? <img alt={image.alt ?? "Image"} className={className} src={src} /> : null;
}
