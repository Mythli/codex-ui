import React from 'react';
import { MdEdit, MdCheckBox, MdCheckBoxOutlineBlank } from 'react-icons/md';
import { PureBadge, BadgeColor } from "../../../../common/Badge/PureBadge";
import { Table } from "../../../../common/Table/Table";
import { Skeleton } from "../../../../common/Skeleton/Skeleton";
import styles from "./PureVocabTable.module.css";

const stripMarkdown = (md: string) => {
  if (!md) return '';
  // Safe, regex-based markdown stripping to avoid DOM injection/XSS risks
  return md
    .replace(/```[\s\S]*?```/g, '') // Fenced code blocks
    .replace(/^#+\s+/gm, '') // Headers
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // Bold
    .replace(/(\*|_)(.*?)\1/g, '$2') // Italic
    .replace(/~~(.*?)~~/g, '$1') // Strikethrough
    .replace(/`([^`]+)`/g, '$1') // Inline code
    .replace(/!\[.*?\]\(.*?\)/g, '') // Images
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links
    .replace(/\n/g, ' ') // Newlines to spaces
    .trim();
};

export interface VocabTableRow {
  id: string;
  frontSummary: string;
  tags: { id: string; label: string; color?: BadgeColor }[];
  status: 'new' | 'learning' | 'due' | 'mastered';
}

export interface PureVocabTableProps {
  data: VocabTableRow[];
  selectedIds: string[];
  onToggleSelect: (id: string, isShiftPressed: boolean) => void;
  onToggleSelectAll: () => void;
  onEdit: (id: string) => void;
}

export function PureVocabTable({ data, selectedIds, onToggleSelect, onToggleSelectAll, onEdit }: PureVocabTableProps) {
  const allSelected = data.length > 0 && selectedIds.length === data.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  const getStatusColor = (status: string): BadgeColor => {
    switch (status) {
      case 'new': return 'info';
      case 'learning': return 'primary';
      case 'due': return 'warning';
      case 'mastered': return 'success';
      default: return 'default';
    }
  };

  return (
    <div className={styles.container}>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell className={styles.checkboxCol} align="center">
              <button className={styles.checkBtn} onClick={onToggleSelectAll} aria-label="Select all">
                {allSelected ? <MdCheckBox size={20} className={styles.checkBtnActive} /> : <MdCheckBoxOutlineBlank size={20} opacity={someSelected ? 0.5 : 1} />}
              </button>
            </Table.HeaderCell>
            <Table.HeaderCell className={styles.contentCol}>Card Content</Table.HeaderCell>
            <Table.HeaderCell className={styles.tagsCol}>Tags</Table.HeaderCell>
            <Table.HeaderCell className={styles.statusCol}>Status</Table.HeaderCell>
            <Table.HeaderCell className={styles.actionsCol} align="center"></Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {data.map(row => {
            const isSelected = selectedIds.includes(row.id);
            const strippedText = stripMarkdown(row.frontSummary);
            const displayText = strippedText.length > 80
              ? `${strippedText.slice(0, 80)}...`
              : strippedText;
            
            return (
              <Table.Row key={row.id} variant={isSelected ? 'selected' : 'default'}>
                <Table.Cell className={styles.checkboxCol} align="center">
                  <button className={`${styles.checkBtn} ${isSelected ? styles.checkBtnActive : ''}`} onClick={(e) => onToggleSelect(row.id, e.shiftKey)} aria-label={`Select card ${row.id}`}>
                    {isSelected ? <MdCheckBox size={20} /> : <MdCheckBoxOutlineBlank size={20} />}
                  </button>
                </Table.Cell>
                <Table.Cell className={styles.contentCol}>
                  <div className={styles.frontText} title={strippedText}>
                    {displayText}
                  </div>
                </Table.Cell>
                <Table.Cell className={styles.tagsCol}>
                  <div className={styles.tagsWrapper}>
                    {row.tags.map(tag => (
                      <PureBadge key={tag.id} variant="tinted" color={tag.color || 'default'} size="sm">
                        {tag.label}
                      </PureBadge>
                    ))}
                  </div>
                </Table.Cell>
                <Table.Cell className={styles.statusCol}>
                  <PureBadge variant="solid" color={getStatusColor(row.status)} size="sm">
                    {row.status}
                  </PureBadge>
                </Table.Cell>
                <Table.Cell className={styles.actionsCol} align="center">
                  <button className={styles.editBtn} onClick={() => onEdit(row.id)} aria-label="Edit card">
                    <MdEdit size={18} />
                  </button>
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table>
    </div>
  );
}

export interface PureVocabTableSkeletonProps {
  rowCount?: number;
}

PureVocabTable.Skeleton = function PureVocabTableSkeleton({ rowCount = 4 }: PureVocabTableSkeletonProps) {
  // Predefined widths to avoid hydration mismatches from Math.random()
  const contentWidths = ['70%', '45%', '85%', '55%'];
  
  return (
    <div className={styles.container}>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell className={styles.checkboxCol} align="center">
              <Skeleton variant="rectangular" width={20} height={20} />
            </Table.HeaderCell>
            <Table.HeaderCell className={styles.contentCol}>Card Content</Table.HeaderCell>
            <Table.HeaderCell className={styles.tagsCol}>Tags</Table.HeaderCell>
            <Table.HeaderCell className={styles.statusCol}>Status</Table.HeaderCell>
            <Table.HeaderCell className={styles.actionsCol} align="center"></Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {Array.from({ length: rowCount }).map((_, i) => (
            <Table.Row key={i}>
              <Table.Cell className={styles.checkboxCol} align="center">
                <Skeleton variant="rectangular" width={20} height={20} />
              </Table.Cell>
              <Table.Cell className={styles.contentCol}>
                <Skeleton variant="text" width={contentWidths[i % contentWidths.length]} />
              </Table.Cell>
              <Table.Cell className={styles.tagsCol}>
                <div className={styles.tagsWrapper}>
                  <Skeleton variant="rectangular" width={60} height={24} />
                  {i % 2 === 0 && <Skeleton variant="rectangular" width={80} height={24} />}
                </div>
              </Table.Cell>
              <Table.Cell className={styles.statusCol}>
                <Skeleton variant="rectangular" width={70} height={24} />
              </Table.Cell>
              <Table.Cell className={styles.actionsCol} align="center">
                <Skeleton variant="circular" width={24} height={24} />
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
};
