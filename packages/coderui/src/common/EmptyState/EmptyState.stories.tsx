import type { StoryFn } from "@storybook/react";
import { StoryFrame } from "../../system/StoryFrame";
import { EmptyState } from "./EmptyState";

export default {
  title: "Common/EmptyState"
};

export const Basic: StoryFn = () => (
  <StoryFrame maxWidth={520}>
  <EmptyState title="No chats found">Try a different search or start a new chat.</EmptyState>
  </StoryFrame>
);
