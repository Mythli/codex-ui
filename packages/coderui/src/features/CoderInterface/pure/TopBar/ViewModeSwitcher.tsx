import { FiColumns, FiMessageSquare, FiMonitor } from "react-icons/fi";
import { SegmentedControl } from "../../../../common";

export type CoderShellViewMode = "both" | "chat" | "preview";

const modes = [
  { id: "chat", label: "Chat only", icon: <FiMessageSquare aria-hidden="true" /> },
  { id: "both", label: "Chat and preview", icon: <FiColumns aria-hidden="true" /> },
  { id: "preview", label: "Preview only", icon: <FiMonitor aria-hidden="true" /> }
] as const;

export function ViewModeSwitcher({
  mode,
  onModeChange
}: {
  mode: CoderShellViewMode;
  onModeChange: (mode: CoderShellViewMode) => void;
}) {
  return <SegmentedControl ariaLabel="Workspace layout" onChange={onModeChange} options={modes} value={mode} />;
}
