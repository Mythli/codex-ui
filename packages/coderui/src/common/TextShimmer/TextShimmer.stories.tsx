import type { Meta, StoryObj } from "@storybook/react-vite";
import { TextShimmer } from "./TextShimmer";

const meta: Meta<typeof TextShimmer> = {
  title: "Common/TextShimmer",
  component: TextShimmer
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {
  args: {
    children: "Working for 12s"
  }
};

export const Inactive: Story = {
  args: {
    active: false,
    children: "Worked for 42s"
  }
};
