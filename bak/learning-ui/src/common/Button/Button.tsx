import { ButtonHTMLAttributes, ReactNode, forwardRef } from 'react';
import { Spinner } from '../Spinner/Spinner';
import styles from "./Button.module.css";

/**
 * A standard button component with predefined semantic variants and sizes.
 */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The visual style variant. Defaults to 'primary'. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'success' | 'danger' | 'warning';
  /** The size of the button. Defaults to 'md'. */
  size?: 'sm' | 'md' | 'lg';
  /** If true, shows a loading spinner and disables the button. */
  isLoading?: boolean;
  /** Optional icon to display before the text. */
  leftIcon?: ReactNode;
  /** Optional icon to display after the text. */
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon, children, className = '', disabled, ...props }, ref) => {
    const classes = [
      styles.button,
      styles[variant],
      styles[size],
      className
    ].filter(Boolean).join(' ');

    return (
      <button ref={ref} className={classes} disabled={disabled || isLoading} {...props}>
        {isLoading && <Spinner size="sm" />}
        {!isLoading && leftIcon && <span className={styles.icon}>{leftIcon}</span>}
        {children}
        {!isLoading && rightIcon && <span className={styles.icon}>{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
