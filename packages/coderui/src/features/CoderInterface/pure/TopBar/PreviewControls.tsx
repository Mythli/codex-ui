import { FiCheck, FiExternalLink, FiMonitor, FiRefreshCw, FiSmartphone, FiTablet } from "react-icons/fi";
import { IconButton, Popover, UrlBar } from "../../../../common";
import type { PreviewViewport } from "../../PreviewFrame";
import styles from "./PreviewControls.module.css";

const viewports = [
  { id: "desktop", label: "Desktop", icon: FiMonitor },
  { id: "tablet", label: "Tablet", icon: FiTablet },
  { id: "phone", label: "Phone", icon: FiSmartphone }
] as const;

export function PreviewControls({
  onOpenExternal,
  onReload,
  onViewportChange,
  previewUrl,
  viewport
}: {
  onOpenExternal?: () => void;
  onReload?: () => void;
  onViewportChange: (viewport: PreviewViewport) => void;
  previewUrl?: string;
  viewport: PreviewViewport;
}) {
  const activeViewport = viewports.find((item) => item.id === viewport) ?? viewports[0];
  const ActiveIcon = activeViewport.icon;
  const label = previewUrl ?? "No preview URL";

  return (
    <UrlBar
      actions={
        <>
          <IconButton
            className={styles.barButton}
            data-testid="preview-reload-button"
            disabled={!previewUrl}
            label="Reload preview"
            onClick={onReload}
            type="button"
          >
            <FiRefreshCw aria-hidden="true" />
          </IconButton>
          <IconButton
            className={styles.barButton}
            data-testid="preview-open-button"
            disabled={!previewUrl}
            label="Open preview in a new tab"
            onClick={onOpenExternal}
            type="button"
          >
            <FiExternalLink aria-hidden="true" />
          </IconButton>
        </>
      }
      leading={
        <Popover
          contentClassName={styles.viewportMenu}
          offsetPx={6}
          renderTrigger={({ ref, isOpen, props }) => (
            <span className={styles.viewportTrigger} ref={ref} {...props}>
              <IconButton
                className={[styles.barButton, isOpen ? styles.activeAction : ""].filter(Boolean).join(" ")}
                data-testid="preview-viewport-button"
                label="Change preview viewport"
                type="button"
              >
                <ActiveIcon aria-hidden="true" />
              </IconButton>
            </span>
          )}
        >
          {({ close }) => (
            <div className={styles.viewportList} data-testid="preview-viewport-menu">
              {viewports.map((item) => {
                const Icon = item.icon;
                const isActive = item.id === viewport;

                return (
                  <button
                    aria-current={isActive ? "true" : undefined}
                    className={[styles.viewportOption, isActive ? styles.viewportOptionActive : ""]
                      .filter(Boolean)
                      .join(" ")}
                    data-testid="preview-viewport-option"
                    data-viewport={item.id}
                    key={item.id}
                    onClick={() => {
                      onViewportChange(item.id);
                      close();
                    }}
                    type="button"
                  >
                    <Icon aria-hidden="true" />
                    <span>{item.label}</span>
                    {isActive ? <FiCheck aria-hidden="true" /> : <span />}
                  </button>
                );
              })}
            </div>
          )}
        </Popover>
      }
      title="Preview URL bar"
      value={label}
    />
  );
}
