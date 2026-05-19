import { FiExternalLink, FiMonitor, FiRefreshCw, FiSmartphone, FiTablet } from "react-icons/fi";
import { IconButton, UrlBar } from "../../common";
import type { CodexPreviewViewport } from "../types";
import styles from "../codex.module.css";

const viewportIcons = {
  desktop: FiMonitor,
  tablet: FiTablet,
  phone: FiSmartphone
};

export function PreviewControlsView({
  onOpenExternal,
  onReload,
  onViewportChange,
  previewUrl,
  viewport
}: {
  onOpenExternal?: () => void;
  onReload?: () => void;
  onViewportChange?: (viewport: CodexPreviewViewport) => void;
  previewUrl?: string;
  viewport: CodexPreviewViewport;
}) {
  const ActiveIcon = viewportIcons[viewport];
  return (
    <UrlBar
      actions={
        <>
          <IconButton disabled={!previewUrl} label="Reload preview" onClick={onReload} type="button">
            <FiRefreshCw aria-hidden="true" />
          </IconButton>
          <IconButton disabled={!previewUrl} label="Open preview" onClick={onOpenExternal} type="button">
            <FiExternalLink aria-hidden="true" />
          </IconButton>
        </>
      }
      leading={
        <div className={styles.actions}>
          {Object.entries(viewportIcons).map(([id, Icon]) => (
            <IconButton
              aria-current={id === viewport ? "true" : undefined}
              key={id}
              label={`Use ${id} viewport`}
              onClick={() => onViewportChange?.(id as CodexPreviewViewport)}
              type="button"
            >
              {id === viewport ? <ActiveIcon aria-hidden="true" /> : <Icon aria-hidden="true" />}
            </IconButton>
          ))}
        </div>
      }
      title="Preview URL"
      value={previewUrl ?? "No preview URL"}
    />
  );
}
