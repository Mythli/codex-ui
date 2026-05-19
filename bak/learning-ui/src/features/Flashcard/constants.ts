import { BadgeColor } from '../../common/Badge/PureBadge';

export const STATUS_OPTIONS: { value: string; label: string; color: BadgeColor }[] = [
  { value: 'new', label: 'New', color: 'info' },
  { value: 'learning', label: 'Learning', color: 'primary' },
  { value: 'due', label: 'Due', color: 'warning' },
  { value: 'mastered', label: 'Mastered', color: 'success' }
];
