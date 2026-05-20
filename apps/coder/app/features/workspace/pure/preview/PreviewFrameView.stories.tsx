import type { Meta, StoryObj } from "@storybook/react-vite";
import { PreviewFrameView } from "./PreviewFrameView";

const meta = {
  title: "Codex/Preview/PreviewFrameView",
  component: PreviewFrameView
} satisfies Meta<typeof PreviewFrameView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoUrl: Story = {
  args: {
    viewport: "desktop"
  }
};
