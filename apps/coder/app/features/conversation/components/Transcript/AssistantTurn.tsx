import type { CodexAssistantTurnBlock } from "@taylordb/codex";
import type { MarkdownComponents } from "@app/common/pure";
import { FileChangeSummaryCard } from "./FileChangeRows";
import { AssistantMessage } from "./MessageArticle";
import { WorkSection } from "./WorkSection";

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
        <FileChangeSummaryCard cwd={block.cwd} entry={block.artifacts.filesChanged} />
      ) : null}
    </>
  );
}
