import type { Meta, StoryObj } from "@storybook/react-vite";
import { DeleteChatDialogView } from "./DeleteChatDialogView";

const meta = {
  title: "Codex/ChatSwitcher/DeleteChatDialogView",
  component: DeleteChatDialogView
} satisfies Meta<typeof DeleteChatDialogView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    chatTitle: "Add billing dashboard"
  }
};

export const Error: Story = {
  args: {
    chatTitle: "Add billing dashboard",
    error: "Could not delete chat"
  }
};
