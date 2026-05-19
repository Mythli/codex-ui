import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "../Input/Input";
import { Field } from "./Field";

const meta: Meta<typeof Field> = {
  title: "Common/Field",
  component: Field
};

export default meta;
type Story = StoryObj<typeof meta>;

export const TextInput: Story = {
  args: {
    children: <Input defaultValue="codex-api" />,
    hint: "Use a short name.",
    label: "Project name"
  }
};
