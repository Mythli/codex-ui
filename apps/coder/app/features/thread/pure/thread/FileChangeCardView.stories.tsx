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
    path: "app/features/thread/Transcript.tsx",
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
    path: "apps/coder/app/features/thread/pure/thread/FileChangeCardView.tsx",
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

const manyFiles = [
  ...files,
  {
    path: "apps/coder/app/features/thread/components/Files/FileChangeCard.tsx",
    additions: 8,
    deletions: 2,
    diff: "@@ -1,3 +1,3 @@\n- old\n+ new"
  },
  {
    path: "apps/coder/app/common/pure/codex.module.css",
    additions: 16,
    deletions: 0,
    diff: "@@ -1,3 +1,3 @@\n- old\n+ new"
  },
  {
    path: "apps/coder/app/theme.css",
    additions: 1,
    deletions: 1,
    diff: "@@ -1,3 +1,3 @@\n- old\n+ new"
  },
  {
    path: "apps/coder/app/features/thread/state/threadReducer/internal/renderBlocks.ts",
    additions: 5,
    deletions: 5,
    diff: "@@ -1,3 +1,3 @@\n- old\n+ new"
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

export const WithShowMore: Story = {
  args: {
    additions: 72,
    deletions: 15,
    files: manyFiles.slice(0, 3),
    showMoreLabel: `Show ${manyFiles.length - 3} more files`,
    title: `Changed ${manyFiles.length} files`
  },
  render: function Render(args: ComponentProps<typeof FileChangeCardView>) {
    const [reviewOpen, setReviewOpen] = useState(false);

    return (
      <>
        <FileChangeCardView
          {...args}
          onReview={() => setReviewOpen(true)}
          onShowMore={() => undefined}
        />
        <FileReviewSidebar
          additions={args.additions}
          deletions={args.deletions}
          files={manyFiles}
          onClose={() => setReviewOpen(false)}
          open={reviewOpen}
          title={args.title}
        />
      </>
    );
  }
};
