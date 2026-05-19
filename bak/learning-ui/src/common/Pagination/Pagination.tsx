import React from 'react';
import { MdChevronLeft, MdChevronRight } from 'react-icons/md';
import styles from "./Pagination.module.css";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  /** Maximum number of page buttons to show before truncating with ellipses */
  siblingCount?: number;
}

export function Pagination({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  className = '',
  siblingCount = 1 
}: PaginationProps) {
  if (totalPages <= 1) return null;

  // Generate page numbers to display
  const getPageNumbers = () => {
    const totalNumbers = siblingCount * 2 + 3; // siblings + current + first + last
    const totalBlocks = totalNumbers + 2; // + 2 for ellipses

    if (totalPages <= totalBlocks) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

    const showLeftEllipsis = leftSiblingIndex > 2;
    const showRightEllipsis = rightSiblingIndex < totalPages - 1;

    const firstPageIndex = 1;
    const lastPageIndex = totalPages;

    if (!showLeftEllipsis && showRightEllipsis) {
      const leftItemCount = 3 + 2 * siblingCount;
      const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
      return [...leftRange, '...', lastPageIndex];
    }

    if (showLeftEllipsis && !showRightEllipsis) {
      const rightItemCount = 3 + 2 * siblingCount;
      const rightRange = Array.from({ length: rightItemCount }, (_, i) => totalPages - rightItemCount + i + 1);
      return [firstPageIndex, '...', ...rightRange];
    }

    if (showLeftEllipsis && showRightEllipsis) {
      const middleRange = Array.from({ length: rightSiblingIndex - leftSiblingIndex + 1 }, (_, i) => leftSiblingIndex + i);
      return [firstPageIndex, '...', ...middleRange, '...', lastPageIndex];
    }

    return [];
  };

  const pages = getPageNumbers();

  return (
    <nav className={`${styles.container} ${className}`} aria-label="Pagination">
      <button
        className={`${styles.pageBtn} ${styles.navBtn}`}
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Previous page"
      >
        <MdChevronLeft size={20} />
      </button>

      {pages.map((page, index) => {
        if (page === '...') {
          return <span key={`ellipsis-${index}`} className={styles.ellipsis}>&hellip;</span>;
        }

        return (
          <button
            key={page}
            className={`${styles.pageBtn} ${currentPage === page ? styles.active : ''}`}
            onClick={() => onPageChange(page as number)}
            aria-current={currentPage === page ? 'page' : undefined}
          >
            {page}
          </button>
        );
      })}

      <button
        className={`${styles.pageBtn} ${styles.navBtn}`}
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
      >
        <MdChevronRight size={20} />
      </button>
    </nav>
  );
}
