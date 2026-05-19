import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  FiBox,
  FiCheck,
  FiChevronRight,
  FiCopy,
  FiEdit3,
  FiFileText,
  FiGlobe,
  FiSearch,
  FiTerminal,
  FiTool
} from "react-icons/fi";
import {
  type CodexActivitySummaryEntry,
  type CodexAssistantTurnBlock,
  type CodexCommandEntry,
  type CodexCurrentActivity,
  type CodexFileChangeEntry,
  type CodexRenderBlock,
  type CodexToolEntry,
  type CodexTranscriptImage,
  type CodexUnsupportedWorkEntry,
  type CodexWorkSegment,
  type CodexWorkEntry
} from "@taylordb/codex";
import { Markdown, TextShimmer, type MarkdownComponents } from "../../../common";
import { FileChangeCard } from "../pure/Transcript/FileChangeCard";
import styles from "./Transcript.module.css";

export function CodexChatView({
  blocks,
  nowMs,
  markdownComponents
}: {
  blocks?: readonly CodexRenderBlock[];
  nowMs?: number;
  markdownComponents?: MarkdownComponents;
}) {
  return <TranscriptViewport blocks={blocks ?? []} markdownComponents={markdownComponents} nowMs={nowMs} />;
}

export function TranscriptViewport({
  blocks,
  children,
  markdownComponents,
  nowMs
}: {
  blocks?: readonly CodexRenderBlock[];
  children?: ReactNode;
  markdownComponents?: MarkdownComponents;
  nowMs?: number;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const signature = useMemo(() => blockSignature(blocks ?? []), [blocks]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const scrollToBottom = () => {
      viewport.scrollTo({ top: viewport.scrollHeight });
    };
    scrollToBottom();
    const frame = window.requestAnimationFrame(scrollToBottom);
    return () => window.cancelAnimationFrame(frame);
  }, [signature]);

  return (
    <div
      aria-label="Chat transcript"
      className={`${styles.messages} coder-scrollbar-thin`}
      data-codex-chat-view
      data-testid="chat-transcript"
      ref={viewportRef}
      role="log"
    >
      {children ?? <TranscriptBlockList blocks={blocks ?? []} markdownComponents={markdownComponents} nowMs={nowMs} />}
    </div>
  );
}

export function TranscriptBlockList({
  blocks,
  markdownComponents,
  nowMs
}: {
  blocks: readonly CodexRenderBlock[];
  markdownComponents?: MarkdownComponents;
  nowMs?: number;
}) {
  if (blocks.length === 0) {
    return <div className={styles.empty} data-testid="chat-transcript-empty">Start a new chat to see messages here.</div>;
  }

  return (
    <>
      {blocks.map((block) => (
        <TranscriptBlock block={block} key={block.id} markdownComponents={markdownComponents} nowMs={nowMs} />
      ))}
    </>
  );
}

export function TranscriptBlock({
  block,
  markdownComponents,
  nowMs
}: {
  block: CodexRenderBlock;
  markdownComponents?: MarkdownComponents;
  nowMs?: number;
}) {
  switch (block.type) {
    case "userMessage":
      return <UserMessageBubble blockId={block.id} cwd={block.cwd} images={block.images} markdownComponents={markdownComponents} text={block.text} />;
    case "assistantTurn":
      return <AssistantTurn block={block} markdownComponents={markdownComponents} nowMs={nowMs} />;
    case "image":
      return <TranscriptImageStrip blockId={block.id} images={block.images} />;
    default:
      return null;
  }
}

export function AssistantTurn({
  block,
  markdownComponents,
  nowMs
}: {
  block: CodexAssistantTurnBlock;
  markdownComponents?: MarkdownComponents;
  nowMs?: number;
}) {
  return (
    <>
      {block.segments.map((segment) => {
        if (segment.type === "assistantText") {
          return (
            <AssistantMessage
              blockId={segment.id}
              cwd={block.cwd}
              final={segment.final}
              key={segment.id}
              markdownComponents={markdownComponents}
              text={segment.text}
            />
          );
        }
        return <WorkSection block={segment} cwd={block.cwd} key={segment.id} markdownComponents={markdownComponents} nowMs={nowMs} />;
      })}
      {block.artifacts.filesChanged ? (
        <FileChangeCard cwd={block.cwd} entry={block.artifacts.filesChanged} />
      ) : null}
    </>
  );
}

