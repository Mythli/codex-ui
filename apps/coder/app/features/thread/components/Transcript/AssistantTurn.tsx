import type { CodexAssistantTurnBlock } from "@coder/types";
import { TextShimmer, type MarkdownComponents } from "@app/common/pure";
import { WorkIcon } from "./ActivityRows";
import { FileChangeSummaryCard } from "./FileChangeRows";
import { AssistantMessage } from "./MessageArticle";
import { WorkSection } from "./WorkSection";
import styles from "./Transcript.module.css";

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
      {block.displayState === "thinking-placeholder" && block.segments.length === 0 ? <ThinkingPlaceholder /> : null}
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
        <FileChangeSummaryCard cwd={block.cwd} entry={block.artifacts.filesChanged} />
      ) : null}
    </>
  );
}

function ThinkingPlaceholder() {
  return (
    <div
      aria-label="Thinking"
      className={[styles.message, styles.message_activity].join(" ")}
      data-row-state="working"
      data-row-type="thinking-placeholder"
      data-testid="thinking-placeholder"
    >
      <div className={styles.currentActivityRow}>
        <WorkIcon kind="other" />
        <div className={styles.currentActivityBody}>
          <div className={styles.currentActivityTitle}>
            <TextShimmer>Thinking</TextShimmer>
          </div>
        </div>
      </div>
    </div>
  );
}
