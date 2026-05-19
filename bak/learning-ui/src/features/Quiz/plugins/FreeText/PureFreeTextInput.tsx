import React, { KeyboardEvent } from 'react';
import { Input } from '../../../../common/Input/Input';
import { useLocale } from '../../../../system/LocaleContext';
import { PureFreeTextInputStatus } from './index';
import styles from "./PureFreeTextInput.module.css";

export interface PureFreeTextInputProps {
  value: string;
  onChange: (value: string) => void;
  inputType?: 'short' | 'long';
  placeholder?: string;
  status?: PureFreeTextInputStatus;
  disabled?: boolean;
  onEnterPress?: () => void;
}

export function PureFreeTextInput({
  value,
  onChange,
  inputType = 'short',
  placeholder,
  status = 'default',
  disabled = false,
  onEnterPress,
}: PureFreeTextInputProps) {
  const { dict } = useLocale();
  const resolvedPlaceholder = placeholder || dict.quiz.placeholderFreeText;

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && onEnterPress && inputType === 'short') {
      onEnterPress();
    }
  };

  return (
    <div className={styles.container}>
      <Input
        multiline={inputType === 'long'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={resolvedPlaceholder}
        disabled={disabled}
        status={status}
        rows={inputType === 'long' ? 3 : undefined}
        style={inputType === 'short' ? { maxWidth: '400px' } : undefined}
      />
    </div>
  );
}
