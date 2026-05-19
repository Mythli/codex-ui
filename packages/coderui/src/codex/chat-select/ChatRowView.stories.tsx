import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatRowView } from "./ChatRowView";

const meta = {
  title: "Codex/ChatSwitcher/ChatRowView",
  component: ChatRowView
} satisfies Meta<typeof ChatRowView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    chat: { id: "chat-1", title: "Add billing dashboard", updatedLabel: "2m" }
  }
};

export const ActiveUnreadRunning: Story = {
  args: {
    chat: { id: "chat-2", title: "Fix flaky click tests", activity: "running", unread: true },
    isActive: true
  }
};

export const Deleting: Story = {
  args: {
    chat: { id: "chat-3", title: "Refactor composer" },
    isDeleting: true,
    onDelete: () => undefined
  }
};
