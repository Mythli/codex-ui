import {
  FiCheck,
  FiExternalLink,
  FiMonitor,
  FiRefreshCw,
  FiSmartphone,
  FiTablet,
} from 'react-icons/fi'
import { IconButton, MenuItem, MenuList, Popover, UrlBar } from '@app/common/pure'
import type { PreviewViewport } from '../../types'
import styles from './PreviewControls.module.css'

const viewports = [
  { id: 'desktop', label: 'Desktop', icon: FiMonitor },
  { id: 'tablet', label: 'Tablet', icon: FiTablet },
  { id: 'phone', label: 'Phone', icon: FiSmartphone },
] as const

export function PreviewControls({
  onOpenExternal,
  onReload,
  onViewportChange,
  previewUrl,
  viewport,
}: {
  onOpenExternal?: () => void
  onReload?: () => void
  onViewportChange: (viewport: PreviewViewport) => void
  previewUrl?: string
  viewport: PreviewViewport
}) {
  const activeViewport = viewports.find((item) => item.id === viewport) ?? viewports[0]
  const ActiveIcon = activeViewport.icon
  const label = previewUrl ?? 'No preview URL'

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
          offsetPx={6}
          renderTrigger={({ ref, isOpen, props }) => (
            <span className={styles.viewportTrigger} ref={ref} {...props}>
              <IconButton
                className={[styles.barButton, isOpen ? styles.activeAction : '']
                  .filter(Boolean)
                  .join(' ')}
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
            <MenuList data-testid="preview-viewport-menu" label="Viewport">
              {viewports.map((item) => {
                const Icon = item.icon
                const isActive = item.id === viewport

                return (
                  <MenuItem
                    aria-current={isActive ? 'true' : undefined}
                    data-testid="preview-viewport-option"
                    data-viewport={item.id}
                    key={item.id}
                    label={item.label}
                    leadingIcon={<Icon aria-hidden="true" />}
                    onSelect={() => {
                      onViewportChange(item.id)
                      close()
                    }}
                    selected={isActive}
                    trailing={isActive ? <FiCheck aria-hidden="true" /> : null}
                  />
                )
              })}
            </MenuList>
          )}
        </Popover>
      }
      title="Preview URL bar"
      value={label}
    />
  )
}
