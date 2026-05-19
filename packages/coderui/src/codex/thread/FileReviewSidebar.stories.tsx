import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileReviewSidebar } from "./FileReviewSidebar";

const files = [
  {
    additions: 3,
    deletions: 2,
    path: "apps/coder/app/coderui/features/CoderComposer/Composer/CodexChatBox.module.css",
    diff: [
      "@@ -1,8 +1,9 @@",
      " .box {",
      "-  background: #2f2f2f;",
      "-  border: 1px solid rgba(255, 255, 255, 0.045);",
      "+  background: var(--coder-composer-surface);",
      "+  border: 1px solid var(--coder-composer-border);",
      "   border-radius: 24px;",
      "+  color: var(--coder-composer-text);",
      " }"
    ].join("\n")
  }
];

const meta = {
  title: "Codex/Transcript/FileReviewSidebar",
  component: FileReviewSidebar
} satisfies Meta<typeof FileReviewSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: {
    additions: 3,
    deletions: 2,
    files,
    onClose: () => undefined,
    open: true,
    title: "Edited 1 file"
  }
};
