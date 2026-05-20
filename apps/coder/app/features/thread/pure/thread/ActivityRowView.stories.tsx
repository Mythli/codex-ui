import type { Meta, StoryObj } from "@storybook/react-vite";
import { ActivityRowView } from "./ActivityRowView";

const meta = { title: "Codex/Transcript/ActivityRowView", component: ActivityRowView } satisfies Meta<typeof ActivityRowView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Running: Story = {
  args: {
    active: true,
    description: "12s",
    title: "Running click tests"
  }
};