export function UserMessageBubble({
  blockId,
  cwd,
  images,
  markdownComponents,
  text
}: {
  blockId?: string;
  cwd?: string;
  images?: readonly CodexTranscriptImage[];
  markdownComponents?: MarkdownComponents;
  text: string;
}) {
  return (
    <MessageArticle
      cwd={cwd}
      blockId={blockId}
      markdownComponents={markdownComponents}
      message={{ role: "user", text, images: images ?? [] }}
    />
  );
}

export function AssistantMessage({
  blockId,
  cwd,
  final = true,
  markdownComponents,
  text
}: {
  blockId?: string;
  cwd?: string;
  final?: boolean;
  markdownComponents?: MarkdownComponents;
  text: string;
}) {
  return (
    <MessageArticle
      cwd={cwd}
      blockId={blockId}
      final={final}
      markdownComponents={markdownComponents}
      message={{ role: "assistant", text, images: [] }}
      overlay={final ? <CopyMessageButton text={text} /> : null}
    />
  );
}

export function CopyMessageButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== undefined) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    const success = await copyTextToClipboard(text);
    if (!success) {
      return;
    }
    if (resetTimerRef.current !== undefined) {
      window.clearTimeout(resetTimerRef.current);
    }
    setCopied(true);
    resetTimerRef.current = window.setTimeout(() => setCopied(false), 1200);
  }

  const Icon = copied ? FiCheck : FiCopy;

  return (
    <button
      aria-label={copied ? "Copied response" : "Copy response"}
      className={styles.messageCopyButton}
      data-testid="assistant-message-copy"
      onClick={handleCopy}
      title={copied ? "Copied" : "Copy response"}
      type="button"
    >
      <Icon aria-hidden="true" />
    </button>
  );
}

