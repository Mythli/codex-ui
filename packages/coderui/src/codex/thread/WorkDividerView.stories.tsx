import type { Meta, StoryObj } from "@storybook/react-vite";
import { WorkDividerView } from "./WorkDividerView";

const meta = {
  title: "Codex/Thread/WorkDividerView",
  component: WorkDividerView
} satisfies Meta<typeof WorkDividerView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {
  args: {
    expanded: true,
    label: "Worked",
    timeLabel: "42s"
  }
};
