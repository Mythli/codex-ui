import type { Meta, StoryObj } from "@storybook/react-vite";
import { WorkDetailsView } from "./WorkDetailsView";

const meta = { title: "Codex/Transcript/WorkDetailsView", component: WorkDetailsView } satisfies Meta<typeof WorkDetailsView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const CommandOutput: Story = {
  args: {
    children: <pre>✓ Success</pre>,
    label: "Shell"
  }
};
