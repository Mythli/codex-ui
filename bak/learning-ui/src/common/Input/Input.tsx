import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef, ReactNode, Ref } from 'react';
import { MdClose } from 'react-icons/md';
import styles from "./Input.module.css";

export type InputStatus = 'default' | 'correct' | 'error' | 'partial' | 'revealed';

/**
 * Base properties for the Input component.
 */
export interface BaseInputProps {
  /** The visual validation status of the input. Changes border and background colors. */
  status?: InputStatus;
  /** If true, renders a `<textarea>` instead of an `<input>`. */
  multiline?: boolean;
  /** Optional icon to display on the left side of the input */
  leftIcon?: ReactNode;
  /** Optional icon to display on the right side of the input */
  rightIcon?: ReactNode;
  /** Optional callback to clear the input. If provided, renders a clear button on the right. */
  onClear?: () => void;
}

export type InputProps = BaseInputProps & 
  Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & 
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'>;

export const Input = forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps>(
  ({ status = 'default', multiline = false, leftIcon, rightIcon, onClear, className = '', ...props }, ref) => {
    
    const hasRightElement = rightIcon || onClear;
    
    const classes = [
      styles.input,
      multiline ? styles.textarea : '',
      status !== 'default' ? styles[status] : '',
      leftIcon ? styles.withLeftIcon : '',
      hasRightElement ? styles.withRightIcon : '',
      className
    ].filter(Boolean).join(' ');

    const inputElement = multiline ? (
      <textarea
        ref={ref as Ref<HTMLTextAreaElement>}
        className={classes}
        {...(props as TextareaHTMLAttributes<HTMLTextAreaElement>)}
      />
    ) : (
      <input
        ref={ref as Ref<HTMLInputElement>}
        className={classes}
        {...(props as InputHTMLAttributes<HTMLInputElement>)}
      />
    );

    if (!leftIcon && !hasRightElement) {
      return inputElement;
    }

    return (
      <div className={styles.wrapper}>
        {leftIcon && <div className={styles.leftIcon}>{leftIcon}</div>}
        {inputElement}
        {hasRightElement && (
          <div className={styles.rightIcon}>
            {onClear ? (
              <button type="button" className={styles.clearBtn} onClick={onClear} aria-label="Clear input">
                <MdClose size={18} />
              </button>
            ) : (
              rightIcon
            )}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
