import React from 'react';
import { Button } from "../../../../common/Button/Button";
import { FloatingActionBar } from "../../../../common/FloatingActionBar/FloatingActionBar";
import styles from "./PureBulkActionBar.module.css";

export interface PureBulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onReview: () => void;
  onDelete: () => void;
}

export function PureBulkActionBar({ selectedCount, onClearSelection, onReview, onDelete }: PureBulkActionBarProps) {
  const info = (
    <div className={styles.info}>
      <span className={styles.count}>{selectedCount}</span> cards selected
      <button className={styles.clearBtn} onClick={onClearSelection}>Clear</button>
    </div>
  );

  return (
    <FloatingActionBar isVisible={selectedCount > 0} info={info}>
      <Button variant="danger" size="sm" onClick={onDelete}>Delete</Button>
      <Button variant="primary" size="sm" onClick={onReview}>Review Selected</Button>
    </FloatingActionBar>
  );
}
