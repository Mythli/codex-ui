import { PreviewFrame, type PreviewViewport } from "./PreviewFrame";
import { PreviewControls } from "./TopBar";
import styles from "./CoderShell.module.css";

export function PreviewPanel({
  onOpenExternal,
  onReload,
  onViewportChange,
  previewReloadKey,
  previewUrl,
  previewViewport
}: {
  onOpenExternal: () => void;
  onReload: () => void;
  onViewportChange: (viewport: PreviewViewport) => void;
  previewReloadKey: number;
  previewUrl?: string;
  previewViewport: PreviewViewport;
}) {
  return (
    <section className={styles.previewPanel}>
      <header className={styles.previewToolbar}>
        <PreviewControls
          onOpenExternal={onOpenExternal}
          onReload={onReload}
          onViewportChange={onViewportChange}
          previewUrl={previewUrl}
          viewport={previewViewport}
        />
      </header>
      <div className={styles.workspace}>
        <PreviewFrame previewUrl={previewUrl} reloadKey={previewReloadKey} viewport={previewViewport} />
      </div>
    </section>
  );
}
