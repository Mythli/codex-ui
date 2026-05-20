import styles from "./ImageStrip.module.css";

export type ImageStripItem = {
  alt?: string;
  id: string;
  src: string;
};

export function ImageStrip({ images }: { images: ImageStripItem[] }) {
  return (
    <div className={styles.strip} data-testid="image-strip">
      {images.map((image) => (
        <img alt={image.alt ?? "Image"} className={styles.image} key={image.id} src={image.src} />
      ))}
    </div>
  );
}
