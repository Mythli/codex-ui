import React from 'react';
import { Toaster as SonnerToaster, toast } from 'sonner';

// Re-export toast so consumers don't need to install or import sonner directly
export { toast };

/**
 * A global toast notification provider wrapped around Sonner.
 * Automatically styled to match the Learning UI design system.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'var(--lui-color-bg-elevated)',
          color: 'var(--lui-color-text-main)',
          border: '1px solid var(--lui-color-border)',
          fontFamily: 'var(--lui-font-family)',
          boxShadow: 'var(--lui-shadow-lg)',
          borderRadius: 'var(--lui-radius-md)',
        },
        className: 'lui-toast',
      }}
    />
  );
}
