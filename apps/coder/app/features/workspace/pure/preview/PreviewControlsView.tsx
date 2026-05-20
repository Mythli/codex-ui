import { FiExternalLink, FiMonitor, FiRefreshCw, FiSmartphone, FiTablet } from "react-icons/fi";
import { IconButton, UrlBar } from "@app/common/pure";
import type { PreviewViewport } from "@coder/types";
import styles from "@app/common/pure/codex.module.css";

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
  onViewportChange?: (viewport: PreviewViewport) => void;
  previewUrl?: string;
  viewport: PreviewViewport;
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
              onClick={() => onViewportChange?.(id as PreviewViewport)}
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
