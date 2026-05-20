import type { Meta, StoryObj } from "@storybook/react-vite";
import { WorkEntryRowView } from "./WorkEntryRowView";

const meta = { title: "Codex/Transcript/WorkEntryRowView", component: WorkEntryRowView } satisfies Meta<typeof WorkEntryRowView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Command: Story = {
  args: {
    meta: "completed",
    title: "pnpm typecheck"
  }
};
