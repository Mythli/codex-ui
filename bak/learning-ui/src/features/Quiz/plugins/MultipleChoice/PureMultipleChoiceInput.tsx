import React from 'react';
import { ChoiceItem } from './index';
import styles from "./PureMultipleChoiceInput.module.css";

export interface PureMultipleChoiceInputProps {
  choices: ChoiceItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  multiSelect?: boolean;
  disabled?: boolean;
  statusMap?: Record<string, 'correct' | 'incorrect' | 'default'>;
}

export function PureMultipleChoiceInput({
  choices,
  selectedIds,
  onChange,
  multiSelect = false,
  disabled = false,
  statusMap = {},
}: PureMultipleChoiceInputProps) {
  
  const handleClick = (id: string) => {
    if (multiSelect) {
      if (selectedIds.includes(id)) {
        onChange(selectedIds.filter(x => x !== id));
      } else {
        onChange([...selectedIds, id]);
      }
    } else {
      onChange([id]);
    }
  };

  const getChoiceClassName = (id: string): string => {
    let className = styles.choice;
    
    if (selectedIds.includes(id)) {
      className += ` ${styles.selected}`;
    }
    
    const status = statusMap[id];
    if (status === 'correct') {
      className += ` ${styles.correct}`;
    } else if (status === 'incorrect') {
      className += ` ${styles.incorrect}`;
    }
    
    return className;
  };

  return (
    <div className={styles.choices}>
      {choices.map((choice) => (
        <button
          key={choice.id}
          className={getChoiceClassName(choice.id)}
          onClick={() => handleClick(choice.id)}
          disabled={disabled}
          type="button"
        >
          <div className={`${styles.indicator} ${multiSelect ? styles.checkbox : styles.radio}`}></div>
          <span className={styles.text}>{choice.text}</span>
        </button>
      ))}
    </div>
  );
}
