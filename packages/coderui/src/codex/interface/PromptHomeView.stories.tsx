import type { Meta, StoryObj } from "@storybook/react-vite";
import { PromptHomeView } from "./PromptHomeView";

const meta = { title: "Codex/Interface/PromptHomeView", component: PromptHomeView } satisfies Meta<typeof PromptHomeView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Empty: Story = { args: { subtitle: "Start with a prompt or pick a recent thread.", title: "What should we build?" } };
