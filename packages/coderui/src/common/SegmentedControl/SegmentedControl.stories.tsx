import type { StoryFn } from "@storybook/react";
import { FiColumns, FiMessageSquare, FiMonitor } from "react-icons/fi";
import { StoryFrame } from "../../system/StoryFrame";
import { SegmentedControl } from "./SegmentedControl";

const options = [
  { id: "chat", label: "Chat only", icon: <FiMessageSquare aria-hidden="true" /> },
  { id: "both", label: "Chat and preview", icon: <FiColumns aria-hidden="true" /> },
  { id: "preview", label: "Preview only", icon: <FiMonitor aria-hidden="true" /> }
] as const;

export default {
  title: "Common/SegmentedControl"
};

export const Modes: StoryFn = () => {
  return (
    <StoryFrame>
      <SegmentedControl ariaLabel="Workspace layout" onChange={() => undefined} options={options} value="both" />
    </StoryFrame>
  );
};
