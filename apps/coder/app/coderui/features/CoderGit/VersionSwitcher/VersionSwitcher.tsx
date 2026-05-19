import { useEffect, useRef, useState } from "react";
import type { GitCommit, GitSnapshot } from "@taylordb/git-observer";
import { FiCheck, FiChevronDown, FiGitBranch } from "react-icons/fi";
import { Button, MenuItem, MenuList, Popover, Spinner } from "../../../common";
import styles from "./VersionSwitcher.module.css";

export type VersionSwitcherProps = {
  className?: string;
  commits: GitCommit[];
  currentHead?: GitSnapshot["head"];
  disabled?: boolean;
  error?: string;
  hasMore?: boolean;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onSelectCommit?: (commit: GitCommit) => void | Promise<void>;
};

export function VersionSwitcher({
  className,
  commits,
  currentHead,
  disabled = false,
  error,
  hasMore = false,
  isLoading = false,
  isLoadingMore = false,
  onLoadMore,
  onSelectCommit
}: VersionSwitcherProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [pendingCommitHash, setPendingCommitHash] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | undefined>(undefined);
  const displayedError = selectionError ?? error;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || isLoading || isLoadingMore || !onLoadMore) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          onLoadMore();
        }
      },
      { root: sentinel.parentElement, rootMargin: "80px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, onLoadMore]);

  return (
    <Popover
      contentClassName={styles.overlayShell}
      renderTrigger={({ ref, isOpen, props }) => (
        <span className={className} ref={ref} {...(disabled ? {} : props)}>
          <Button
            className={isOpen ? styles.triggerActive : undefined}
            disabled={disabled}
            title="Switch commits"
            type="button"
            variant="ghost"
          >
            <FiGitBranch aria-hidden="true" />
            <FiChevronDown aria-hidden="true" />
          </Button>
        </span>
      )}
    >
      {({ close }) => (
        <>
          <header className={styles.header}>
            <span className={styles.title}>{pendingCommitHash ? "Switching version" : "Versions"}</span>
            {currentHead ? <span className={styles.head}>{currentHead.slice(0, 7)}</span> : null}
          </header>
          <MenuList className={[styles.list, "coder-scrollbar-thin"].join(" ")}>
            {isLoading && commits.length === 0 ? (
              <div className={styles.stateRow}>
                <Spinner />
                <span>Loading versions</span>
              </div>
            ) : displayedError && commits.length === 0 ? (
              <div className={styles.stateRow}>{displayedError}</div>
            ) : commits.length === 0 ? (
              <div className={styles.stateRow}>No versions yet</div>
            ) : (
              <>
                {displayedError ? <div className={styles.errorRow}>{displayedError}</div> : null}
                {commits.map((commit, index) => {
                  const isActive = commit.hash === currentHead;
                  const isPending = commit.hash === pendingCommitHash;
                  return (
                    <MenuItem
                      disabled={isActive || Boolean(pendingCommitHash)}
                      description={formatCommitMeta(commit)}
                      key={commit.hash}
                      label={(
                        <span className={styles.labelLine}>
                          <span className={styles.label}>v{commits.length - index}</span>
                          <span className={styles.message}>{commit.message || commit.hash.slice(0, 7)}</span>
                        </span>
                      )}
                      leadingIcon={<FiGitBranch aria-hidden="true" />}
                      onSelect={async () => {
                        if (!onSelectCommit) {
                          return;
                        }

                        setPendingCommitHash(commit.hash);
                        setSelectionError(undefined);
                        try {
                          await onSelectCommit(commit);
                          close();
                        } catch (selectError) {
                          setSelectionError(String(selectError instanceof Error ? selectError.message : selectError));
                        } finally {
                          setPendingCommitHash(null);
                        }
                      }}
                      selected={isActive}
                      trailing={isPending ? (
                        <span className={styles.rowSpinner} aria-label="Switching version">
                          <Spinner />
                        </span>
                      ) : isActive ? <FiCheck aria-hidden="true" className={styles.check} /> : null}
                    />
                  );
                })}
              </>
            )}
            {isLoadingMore ? (
              <div className={styles.stateRow}>
                <Spinner />
                <span>Loading more</span>
              </div>
            ) : null}
            <div className={styles.sentinel} ref={sentinelRef} />
          </MenuList>
        </>
      )}
    </Popover>
  );
}

function formatCommitMeta(commit: GitCommit) {
  const parts = [formatDateLabel(commit.date), commit.authorName].filter(Boolean);
  return parts.join(" by ") || commit.hash.slice(0, 12);
}

function formatDateLabel(date?: string) {
  if (!date) {
    return undefined;
  }

  const timestamp = new Date(date).getTime();
  if (!Number.isFinite(timestamp)) {
    return undefined;
  }

  const elapsedMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) {
    return "now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days}d ago`;
  }
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(timestamp)
  );
}
