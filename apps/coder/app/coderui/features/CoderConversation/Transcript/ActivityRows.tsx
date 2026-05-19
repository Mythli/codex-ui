import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { CodexActivitySummaryEntry, CodexCurrentActivity } from "@taylordb/codex";
import {
  FiBox,
  FiChevronRight,
  FiFileText,
  FiGlobe,
  FiSearch,
  FiTerminal,
  FiTool
} from "react-icons/fi";
import { TextShimmer } from "../../../common";
import { displayShellCommand } from "./transcriptFormatters";
import { isActiveStatus } from "./transcriptState";
import styles from "./Transcript.module.css";

export type WorkIconKind = "command" | "file" | "mcp" | "browser" | "web" | "other";

export function CurrentActivityRow({ activity }: { activity: CodexCurrentActivity }) {
  const command = activity.command ? displayShellCommand(activity.command) : undefined;
  return (
    <div
      className={styles.currentActivityRow}
      data-current-activity-type={activity.type}
      data-testid="work-current-activity"
    >
      <WorkIcon kind={activity.icon} />
      <div className={styles.currentActivityBody}>
        <div className={styles.currentActivityTitle}>
          <TextShimmer>{activity.title}</TextShimmer>
        </div>
        {activity.description ? <div className={styles.currentActivityDescription}>{activity.description}</div> : null}
        {command ? <pre className={styles.currentActivityCommand}>$ {command}</pre> : null}
      </div>
    </div>
  );
}

export function ActivitySummaryRow({
  children,
  entry
}: {
  children: ReactNode;
  entry: CodexActivitySummaryEntry;
}) {
  const [expanded, setExpanded] = useState(entry.defaultExpanded);
  const isActive = isActiveStatus(entry.status);

  useEffect(() => {
    setExpanded(entry.defaultExpanded);
  }, [entry.id, entry.defaultExpanded]);

  return (
    <div
      className={[styles.activityGroup, isActive ? styles.workActivityActive : ""].filter(Boolean).join(" ")}
      data-work-entry-state={entry.status}
      data-work-entry-type="activitySummary"
      data-testid="work-entry-activity-summary"
    >
      <button
        aria-expanded={expanded}
        aria-label={entry.label}
        className={styles.activitySummaryButton}
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <WorkIcon kind={entry.icon} />
        <span className={styles.workActivityLabel}>
          {isActive ? <TextShimmer>{entry.label}</TextShimmer> : entry.label}
        </span>
        <FiChevronRight aria-hidden="true" className={styles.activityChevron} />
      </button>
      <ActivityDetails expanded={expanded}>{children}</ActivityDetails>
    </div>
  );
}

export function CommandTimelineRow({
  children,
  canExpand,
  entry
}: {
  children: ReactNode;
  canExpand: boolean;
  entry: { defaultExpanded?: boolean; status?: string; title: string };
}) {
  const [expanded, setExpanded] = useState(entry.defaultExpanded);
  const isActive = isActiveStatus(entry.status);

  useEffect(() => {
    setExpanded(entry.defaultExpanded);
  }, [entry.defaultExpanded, entry.title]);

  return (
    <div
      className={[styles.timelineCommandRow, isActive ? styles.workActivityActive : ""].filter(Boolean).join(" ")}
      data-work-entry-state={entry.status}
      data-work-entry-title={entry.title}
      data-work-entry-type="command"
      data-testid="work-entry"
    >
      {canExpand ? (
        <button
          aria-expanded={expanded}
          aria-label={entry.title}
          className={styles.timelineCommandButton}
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          <span className={styles.workActivityLabel}>{isActive ? <TextShimmer>{entry.title}</TextShimmer> : entry.title}</span>
          <FiChevronRight aria-hidden="true" className={styles.activityChevron} />
        </button>
      ) : (
        <div className={styles.timelineCommandText}>{entry.title}</div>
      )}
      <ActivityDetails expanded={Boolean(expanded)}>{children}</ActivityDetails>
    </div>
  );
}

export function ActivityChildRow({
  children,
  defaultExpanded = false,
  icon,
  status,
  title
}: {
  children: ReactNode;
  defaultExpanded?: boolean;
  icon: WorkIconKind;
  status?: string;
  title: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isActive = isActiveStatus(status);

  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded, title]);

  return (
    <div
      className={[styles.activityChildRow, isActive ? styles.workActivityActive : ""].filter(Boolean).join(" ")}
      data-work-entry-state={status}
      data-work-entry-title={title}
      data-work-entry-type={icon}
      data-testid="work-entry"
    >
      <button
        aria-expanded={expanded}
        aria-label={title}
        className={styles.activityChildButton}
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <WorkIcon kind={icon} />
        <span className={styles.workActivityLabel}>{isActive ? <TextShimmer>{title}</TextShimmer> : title}</span>
        <FiChevronRight aria-hidden="true" className={styles.activityChevron} />
      </button>
      <ActivityDetails expanded={expanded}>{children}</ActivityDetails>
    </div>
  );
}

export function ActivityDetails({ children, expanded }: { children: ReactNode; expanded: boolean }) {
  if (!expanded) {
    return null;
  }
  return <div className={styles.workActivityDetails}>{children}</div>;
}

export function WorkIcon({ kind }: { kind: WorkIconKind }) {
  const Icon = {
    browser: FiGlobe,
    command: FiTerminal,
    file: FiFileText,
    mcp: FiBox,
    other: FiTool,
    web: FiSearch
  }[kind];
  return <Icon aria-hidden="true" className={styles.workIcon} />;
}