function MessageArticle({
  blockId,
  cwd,
  final = false,
  markdownComponents,
  message,
  overlay,
  trailing
}: {
  blockId?: string;
  cwd?: string;
  final?: boolean;
  markdownComponents?: MarkdownComponents;
  message: { role: "user" | "assistant" | "system"; text: string; images?: readonly CodexTranscriptImage[] };
  overlay?: ReactNode;
  trailing?: ReactNode;
}) {
  const resolvedMarkdownComponents = useResolvedMarkdownComponents(markdownComponents, cwd);
  const hasOverlay = Boolean(overlay);

  return (
    <article
      aria-label={`${message.role} message`}
      className={[styles.message, styles[`message_${message.role}`], final ? styles.message_final : "", hasOverlay ? styles.message_withOverlay : ""]
        .filter(Boolean)
        .join(" ")}
      data-row-final={final ? "true" : undefined}
      data-block-id={blockId}
      data-row-role={message.role}
      data-row-type="message"
      data-testid={`transcript-${message.role}-message`}
    >
      {overlay}
      {message.images?.length ? <TranscriptImageStrip blockId={blockId} compact images={message.images} /> : null}
      {message.text ? <Markdown components={resolvedMarkdownComponents} text={message.text} /> : null}
      {trailing}
    </article>
  );
}

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
  }, [block.id, block.headline.defaultExpanded]);

  return (
    <article
      aria-label={`${state === "working" ? "Running" : state === "error" ? "Failed" : "Completed"} work block`}
      className={[styles.message, styles.message_activity].join(" ")}
      data-block-id={block.id}
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
      {block.currentActivity ? <CurrentActivityRow activity={block.currentActivity} /> : null}
      {expanded ? (
        <WorkEntryList cwd={cwd} entries={block.entries} hiddenActivityId={block.currentActivity?.id} markdownComponents={markdownComponents} />
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

export function WorkEntryList({
  cwd,
  entries,
  hiddenActivityId,
  markdownComponents
}: {
  cwd?: string;
  entries: readonly CodexWorkEntry[];
  hiddenActivityId?: string;
  markdownComponents?: MarkdownComponents;
}) {
  const visibleEntries = entries.flatMap((entry) => visibleWorkEntries(entry, hiddenActivityId));
  if (visibleEntries.length === 0) {
    return null;
  }

  return (
    <div className={styles.workHistory} data-testid="work-entry-list">
      {visibleEntries.map((entry) => <WorkEntryView cwd={cwd} entry={entry} key={entry.id} markdownComponents={markdownComponents} />)}
    </div>
  );
}

function CurrentActivityRow({ activity }: { activity: CodexCurrentActivity }) {
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

function visibleWorkEntries(entry: CodexWorkEntry, hiddenActivityId: string | undefined): CodexWorkEntry[] {
  if (!hiddenActivityId) {
    return [entry];
  }
  if (entry.id === hiddenActivityId) {
    return [];
  }
  if (entry.type !== "activitySummary") {
    return [entry];
  }
  const items = entry.items.filter((item) => item.id !== hiddenActivityId);
  if (items.length === 0) {
    return [];
  }
  return [{
    ...entry,
    itemIds: entry.itemIds.filter((id) => id !== hiddenActivityId),
    items
  }];
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
  const resolvedMarkdownComponents = useResolvedMarkdownComponents(markdownComponents, cwd);

  switch (entry.type) {
    case "assistantProgress":
      return <div className={styles.workText}><Markdown components={resolvedMarkdownComponents} text={entry.text} /></div>;
    case "reasoning":
      return entry.text ? <div className={styles.workTextMuted}><Markdown components={resolvedMarkdownComponents} text={entry.text} /></div> : null;
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
      return <ActivitySummaryRow cwd={cwd} entry={entry} markdownComponents={markdownComponents} />;
    case "fileChange":
      return <FileChangeTimelineRow cwd={cwd} entry={entry} />;
    case "command":
      return <ActivityChildRow defaultExpanded={entry.defaultExpanded} icon="command" status={entry.status} title={entry.title}><CommandDetails entry={entry} /></ActivityChildRow>;
    case "tool":
      return <ActivityChildRow defaultExpanded={entry.defaultExpanded} icon={entry.icon} status={entry.status} title={entry.title}><ToolDetails entry={entry} /></ActivityChildRow>;
    case "unsupported":
      return <ActivityChildRow defaultExpanded={entry.defaultExpanded} icon="other" status={entry.status} title={entry.title}><UnsupportedDetails entry={entry} /></ActivityChildRow>;
    default:
      return null;
  }
}

function shouldFlattenActivitySummary(entry: CodexActivitySummaryEntry): boolean {
  return entry.items.length === 1 && entry.items[0]?.type === "command";
}

export function ActivitySummaryRow({
  cwd,
  entry,
  markdownComponents
}: {
  cwd?: string;
  entry: CodexActivitySummaryEntry;
  markdownComponents?: MarkdownComponents;
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
      <ActivityDetails expanded={expanded}>
        {entry.items.map((item) => (
          <ActivitySummaryItemView cwd={cwd} entry={item} key={item.id} markdownComponents={markdownComponents} />
        ))}
      </ActivityDetails>
    </div>
  );
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
      return <CommandTimelineRow entry={entry} />;
    case "fileChange":
      return <FileChangeTimelineFiles cwd={cwd} entry={entry} />;
    case "tool":
      return <ActivityChildRow defaultExpanded={entry.defaultExpanded} icon={entry.icon} status={entry.status} title={entry.title}><ToolDetails entry={entry} /></ActivityChildRow>;
    case "unsupported":
      return <ActivityChildRow defaultExpanded={entry.defaultExpanded} icon="other" status={entry.status} title={entry.title}><UnsupportedDetails entry={entry} /></ActivityChildRow>;
    default:
      return <WorkEntryView cwd={cwd} entry={entry} markdownComponents={markdownComponents} />;
  }
}

function CommandTimelineRow({ entry }: { entry: CodexCommandEntry }) {
  const [expanded, setExpanded] = useState(entry.defaultExpanded);
  const isActive = isActiveStatus(entry.status);
  const canExpand = Boolean(entry.command || entry.output || entry.exitCode !== undefined);

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
      <ActivityDetails expanded={expanded}><CommandDetails entry={entry} /></ActivityDetails>
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
  icon: "command" | "file" | "mcp" | "browser" | "web" | "other";
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

export function CommandDetails({ entry }: { entry: CodexCommandEntry }) {
  const command = displayShellCommand(entry.command ?? entry.title);
  const success = entry.exitCode === undefined || entry.exitCode === null || entry.exitCode === 0;

  return (
    <section aria-label="Command details" className={styles.commandDetails} data-testid="command-details" data-work-entry-type="command">
      <div className={styles.shellCard}>
        <div className={styles.shellTitle}>Shell</div>
        <pre className={styles.shellCommand}><span className={styles.shellPrompt}>$</span> {command}</pre>
        {entry.output ? <pre className={`${styles.shellOutput} coder-scrollbar-thin`}>{entry.output.trimEnd()}</pre> : null}
        <div className={success ? styles.shellStatusSuccess : styles.shellStatusError}>
          {success ? "✓ Success" : `Exit ${entry.exitCode}`}
        </div>
      </div>
    </section>
  );
}

export function ToolDetails({ entry }: { entry: CodexToolEntry }) {
  return (
    <section aria-label="Tool details" className={styles.toolDetails} data-testid="tool-details" data-work-entry-type="tool">
      {entry.status ? <DetailLine>status: {entry.status}</DetailLine> : null}
      {entry.images?.length ? <TranscriptImageStrip blockId={entry.id} compact images={entry.images} /> : null}
      {entry.arguments !== undefined ? <JsonDetails label="arguments" value={entry.arguments} /> : null}
      {entry.result !== undefined && entry.result !== null ? <JsonDetails label="result" value={entry.result} /> : null}
      {entry.error !== undefined && entry.error !== null ? <JsonDetails label="error" value={entry.error} /> : null}
    </section>
  );
}

function UnsupportedDetails({ entry }: { entry: CodexUnsupportedWorkEntry }) {
  return <JsonDetails label="unsupported" value={entry.payload} />;
}

function isActiveStatus(status: string | undefined) {
  return status === "inProgress" || status === "running";
}

export function WorkIcon({ kind }: { kind: "command" | "file" | "mcp" | "browser" | "web" | "other" }) {
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

export function FileChangeSummaryCard({ cwd, entry }: { cwd?: string; entry: CodexFileChangeEntry }) {
  if (isActiveStatus(entry.status)) {
    return <FileChangeProgressRow cwd={cwd} entry={entry} />;
  }
  return <FileChangeCard cwd={cwd} entry={entry} />;
}

export function FileChangeTimelineRow({ cwd, entry }: { cwd?: string; entry: CodexFileChangeEntry }) {
  if (isActiveStatus(entry.status)) {
    return <FileChangeProgressRow cwd={cwd} entry={entry} />;
  }
  return (
    <ActivityChildRow defaultExpanded={entry.defaultExpanded} icon="file" status={entry.status} title={entry.title}>
      <FileChangeDetails cwd={cwd} entry={entry} />
    </ActivityChildRow>
  );
}

function FileChangeDetails({ cwd, entry }: { cwd?: string; entry: CodexFileChangeEntry }) {
  return (
    <section aria-label="File change details" className={styles.toolDetails} data-testid="file-change-details" data-work-entry-type="fileChange">
      {entry.files.map((file) => (
        <DetailLine key={file.path}>
          {displayPath(file.path, cwd)} <span className={styles.additions}>+{file.additions ?? 0}</span> <span className={styles.deletions}>-{file.deletions ?? 0}</span>
        </DetailLine>
      ))}
    </section>
  );
}

function FileChangeTimelineFiles({ cwd, entry }: { cwd?: string; entry: CodexFileChangeEntry }) {
  return (
    <div className={styles.fileTimelineList}>
      {entry.files.map((file) => {
        const action = getFileChangePastAction(file.action, file.additions ?? 0, file.deletions ?? 0);
        return (
          <div className={styles.fileTimelineRow} data-testid="work-file-change-row" key={file.path}>
            <span className={styles.fileTimelineAction}>{action}</span>
            <span className={styles.fileTimelinePath}>{displayFileName(file.path, cwd)}</span>
            <span className={styles.additions}>+{file.additions ?? 0}</span>
            <span className={styles.deletions}>-{file.deletions ?? 0}</span>
            <span aria-hidden="true" className={styles.changeDot} />
          </div>
        );
      })}
    </div>
  );
}

export function FileChangeProgressRow({ cwd, entry }: { cwd?: string; entry: CodexFileChangeEntry }) {
  const file = entry.files.at(-1) ?? entry.files[0];
  const additions = file?.additions ?? entry.additions;
  const deletions = file?.deletions ?? entry.deletions;
  const action = getFileChangeAction(entry.title, additions, deletions);

  return (
    <div
      aria-label={file ? `${action} ${displayFileName(file.path, cwd)}` : action}
      className={styles.fileProgressRow}
      data-testid="file-change-progress"
      data-work-entry-state={entry.status}
      data-work-entry-type="fileChange"
    >
      <FiEdit3 aria-hidden="true" className={styles.workIcon} />
      <span className={styles.fileProgressAction}><TextShimmer>{action}</TextShimmer></span>
      {file ? <span className={styles.fileProgressPath}>{displayFileName(file.path, cwd)}</span> : null}
      <span className={styles.additions}>+{additions}</span>
      <span className={styles.deletions}>-{deletions}</span>
    </div>
  );
}

function getFileChangeAction(title: string, additions: number, deletions: number) {
  if (/creat/i.test(title) || (additions > 0 && deletions === 0)) {
    return "Creating";
  }
  if (/delet/i.test(title) || (deletions > 0 && additions === 0)) {
    return "Deleting";
  }
  return "Editing";
}

function getFileChangePastAction(action: string | undefined, additions: number, deletions: number) {
  if (action === "added" || (additions > 0 && deletions === 0)) {
    return "Created";
  }
  if (action === "deleted" || (deletions > 0 && additions === 0)) {
    return "Deleted";
  }
  return "Edited";
}

function displayShellCommand(command: string): string {
  const trimmed = command.trim();
  const shellMatch = trimmed.match(/^\/bin\/(?:zsh|bash|sh)\s+-lc\s+(['"])([\s\S]*)\1$/);
  return shellMatch?.[2] ?? trimmed;
}

function displayFileName(path: string, cwd: string | undefined): string {
  const relative = displayPath(path, cwd);
  return relative.split("/").at(-1) ?? relative;
}

function displayPath(path: string, cwd: string | undefined): string {
  const normalizedCwd = cwd?.replace(/\/+$/, "");
  return normalizedCwd && path.startsWith(`${normalizedCwd}/`)
    ? path.slice(normalizedCwd.length + 1)
    : path;
}

export function TranscriptImageStrip({ blockId, compact = false, images }: { blockId?: string; compact?: boolean; images: readonly CodexTranscriptImage[] }) {
  const className = compact ? styles.messageImages : styles.imageStrip;
  return (
    <div className={className} data-block-id={blockId} data-testid="transcript-images">
      {images.map((image) => (
        <TranscriptImage
          className={styles.messageImage}
          image={image}
          key={image.id}
        />
      ))}
    </div>
  );
}

function DetailLine({ children }: { children: ReactNode }) {
  return <div className={styles.detailLine}>{children}</div>;
}

function JsonDetails({ label, value }: { label: string; value: unknown }) {
  return <OutputBlock text={`${label}: ${safeJson(value)}`} />;
}

function OutputBlock({ text }: { text: string }) {
  return <pre className={`${styles.output} coder-scrollbar-thin`}>{text}</pre>;
}

function imageSrc(image: CodexTranscriptImage) {
  return image.asset?.url ?? image.url ?? image.dataUrl;
}

function TranscriptImage({
  className,
  image
}: {
  className?: string;
  image: CodexTranscriptImage;
}) {
  const src = imageSrc(image);
  return src ? <img alt={image.alt ?? "Image"} className={className} src={src} /> : null;
}

function useResolvedMarkdownComponents(components: MarkdownComponents | undefined, cwd: string | undefined): MarkdownComponents | undefined {
  void cwd;
  return useMemo(() => components, [components]);
}

function useElapsedMs({
  durationMs,
  nowMs: fixedNowMs,
  startedAtMs,
  state
}: {
  durationMs?: number;
  nowMs?: number;
  startedAtMs?: number;
  state: "working" | "done" | "error";
}) {
  const [now, setNow] = useState(() => fixedNowMs ?? Date.now());

  useEffect(() => {
    if (fixedNowMs !== undefined) {
      setNow(fixedNowMs);
      return;
    }
    if (state !== "working") {
      return;
    }
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [fixedNowMs, state]);

  if (state === "working" && startedAtMs) {
    return Math.max(durationMs ?? 0, now - startedAtMs);
  }
  return durationMs;
}

function formatDuration(durationMs: number | undefined) {
  if (!durationMs || durationMs < 1000) {
    return "a moment";
  }
  const seconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes === 0 ? `${seconds}s` : `${minutes}m ${remainder}s`;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to a temporary textarea below.
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.left = "-9999px";
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}

function blockSignature(blocks: readonly CodexRenderBlock[]) {
  return JSON.stringify(blocks);
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
