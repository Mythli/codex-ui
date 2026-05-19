import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileChangeCardView } from "./FileChangeCardView";

const meta = { title: "Codex/Transcript/FileChangeCardView", component: FileChangeCardView } satisfies Meta<typeof FileChangeCardView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    additions: 42,
    deletions: 7,
    files: [
      { path: "app/coderui/Transcript.tsx", additions: 28, deletions: 4 },
      { path: "packages/coderui/src/codex/thread/FileChangeCardView.tsx", additions: 14, deletions: 3 }
    ],
    title: "Changed 2 files"
  }
};
