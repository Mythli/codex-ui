import { ReactNode } from 'react';
import { Modal } from "../Modal/Modal";
import { Button, ButtonProps } from "../Button/Button";
import { useLocale } from '../../system/LocaleContext';
import styles from "./ConfirmModal.module.css";

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'warning' | 'danger' | 'info';
  /** If true, shows a loading spinner on the confirm button and locks the modal */
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  variant = 'warning',
  isLoading = false,
}: ConfirmModalProps) {
  const { dict } = useLocale();
  
  const resolvedConfirmText = confirmText || dict.shared.confirm;
  const resolvedCancelText = cancelText || dict.shared.cancel;

  const buttonVariantMap: Record<NonNullable<ConfirmModalProps['variant']>, ButtonProps['variant']> = {
    info: 'primary',
    warning: 'warning',
    danger: 'danger',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      size="small"
      ariaLabel={title}
      isLocked={isLoading}
    >
      <div className={styles.container}>
        <h3 className={styles.title}>{title}</h3>
        <div className={styles.message}>{message}</div>
        <div className={styles.actions}>
          <Button 
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            {resolvedCancelText}
          </Button>
          <Button 
            variant={buttonVariantMap[variant]}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {resolvedConfirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
