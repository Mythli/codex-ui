import type { Meta, StoryObj } from "@storybook/react-vite";
import { ComposerView } from "./ComposerView";

const meta = {
  title: "Codex/Composer/ComposerView",
  component: ComposerView
} satisfies Meta<typeof ComposerView>;

export default meta;
type Story = StoryObj<typeof meta>;

const screenPreview = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="180" height="108" viewBox="0 0 180 108">
  <rect width="180" height="108" fill="#0f172a"/>
  <rect x="14" y="14" width="152" height="80" rx="8" fill="#f9fafb"/>
  <path d="M34 76l26-28 20 16 28-34 36 46z" fill="#38bdf8"/>
  <circle cx="52" cy="38" r="10" fill="#f97316"/>
</svg>
`)}`;

export const Empty: Story = {
  args: {
    prompt: ""
  }
};

export const WithAttachments: Story = {
  args: {
    attachments: [
      { id: "a1", kind: "file", mimeType: "text/markdown", name: "notes.md", sizeLabel: "8 KB" },
      { id: "a2", kind: "image", mimeType: "image/png", name: "screen.png", previewUrl: screenPreview, sizeLabel: "940 KB" }
    ],
    canSubmit: true,
    prompt: "Summarize these files"
  }
};
