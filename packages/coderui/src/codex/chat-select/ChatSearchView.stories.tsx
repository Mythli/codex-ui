import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatSearchView } from "./ChatSearchView";

const meta = { title: "Codex/ChatSwitcher/ChatSearchView", component: ChatSearchView } satisfies Meta<typeof ChatSearchView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Empty: Story = { args: { value: "" } };
export const WithQuery: Story = { args: { value: "storybook" } };
