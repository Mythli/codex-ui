import type { Meta, StoryObj } from "@storybook/react-vite";
import { MessageBubbleView } from "./MessageBubbleView";

const meta = {
  title: "Codex/Thread/MessageBubbleView",
  component: MessageBubbleView
} satisfies Meta<typeof MessageBubbleView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const User: Story = {
  args: {
    message: { id: "m1", role: "user", body: "Please fix the failing tests." }
  }
};

export const Assistant: Story = {
  args: {
    message: { id: "m2", role: "assistant", body: "I found the issue and patched the selector." }
  }
};
