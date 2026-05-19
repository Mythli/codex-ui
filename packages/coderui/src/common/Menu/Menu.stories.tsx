import type { Meta, StoryObj } from "@storybook/react-vite";
import { MenuItem, MenuList } from "./Menu";

const meta: Meta<typeof MenuList> = {
  title: "Common/Menu",
  component: MenuList
};

export default meta;
type Story = StoryObj<typeof meta>;

export const States: Story = {
  args: {
    children: (
      <>
        <MenuItem description="Current selection" label="GPT-5" selected />
        <MenuItem label="Fast mode" />
        <MenuItem disabled label="Unavailable model" />
        <MenuItem label="Delete project" tone="danger" />
      </>
    ),
    label: "Model"
  }
};
