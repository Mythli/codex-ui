import {
  useEffect,
  useState
} from "react";
import type { CodexWorkSegment } from "@coder/types";
import { FiChevronRight } from "react-icons/fi";
import { TextShimmer, type MarkdownComponents } from "@app/common/pure";
import { WorkEntryList } from "./WorkEntryList";
import { formatDuration } from "./transcriptFormatters";
import { useElapsedMs } from "./transcriptState";
import styles from "./Transcript.module.css";

export function WorkSection({
  block,
  cwd,
  markdownComponents,
  nowMs
}: {
  block: CodexWorkSegment;
  cwd?: string;
  markdownComponents?: MarkdownComponents;
  nowMs?: number;
}) {
  const state = block.status === "failed" ? "error" : block.status === "running" ? "working" : "done";
  const elapsedMs = useElapsedMs({
    durationMs: block.durationMs,
    nowMs,
    startedAtMs: block.startedAtMs,
    state
  });
  const [expanded, setExpanded] = useState(block.headline.defaultExpanded);

  useEffect(() => {
    setExpanded(block.headline.defaultExpanded);
  }, [block.headline.defaultExpanded, block.id, block.status]);

  return (
    <article
      aria-label={`${state === "working" ? "Running" : state === "error" ? "Failed" : "Completed"} work block`}
      className={[styles.message, styles.message_activity].join(" ")}
      data-block-id={block.id}
      data-work-entry-count={block.entries.length}
      data-row-state={state}
      data-row-type="work"
      data-testid="transcript-work-block"
    >
      <WorkDivider
        expanded={expanded}
        active={state === "working"}
        label={block.headline.label}
        onToggle={() => setExpanded((current) => !current)}
        timeLabel={state === "working" ? formatDuration(elapsedMs) : block.headline.durationLabel ?? formatDuration(elapsedMs)}
      />
      {expanded ? (
        <WorkEntryList cwd={cwd} entries={block.entries} markdownComponents={markdownComponents} />
      ) : null}
    </article>
  );
}

export function WorkDivider({
  active = false,
  expanded,
  label,
  onToggle,
  timeLabel
}: {
  active?: boolean;
  expanded: boolean;
  label: string;
  onToggle: () => void;
  timeLabel?: string;
}) {
  return (
    <button
      aria-expanded={expanded}
      aria-label={`${label} for ${timeLabel ?? "a moment"}`}
      className={styles.workDivider}
      data-work-divider-expanded={expanded ? "true" : "false"}
      data-testid="work-block-toggle"
      onClick={onToggle}
      type="button"
    >
      <span className={styles.workDividerLabel}>
        {active ? (
          <TextShimmer>
            {label} for {timeLabel ?? "a moment"}
          </TextShimmer>
        ) : (
          <>
            {label} for {timeLabel ?? "a moment"}
          </>
        )}
      </span>
      <FiChevronRight aria-hidden="true" className={styles.workDividerChevron} />
      <span className={styles.workDividerLine} />
    </button>
  );
}
