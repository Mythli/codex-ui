import type { ActivityItem, WorkBlockNode, WorkItem } from "../types";
import { Markdown } from "./Markdown";
import { ToolSummaryGroup } from "./ToolSummary";

type WorkSegment =
  | { id: string; type: "assistantNote"; text: string }
  | { id: string; type: "toolGroup"; activities: ActivityItem[] };

export function WorkBlock({
  node,
  onToggle
}: {
  node: WorkBlockNode;
  onToggle: (open: boolean) => void;
}) {
  const open = node.state === "working" ? true : node.open;
  const segments = groupWorkItems(node.items);

  return (
    <article className="message activity">
      <details className="workMarker" open={open}>
        <summary
          onClick={(event) => {
            event.preventDefault();
            if (node.state !== "working") {
              onToggle(!node.open);
            }
          }}
        >
          <span>Worked for {formatDuration(node.durationMs)}</span>
        </summary>
        <div className="workHistory" key={`${node.id}-${node.state}-${open ? "open" : "closed"}`}>
          {node.items.length === 0 ? (
            <div className="activityEmpty">Working...</div>
          ) : (
            segments.map((item) =>
              item.type === "assistantNote" ? (
                <div className="workAssistantNote" key={item.id}>
                  <Markdown>{item.text}</Markdown>
                </div>
              ) : (
                <ToolSummaryGroup activities={item.activities} key={item.id} />
              )
            )
          )}
        </div>
      </details>
    </article>
  );
}

function groupWorkItems(items: WorkItem[]): WorkSegment[] {
  const segments: WorkSegment[] = [];
  let pendingTools: ActivityItem[] = [];

  const flushTools = () => {
    if (pendingTools.length === 0) {
      return;
    }
    segments.push({
      id: `tools-${segments.length}-${pendingTools.map((activity) => activity.id).join("-")}`,
      type: "toolGroup",
      activities: pendingTools
    });
    pendingTools = [];
  };

  for (const item of items) {
    if (item.type === "toolSummary") {
      pendingTools.push(item.activity);
    } else {
      flushTools();
      segments.push({
        id: item.id,
        type: "assistantNote",
        text: item.text
      });
    }
  }

  flushTools();
  return segments;
}

function formatDuration(durationMs: number | undefined) {
  if (!durationMs || durationMs < 1000) {
    return "a moment";
  }
  const seconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${remainder}s`;
}
