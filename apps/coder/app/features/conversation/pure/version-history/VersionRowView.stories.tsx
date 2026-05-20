import type { Meta, StoryObj } from "@storybook/react-vite";
import { VersionRowView } from "./VersionRowView";

const meta = {
  title: "Codex/Version History/VersionRowView",
  component: VersionRowView
} satisfies Meta<typeof VersionRowView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {
  args: {
    isActive: true,
    version: { id: "c1", label: "v12", message: "Add chat deletion", meta: "2m ago by Tobias" }
  }
};

export const Pending: Story = {
  args: {
    isPending: true,
    version: { id: "c2", label: "v11", message: "Extract composer view", meta: "8m ago by Tobias" }
  }
};
