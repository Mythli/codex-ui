import React from 'react';
import { Button } from "../../../../common/Button/Button";
import { PureBadge, BadgeColor } from "../../../../common/Badge/PureBadge";
import { EmptyState } from "../../../../common/EmptyState/EmptyState";
import styles from "./PureVocabEmptyState.module.css";

export interface EmptyStateTag {
  id: string;
  label: string;
  color?: BadgeColor;
}

export interface PureVocabEmptyStateProps {
  /** The tags that were actively filtered when no cards were found */
  activeTags?: EmptyStateTag[];
  /** Callback to clear filters and return to the full deck */
  onClearFilters?: () => void;
  title?: string;
  message?: string;
  className?: string;
}

/**
 * A celebratory empty state shown when a user selects a filter that has zero due cards.
 */
export function PureVocabEmptyState({
  activeTags = [],
  onClearFilters,
  title,
  message,
  className = ''
}: PureVocabEmptyStateProps) {
  const resolvedTitle = title || "You're all caught up!";
  const resolvedMessage = message || "There are no cards due for review in this category right now. Great job staying on top of your studies!";

  return (
    <EmptyState
      icon="☕"
      title={resolvedTitle}
      description={resolvedMessage}
      className={className}
    >
      {activeTags.length > 0 && (
        <div className={styles.tags}>
          {activeTags.map(tag => (
            <PureBadge key={tag.id} variant="solid" color={tag.color || 'default'} size="md">
              {tag.label}
            </PureBadge>
          ))}
        </div>
      )}

      {onClearFilters && (
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClearFilters}>
            Clear Filters
          </Button>
        </div>
      )}
    </EmptyState>
  );
}
