import React, { ReactNode } from 'react';
import { MdSearch } from 'react-icons/md';
import { Input } from '../../../../common/Input/Input';
import { TagSelect, TagOption } from '../../../../common/TagSelect/TagSelect';
import { BadgeColor } from '../../../../common/Badge/PureBadge';
import styles from './PureVocabFilterBar.module.css';

export interface FilterTag {
  id: string;
  label: string;
  color?: BadgeColor;
}

export interface FilterStatus {
  value: string;
  label: string;
  color?: BadgeColor;
}

export interface PureVocabFilterBarProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;

  availableTags?: FilterTag[];
  activeTags?: string[];
  onTagsChange?: (tags: string[]) => void;

  availableStatuses?: FilterStatus[];
  activeStatuses?: string[];
  onStatusesChange?: (statuses: string[]) => void;

  actionButton?: ReactNode;
  className?: string;
}

export function PureVocabFilterBar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search...",
  availableTags = [],
  activeTags = [],
  onTagsChange,
  availableStatuses = [],
  activeStatuses = [],
  onStatusesChange,
  actionButton,
  className = ''
}: PureVocabFilterBarProps) {
  const showSearch = onSearchChange !== undefined;
  const showTags = availableTags.length > 0 && onTagsChange !== undefined;
  const showStatuses = availableStatuses.length > 0 && onStatusesChange !== undefined;

  const tagOptions: TagOption[] = availableTags.map(t => ({ value: t.id, label: t.label, color: t.color }));
  const selectedTagOptions = tagOptions.filter(o => activeTags.includes(o.value));

  const statusOptions: TagOption[] = availableStatuses.map(s => ({ value: s.value, label: s.label, color: s.color }));
  const selectedStatusOptions = statusOptions.filter(o => activeStatuses.includes(o.value));

  return (
    <div className={`${styles.toolbar} ${className}`}>
      {showSearch && (
        <div className={styles.search}>
          <Input 
            leftIcon={<MdSearch size={20} />}
            placeholder={searchPlaceholder} 
            value={searchQuery || ''}
            onChange={(e) => onSearchChange(e.target.value)}
            onClear={searchQuery ? () => onSearchChange('') : undefined}
          />
        </div>
      )}
      
      {showTags && (
        <div className={styles.tagFilter}>
          <TagSelect
            options={tagOptions}
            value={selectedTagOptions}
            onChange={(selected) => onTagsChange(selected ? selected.map(s => s.value) : [])}
            placeholder="Filter by tags..."
            creatable={false}
          />
        </div>
      )}

      {showStatuses && (
        <div className={styles.statusFilter}>
          <TagSelect
            options={statusOptions}
            value={selectedStatusOptions}
            onChange={(selected) => onStatusesChange(selected ? selected.map(s => s.value) : [])}
            placeholder="Filter by status..."
            creatable={false}
          />
        </div>
      )}

      {actionButton && (
        <div className={styles.action}>
          {actionButton}
        </div>
      )}
    </div>
  );
}
