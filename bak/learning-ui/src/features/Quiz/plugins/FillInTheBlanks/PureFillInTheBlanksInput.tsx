import React from 'react';
import { PureFillInTheBlanksPart, PureFillInTheBlanksStatus } from './index';
import styles from "./PureFillInTheBlanksInput.module.css";

export interface PureFillInTheBlanksInputProps {
  parts: PureFillInTheBlanksPart[];
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  statusMap?: Record<string, PureFillInTheBlanksStatus>;
  displayValues?: Record<string, string>;
  helperMap?: Record<string, React.ReactNode>;
  disabled?: boolean;
}

export function PureFillInTheBlanksInput({
  parts,
  values,
  onChange,
  statusMap = {},
  displayValues = {},
  helperMap = {},
  disabled = false
}: PureFillInTheBlanksInputProps) {
  return (
    <div className={styles.container}>
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return <span key={`text-${index}`}>{part.value}</span>;
        }
        
        const status = statusMap[part.id] || 'default';
        let className = styles.gapInput;
        if (status === 'correct') className += ` ${styles.correct}`;
        else if (status === 'error') className += ` ${styles.error}`;
        else if (status === 'partial') className += ` ${styles.partial}`;
        else if (status === 'revealed') className += ` ${styles.revealed}`;

        const helper = helperMap[part.id];

        return (
          <span key={`gap-${part.id}`} className={styles.gap}>
            <input
              type="text"
              className={className}
              value={displayValues[part.id] ?? values[part.id] ?? ''}
              onChange={(e) => onChange(part.id, e.target.value)}
              placeholder={part.placeholder}
              disabled={disabled}
            />
            {helper && <span className={styles.helper}>{helper}</span>}
          </span>
        );
      })}
    </div>
  );
}
