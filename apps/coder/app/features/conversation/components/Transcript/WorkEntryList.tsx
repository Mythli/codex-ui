import type {
  CodexActivitySummaryEntry,
  CodexCommandEntry,
  CodexWorkEntry
} from "@taylordb/codex";
import { Markdown, type MarkdownComponents } from "@app/common/pure";
import {
  ActivityChildRow,
  ActivitySummaryRow,
  CommandTimelineRow
} from "./ActivityRows";
import {
  FileChangeTimelineFiles,
  FileChangeTimelineRow
} from "./FileChangeRows";
import {
  CommandDetails,
  ToolDetails,
  UnsupportedDetails
} from "./WorkDetails";
import {
  shouldFlattenActivitySummary
} from "./transcriptState";
import styles from "./Transcript.module.css";

export function WorkEntryList({
  cwd,
  entries,
  markdownComponents
}: {
  cwd?: string;
  entries: readonly CodexWorkEntry[];
  markdownComponents?: MarkdownComponents;
}) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div aria-label="Work timeline entries" className={styles.workHistory} data-testid="work-entry-list" role="group">
      {entries.map((entry) => <WorkEntryView cwd={cwd} entry={entry} key={entry.id} markdownComponents={markdownComponents} />)}
    </div>
  );
}

export function WorkEntryView({
  cwd,
  entry,
  markdownComponents
}: {
  cwd?: string;
  entry: CodexWorkEntry;
  markdownComponents?: MarkdownComponents;
}) {
  switch (entry.type) {
    case "assistantProgress":
      return <div className={styles.workText}><Markdown components={markdownComponents} text={entry.text} /></div>;
    case "reasoning":
      return entry.text ? <div className={styles.workTextMuted}><Markdown components={markdownComponents} text={entry.text} /></div> : null;
    case "activitySummary":
      if (shouldFlattenActivitySummary(entry)) {
        return (
          <>
            {entry.items.map((item) => (
              <ActivitySummaryItemView cwd={cwd} entry={item} key={item.id} markdownComponents={markdownComponents} />
            ))}
          </>
        );
      }
      return (
        <ActivitySummaryRow entry={entry}>
          {entry.items.map((item) => (
            <ActivitySummaryItemView cwd={cwd} entry={item} key={item.id} markdownComponents={markdownComponents} />
          ))}
        </ActivitySummaryRow>
      );
    case "fileChange":
      return <FileChangeTimelineRow cwd={cwd} entry={entry} />;
    case "command":
      return <CommandActivityRow entry={entry} />;
    case "tool":
      return <ActivityChildRow defaultExpanded={entry.defaultExpanded} icon={entry.icon} id={entry.id} status={entry.status} title={entry.title}><ToolDetails entry={entry} /></ActivityChildRow>;
    case "unsupported":
      return <ActivityChildRow defaultExpanded={entry.defaultExpanded} icon="other" id={entry.id} status={entry.status} title={entry.title}><UnsupportedDetails entry={entry} /></ActivityChildRow>;
    default:
      return null;
  }
}

function ActivitySummaryItemView({
  cwd,
  entry,
  markdownComponents
}: {
  cwd?: string;
  entry: CodexActivitySummaryEntry["items"][number];
  markdownComponents?: MarkdownComponents;
}) {
  switch (entry.type) {
    case "command":
      return <CommandActivityRow entry={entry} />;
    case "fileChange":
      return <FileChangeTimelineFiles cwd={cwd} entry={entry} />;
    case "tool":
      return <ActivityChildRow defaultExpanded={entry.defaultExpanded} icon={entry.icon} id={entry.id} status={entry.status} title={entry.title}><ToolDetails entry={entry} /></ActivityChildRow>;
    case "unsupported":
      return <ActivityChildRow defaultExpanded={entry.defaultExpanded} icon="other" id={entry.id} status={entry.status} title={entry.title}><UnsupportedDetails entry={entry} /></ActivityChildRow>;
    default:
      return <WorkEntryView cwd={cwd} entry={entry} markdownComponents={markdownComponents} />;
  }
}

function CommandActivityRow({ entry }: { entry: CodexCommandEntry }) {
  const canExpand = Boolean(entry.command || entry.output || entry.exitCode !== undefined);
  return (
    <CommandTimelineRow canExpand={canExpand} entry={entry}>
      <CommandDetails entry={entry} />
    </CommandTimelineRow>
  );
}
