import { ReactNode, ButtonHTMLAttributes, forwardRef } from 'react';
import styles from "./ControlIconButton.module.css";

export interface ControlIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
  active?: boolean;
}

export const ControlIconButton = forwardRef<HTMLButtonElement, ControlIconButtonProps>(
  ({ icon, label, active, className = '', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`${styles.btn} ${active ? styles.active : ''} ${className}`}
        title={label}
        aria-label={label}
        type="button"
        {...props}
      >
        {icon}
      </button>
    );
  }
);

ControlIconButton.displayName = 'ControlIconButton';
