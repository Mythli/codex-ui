import type { Meta, StoryObj } from "@storybook/react-vite";
import { ViewModeSwitcherView } from "./ViewModeSwitcherView";

const meta = { title: "Codex/Interface/ViewModeSwitcherView", component: ViewModeSwitcherView } satisfies Meta<typeof ViewModeSwitcherView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Chat: Story = { args: { mode: "chat" } };
export const Both: Story = { args: { mode: "both" } };
export const Preview: Story = { args: { mode: "preview" } };
