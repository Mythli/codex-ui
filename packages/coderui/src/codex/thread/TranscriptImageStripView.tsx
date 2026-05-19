import { ImageStrip } from "../../common";

export type TranscriptImageViewItem = {
  id: string;
  alt?: string;
  src: string;
};

export function TranscriptImageStripView({ images }: { images: TranscriptImageViewItem[] }) {
  return (
    <ImageStrip images={images} />
  );
}
