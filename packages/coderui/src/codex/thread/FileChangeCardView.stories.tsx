import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentProps } from "react";
import { useState } from "react";
import { FileChangeCardView } from "./FileChangeCardView";
import { FileReviewSidebar } from "./FileReviewSidebar";

const meta = { title: "Codex/Transcript/FileChangeCardView", component: FileChangeCardView } satisfies Meta<typeof FileChangeCardView>;
export default meta;
type Story = StoryObj<typeof meta>;

const files = [
  {
    path: "app/coderui/Transcript.tsx",
    additions: 28,
    deletions: 4,
    diff: [
      "@@ -10,7 +10,8 @@ export function Transcript() {",
      "   return (",
      "-    <main>",
      "+    <main aria-label=\"Chat transcript\">",
      "+      <FileReviewSidebar />",
      "       {messages}",
      "     </main>"
    ].join("\n")
  },
  {
    path: "packages/coderui/src/codex/thread/FileChangeCardView.tsx",
    additions: 14,
    deletions: 3,
    diff: [
      "@@ -20,7 +20,7 @@ export function FileChangeCardView({",
      "-          <div className={styles.fileRow}>",
      "+          <details className={styles.fileRow}>",
      "             <span>{file.path}</span>",
      "-          </div>",
      "+          </details>"
    ].join("\n")
  }
];

export const Default: Story = {
  args: {
    additions: 42,
    deletions: 7,
    files,
    title: "Changed 2 files"
  },
  render: function Render(args: ComponentProps<typeof FileChangeCardView>) {
    const [reviewOpen, setReviewOpen] = useState(false);

    return (
      <>
        <FileChangeCardView {...args} onReview={() => setReviewOpen(true)} onUndo={() => undefined} />
        <FileReviewSidebar
          additions={args.additions}
          deletions={args.deletions}
          files={args.files}
          onClose={() => setReviewOpen(false)}
          open={reviewOpen}
          title={args.title}
        />
      </>
    );
  }
};
