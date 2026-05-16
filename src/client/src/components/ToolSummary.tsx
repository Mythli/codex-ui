import { FiBox, FiFileText, FiGlobe, FiNavigation, FiTerminal, FiTool } from "react-icons/fi";
import type { ActivityItem } from "../types";

export function ToolSummaryGroup({ activities }: { activities: ActivityItem[] }) {
  if (activities.length === 0) {
    return null;
  }

  if (activities.length === 1) {
    return <ToolSummary activity={activities[0]} />;
  }

  return (
    <details className="activityItem activityGroup">
      <summary>
        <div className="activityLine">
          <span className={`activityIcon ${dominantActivityKind(activities)}`}>
            {activityIcon(dominantActivityKind(activities))}
          </span>
          <div>
            <div className="activityTitle">{activitySummary(activities)}</div>
          </div>
        </div>
      </summary>
      <div className="activityGroupItems">
        {activities.map((activity) => (
          <ToolSummary activity={activity} key={activity.id} />
        ))}
      </div>
    </details>
  );
}

export function ToolSummary({ activity }: { activity: ActivityItem }) {
  const files = activity.files ?? [];
  const expandable = files.length > 0 || Boolean(activity.output);
  const summary = (
    <div className="activityLine">
      <span className={`activityIcon ${activity.kind}`}>{activityIcon(activity.kind)}</span>
      <div>
        <div className="activityTitle">{activity.title}</div>
        {activity.detail && <div className="activityMeta">{activity.detail}</div>}
      </div>
      {activity.status && <span className="activityStatus">{activity.status}</span>}
    </div>
  );
  const details = (
    <>
      {files.length > 0 && (
        <div className="fileChangeList">
          {files.map((file) => (
            <div className="fileChangeRow" key={`${file.path}-${file.additions}-${file.deletions}`}>
              <span>
                {file.action ?? "Edited"} <b>{compactPath(file.path)}</b>
              </span>
              <small>
                <b>+{file.additions}</b> <i>-{file.deletions}</i>
              </small>
            </div>
          ))}
        </div>
      )}
      {activity.output && <pre>{activity.output}</pre>}
    </>
  );

  if (!expandable) {
    return <div className="activityItem">{summary}</div>;
  }

  return (
    <details className="activityItem">
      <summary>{summary}</summary>
      {details}
    </details>
  );
}

export function activityIcon(kind: ActivityItem["kind"]) {
  if (kind === "command") {
    return <FiTerminal />;
  }
  if (kind === "file") {
    return <FiFileText />;
  }
  if (kind === "mcp") {
    return <FiTool />;
  }
  if (kind === "browser") {
    return <FiNavigation />;
  }
  if (kind === "web") {
    return <FiGlobe />;
  }
  return <FiBox />;
}

export function dominantActivityKind(activities: ActivityItem[]): ActivityItem["kind"] {
  return activities.find((activity) => activity.kind === "file")?.kind
    ?? activities.find((activity) => activity.kind === "command")?.kind
    ?? activities.find((activity) => activity.kind === "browser")?.kind
    ?? activities[0]?.kind
    ?? "other";
}

export function activitySummary(activities: ActivityItem[]) {
  if (activities.length === 0) {
    return "Working";
  }

  const files = activities.reduce((sum, activity) => sum + (activity.files?.length ?? 0), 0);
  const commands = activities.filter((activity) => activity.kind === "command").length;
  const browser = activities.filter((activity) => activity.kind === "browser").length;
  const tools = activities.filter((activity) => activity.kind === "mcp" || activity.kind === "other").length;
  const searches = activities.filter((activity) => activity.kind === "web").length;
  const parts = [];
  if (files > 0) {
    const changed = activities.filter((activity) => activity.kind === "file").length;
    parts.push(`${changed > 0 ? "Edited" : "Explored"} ${files} file${files === 1 ? "" : "s"}`);
  }
  if (commands > 0) {
    parts.push(`${parts.length > 0 ? "ran" : "Ran"} ${commands} command${commands === 1 ? "" : "s"}`);
  }
  if (browser > 0) {
    parts.push(browser === 1 ? "Used the browser" : `Used the browser ${browser} times`);
  }
  if (searches > 0) {
    parts.push(`${parts.length > 0 ? "explored" : "Explored"} ${searches} search${searches === 1 ? "" : "es"}`);
  }
  if (tools > 0) {
    parts.push(`${parts.length > 0 ? "used" : "Used"} ${tools} tool${tools === 1 ? "" : "s"}`);
  }

  return parts.length > 0 ? parts.join(", ") : `${activities.length} event${activities.length === 1 ? "" : "s"}`;
}

function compactPath(path: string) {
  const cwdPrefix = "/Users/tobiasanhalt/Development/";
  return path.startsWith(cwdPrefix) ? path.slice(cwdPrefix.length) : path;
}
