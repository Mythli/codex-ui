import type { Meta, StoryObj } from "@storybook/react-vite";
import { ComposerView } from "./ComposerView";

const meta = {
  title: "Codex/Composer/ComposerView",
  component: ComposerView
} satisfies Meta<typeof ComposerView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    prompt: ""
  }
};

export const WithAttachments: Story = {
  args: {
    attachments: [
      { id: "a1", kind: "file", name: "notes.md", sizeLabel: "8 KB" },
      { id: "a2", kind: "image", name: "screen.png", sizeLabel: "940 KB" }
    ],
    canSubmit: true,
    prompt: "Summarize these files"
  }
};
