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
    chat: { threadId: "chat-1", title: "Add billing dashboard", updatedAt: new Date(Date.now() - 2 * 60_000).toISOString(), activity: "none" }
  }
};

export const ActiveUnreadRunning: Story = {
  args: {
    chat: { threadId: "chat-2", title: "Fix flaky click tests", activity: "running" },
    isActive: true,
    isUnread: true
  }
};

export const Deleting: Story = {
  args: {
    chat: { threadId: "chat-3", title: "Refactor composer", activity: "none" },
    isDeleting: true,
    onDelete: () => undefined
  }
};
