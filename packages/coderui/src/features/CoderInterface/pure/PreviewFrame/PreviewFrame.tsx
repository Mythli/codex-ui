import type { CSSProperties } from "react";
import styles from "./PreviewFrame.module.css";

export type PreviewViewport = "desktop" | "tablet" | "phone";

const viewportWidths: Record<PreviewViewport, string> = {
  desktop: "100%",
  tablet: "820px",
  phone: "390px"
};

export function PreviewFrame({
  previewUrl,
  reloadKey = 0,
  viewport = "desktop"
}: {
  previewUrl?: string;
  reloadKey?: number;
  viewport?: PreviewViewport;
}) {
  const activeWidth = viewportWidths[viewport];

  return (
    <section aria-label="Preview" className={styles.previewWrap} data-testid="preview-panel">
      <div className={styles.previewFrame}>
        <div className={[styles.frameBody, viewport !== "desktop" ? styles.frameBodyWindowed : ""].filter(Boolean).join(" ")}>
          <div
            className={[styles.viewport, viewport !== "desktop" ? styles.viewportWindowed : ""].filter(Boolean).join(" ")}
            data-preview-viewport={viewport}
            data-testid="preview-viewport"
            style={{ "--preview-viewport-width": activeWidth } as CSSProperties}
          >
            {previewUrl ? (
              <iframe
                className={styles.preview}
                data-testid="preview-frame"
                key={`${previewUrl}-${reloadKey}`}
                src={previewUrl}
                title="Preview"
              />
            ) : (
              <article className={styles.emptyState} data-testid="preview-empty">
                <h1>Preview unavailable</h1>
                <p>Connect a running app URL to inspect the current workspace.</p>
              </article>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
