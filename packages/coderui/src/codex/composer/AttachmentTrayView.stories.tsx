import type { Meta, StoryObj } from "@storybook/react-vite";
import { AttachmentTrayView } from "./AttachmentTrayView";

const meta = { title: "Codex/Composer/AttachmentTrayView", component: AttachmentTrayView } satisfies Meta<typeof AttachmentTrayView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const WithAttachments: Story = {
  args: {
    attachments: [
      { id: "1", kind: "image", name: "screenshot.png", sizeLabel: "140 KB" },
      { id: "2", kind: "file", name: "notes.md", sizeLabel: "2 KB" }
    ]
  }
};
