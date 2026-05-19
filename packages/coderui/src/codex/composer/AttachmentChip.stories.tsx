import type { Meta, StoryObj } from "@storybook/react-vite";
import { AttachmentChip } from "./AttachmentChip";

const meta = {
  title: "Codex/Composer/AttachmentChip",
  component: AttachmentChip
} satisfies Meta<typeof AttachmentChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const File: Story = {
  args: {
    attachment: { id: "a1", kind: "file", name: "report.csv", sizeLabel: "24 KB" }
  }
};

export const RemovableImage: Story = {
  args: {
    attachment: { id: "a2", kind: "image", name: "screenshot.png", sizeLabel: "1.2 MB" },
    onRemove: () => undefined
  }
};
