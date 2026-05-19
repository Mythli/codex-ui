import { ReactNode, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from "./Modal.module.css";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Whether clicking outside closes the modal (default: true) */
  closeOnOverlayClick?: boolean;
  /** Whether pressing Escape closes the modal (default: true) */
  closeOnEscape?: boolean;
  /** If true, prevents closing the modal via overlay or escape key (useful during async actions) */
  isLocked?: boolean;
  /** Additional class name for the modal content */
  className?: string;
  /** Size variant */
  size?: 'small' | 'medium' | 'large' | 'auto';
  /** Aria label for accessibility */
  ariaLabel?: string;
}

export function Modal({
  isOpen,
  onClose,
  children,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  isLocked = false,
  className = '',
  size = 'medium',
  ariaLabel,
}: ModalProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && closeOnEscape && !isLocked) {
      onClose();
    }
  }, [onClose, closeOnEscape, isLocked]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleOverlayClick = () => {
    if (closeOnOverlayClick && !isLocked) {
      onClose();
    }
  };

  return createPortal(
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div 
        className={`${styles.content} ${styles[size]} ${className}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
