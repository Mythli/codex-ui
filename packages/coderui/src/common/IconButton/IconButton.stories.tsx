import type { StoryFn } from "@storybook/react";
import { FiEdit3, FiSidebar } from "react-icons/fi";
import { StoryFrame } from "../../system/StoryFrame";
import { IconButton } from "./IconButton";

export default {
  title: "Common/IconButton"
};

export const Variants: StoryFn = () => (
  <StoryFrame>
  <div style={{ display: "flex", gap: 12 }}>
    <IconButton label="Switch chats">
      <FiSidebar />
    </IconButton>
    <IconButton label="New chat" variant="secondary">
      <FiEdit3 />
    </IconButton>
  </div>
  </StoryFrame>
);
