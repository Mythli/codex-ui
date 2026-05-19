import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConfirmDialogView } from "./ConfirmDialogView";

const meta: Meta<typeof ConfirmDialogView> = {
  title: "Common/ConfirmDialogView",
  component: ConfirmDialogView
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Danger: Story = {
  args: {
    confirmText: "Delete",
    message: "Delete this chat from the chat list?",
    title: "Delete chat",
    variant: "danger"
  }
};

export const Loading: Story = {
  args: {
    confirmText: "Delete",
    isLoading: true,
    message: "Deleting cannot be undone.",
    title: "Delete project",
    variant: "danger"
  }
};

export const Error: Story = {
  args: {
    confirmText: "Retry",
    error: "The operation failed. Try again in a moment.",
    message: "Confirm this action before continuing.",
    title: "Action failed",
    variant: "warning"
  }
};
