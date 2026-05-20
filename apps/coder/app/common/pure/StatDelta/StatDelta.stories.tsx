import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatDelta } from "./StatDelta";

const meta: Meta<typeof StatDelta> = {
  title: "Common/StatDelta",
  component: StatDelta
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Changed: Story = {
  args: {
    additions: 42,
    deletions: 7
  }
};
