import type { ReactNode } from "react";
import type {
  CodexCommandEntry,
  CodexToolEntry,
  CodexUnsupportedWorkEntry
} from "@taylordb/codex";
import { TranscriptImageStrip } from "./TranscriptImages";
import { displayShellCommand, safeJson } from "./transcriptFormatters";
import styles from "./Transcript.module.css";

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

export function UnsupportedDetails({ entry }: { entry: CodexUnsupportedWorkEntry }) {
  return <JsonDetails label="unsupported" value={entry.payload} />;
}

export function DetailLine({ children }: { children: ReactNode }) {
  return <div className={styles.detailLine}>{children}</div>;
}

export function JsonDetails({ label, value }: { label: string; value: unknown }) {
  return <OutputBlock text={`${label}: ${safeJson(value)}`} />;
}

export function OutputBlock({ text }: { text: string }) {
  return <pre className={`${styles.output} coder-scrollbar-thin`}>{text}</pre>;
}
