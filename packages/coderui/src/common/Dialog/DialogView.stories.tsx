import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../Button/Button";
import { DialogView } from "./DialogView";

const meta: Meta<typeof DialogView> = {
  title: "Common/DialogView",
  component: DialogView
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    actions: (
      <>
        <Button variant="secondary">Cancel</Button>
        <Button variant="primary">Save</Button>
      </>
    ),
    children: "Dialog body content can contain forms, alerts, or composed feature content.",
    description: "Use this pure view inside app-owned modal lifecycle wrappers.",
    title: "Edit project"
  }
};

export const LongContent: Story = {
  args: {
    actions: <Button variant="primary">Got it</Button>,
    description: "This story checks wrapping and dense copy without relying on feature-specific dialog styles.",
    error: "A useful error message wraps without breaking the dialog layout.",
    title: "A longer dialog title that still needs to behave well on narrow screens"
  }
};
