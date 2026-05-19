import type { Meta, StoryObj } from "@storybook/react-vite";
import { PreviewControlsView } from "./PreviewControlsView";

const meta = {
  title: "Codex/Preview/PreviewControlsView",
  component: PreviewControlsView
} satisfies Meta<typeof PreviewControlsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  args: {
    previewUrl: "http://localhost:5173",
    viewport: "desktop"
  }
};

export const Empty: Story = {
  args: {
    viewport: "phone"
  }
};
