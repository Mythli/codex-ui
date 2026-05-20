import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatRowView } from "./ChatRowView";
import { ChatProjectGroupView } from "./ChatProjectGroupView";

const meta = { title: "Codex/ChatSwitcher/ChatProjectGroupView", component: ChatProjectGroupView } satisfies Meta<typeof ChatProjectGroupView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const WithChats: Story = {
  args: {
    children: <ChatRowView chat={{ threadId: "1", title: "Refactor transcript", activity: "running" }} />,
    name: "codex-api"
  }
};
