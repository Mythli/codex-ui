import type { PreviewViewport } from "@coder/types";
import styles from "@app/common/pure/codex.module.css";

export function PreviewFrameView({
  label = "Preview",
  previewUrl,
  viewport
}: {
  label?: string;
  previewUrl?: string;
  viewport: PreviewViewport;
}) {
  return (
    <section aria-label={label} className={styles.preview} data-preview-viewport={viewport}>
      {previewUrl ? (
        <iframe
          className={styles.previewFrame}
          sandbox="allow-forms allow-modals allow-popups allow-scripts"
          src={previewUrl}
          title={label}
        />
      ) : <span className={styles.muted}>Preview unavailable</span>}
    </section>
  );
}
