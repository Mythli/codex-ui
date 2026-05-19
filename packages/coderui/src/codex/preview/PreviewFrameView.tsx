import type { CodexPreviewViewport } from "../types";
import styles from "../codex.module.css";

export function PreviewFrameView({
  label = "Preview",
  previewUrl,
  viewport
}: {
  label?: string;
  previewUrl?: string;
  viewport: CodexPreviewViewport;
}) {
  return (
    <section aria-label={label} className={styles.preview} data-preview-viewport={viewport}>
      {previewUrl ? <iframe className={styles.previewFrame} src={previewUrl} title={label} /> : <span className={styles.muted}>Preview unavailable</span>}
    </section>
  );
}
