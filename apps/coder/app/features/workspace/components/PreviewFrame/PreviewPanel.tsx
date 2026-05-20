import type { PreviewViewport } from '@coder/types'
import styles from '../Shell/CoderShell.module.css'
import { PreviewControls } from '../TopBar/PreviewControls'
import { PreviewFrame } from './PreviewFrame'

export function PreviewPanel({
  onOpenExternal,
  onReload,
  onViewportChange,
  previewReloadKey,
  previewUrl,
  previewViewport,
}: {
  onOpenExternal: () => void
  onReload: () => void
  onViewportChange: (viewport: PreviewViewport) => void
  previewReloadKey: number
  previewUrl?: string
  previewViewport: PreviewViewport
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
        <PreviewFrame
          previewUrl={previewUrl}
          reloadKey={previewReloadKey}
          viewport={previewViewport}
        />
      </div>
    </section>
  )
}
