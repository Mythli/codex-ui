import type { Meta, StoryObj } from "@storybook/react-vite";
import { RenameProjectDialogView } from "./RenameProjectDialogView";

const meta: Meta<typeof RenameProjectDialogView> = {
  title: "Codex/ChatSwitcher/RenameProjectDialogView",
  component: RenameProjectDialogView
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    name: "codex-api"
  }
};
