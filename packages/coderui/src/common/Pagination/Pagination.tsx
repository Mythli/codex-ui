import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import styles from "./Pagination.module.css";

export type PaginationProps = {
  className?: string;
  currentPage: number;
  onPageChange(page: number): void;
  siblingCount?: number;
  totalPages: number;
};

export function Pagination({
  className = "",
  currentPage,
  onPageChange,
  siblingCount = 1,
  totalPages
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const pages = getPageNumbers(currentPage, totalPages, siblingCount);

  return (
    <nav className={[styles.container, className].filter(Boolean).join(" ")} aria-label="Pagination">
      <button
        aria-label="Previous page"
        className={styles.pageBtn}
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        type="button"
      >
        <FiChevronLeft aria-hidden="true" />
      </button>
      {pages.map((page, index) =>
        page === "..." ? (
          <span className={styles.ellipsis} key={`ellipsis-${index}`}>
            ...
          </span>
        ) : (
          <button
            aria-current={currentPage === page ? "page" : undefined}
            className={[styles.pageBtn, currentPage === page ? styles.active : ""].filter(Boolean).join(" ")}
            key={page}
            onClick={() => onPageChange(page)}
            type="button"
          >
            {page}
          </button>
        )
      )}
      <button
        aria-label="Next page"
        className={styles.pageBtn}
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        type="button"
      >
        <FiChevronRight aria-hidden="true" />
      </button>
    </nav>
  );
}

function getPageNumbers(currentPage: number, totalPages: number, siblingCount: number) {
  const totalNumbers = siblingCount * 2 + 3;
  const totalBlocks = totalNumbers + 2;

  if (totalPages <= totalBlocks) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);
  const showLeftEllipsis = leftSiblingIndex > 2;
  const showRightEllipsis = rightSiblingIndex < totalPages - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftItemCount = 3 + 2 * siblingCount;
    return [...Array.from({ length: leftItemCount }, (_, index) => index + 1), "...", totalPages] as const;
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    const rightItemCount = 3 + 2 * siblingCount;
    return [
      1,
      "...",
      ...Array.from({ length: rightItemCount }, (_, index) => totalPages - rightItemCount + index + 1)
    ] as const;
  }

  return [
    1,
    "...",
    ...Array.from(
      { length: rightSiblingIndex - leftSiblingIndex + 1 },
      (_, index) => leftSiblingIndex + index
    ),
    "...",
    totalPages
  ] as const;
}
