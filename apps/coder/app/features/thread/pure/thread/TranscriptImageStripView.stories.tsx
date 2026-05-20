import type { Meta, StoryObj } from "@storybook/react-vite";
import { TranscriptImageStripView } from "./TranscriptImageStripView";

const meta = { title: "Codex/Transcript/TranscriptImageStripView", component: TranscriptImageStripView } satisfies Meta<typeof TranscriptImageStripView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Images: Story = {
  args: {
    images: [
      { id: "one", alt: "Preview", kind: "url", url: "https://placehold.co/320x180/png" },
      { id: "two", alt: "Mobile preview", kind: "url", url: "https://placehold.co/160x220/png" }
    ]
  }
};
