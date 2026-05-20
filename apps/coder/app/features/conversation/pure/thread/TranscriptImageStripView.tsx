import { ImageStrip } from "@app/common/pure";
import type { CodexTranscriptImage } from "@taylordb/codex";

export function TranscriptImageStripView({ images }: { images: CodexTranscriptImage[] }) {
  return (
    <ImageStrip images={images.map((image) => ({
      id: image.id,
      alt: image.alt,
      src: image.dataUrl ?? image.url ?? image.path ?? image.asset?.url ?? ""
    })).filter((image) => image.src.length > 0)} />
  );
}
