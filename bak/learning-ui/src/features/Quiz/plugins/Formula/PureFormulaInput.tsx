import React, { KeyboardEvent, ReactNode, useEffect, useRef } from 'react';
import { Input } from '../../../../common/Input/Input';
import { useLocale } from '../../../../system/LocaleContext';
import { PureFormulaInputStatus } from './index';
import styles from "./PureFormulaInput.module.css";

export interface PureFormulaInputProps {
  formulaValue: string;
  onFormulaChange: (value: string) => void;
  previewNode?: ReactNode;
  scratchpadValue?: string;
  onScratchpadChange?: (value: string) => void;
  status?: PureFormulaInputStatus;
  disabled?: boolean;
  placeholder?: string;
  scratchpadPlaceholder?: string;
  onEnterPress?: () => void;
}

export function PureFormulaInput({
  formulaValue,
  onFormulaChange,
  previewNode,
  scratchpadValue,
  onScratchpadChange,
  status = 'default',
  disabled = false,
  placeholder,
  scratchpadPlaceholder,
  onEnterPress,
}: PureFormulaInputProps) {
  const { dict } = useLocale();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resolvedPlaceholder = placeholder || dict.quiz.placeholderFormula;
  const resolvedScratchpadPlaceholder = scratchpadPlaceholder || dict.quiz.scratchpadPlaceholder;

  // Auto-expand scratchpad height
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea && scratchpadValue !== undefined) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [scratchpadValue]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && onEnterPress) {
      onEnterPress();
    }
  };

  return (
    <div className={styles.container}>
      <Input
        value={formulaValue}
        onChange={(e) => onFormulaChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={resolvedPlaceholder}
        disabled={disabled}
        status={status}
        style={{ fontFamily: 'monospace' }}
      />
      
      {previewNode && (
        <div className={styles.preview}>
          {previewNode}
        </div>
      )}

      {scratchpadValue !== undefined && onScratchpadChange && (
        <div className={styles.scratchpad}>
          <label className={styles.scratchpadLabel}>{dict.quiz.scratchpadLabel}</label>
          <Input
            multiline
            ref={textareaRef}
            value={scratchpadValue}
            onChange={(e) => onScratchpadChange(e.target.value)}
            placeholder={resolvedScratchpadPlaceholder}
            rows={3}
            disabled={disabled}
            style={{ fontFamily: 'monospace', background: 'var(--lui-color-bg-alt)' }}
          />
        </div>
      )}
    </div>
  );
}
