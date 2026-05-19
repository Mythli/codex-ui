import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../Button/Button";
import { MenuItem, MenuList } from "../Menu";
import { Popover } from "./Popover";
import type { PopoverRenderTriggerProps } from "./Popover";

const meta: Meta<typeof Popover> = {
  title: "Common/Popover",
  component: Popover
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Menu: Story = {
  args: {
    children: ({ close }: { close(): void }) => (
      <MenuList label="Project actions">
        <MenuItem label="Rename" onSelect={close} />
        <MenuItem label="Delete" onSelect={close} tone="danger" />
      </MenuList>
    ),
    renderTrigger: ({ ref, props, isOpen }: PopoverRenderTriggerProps) => (
      <Button {...props} ref={ref} aria-expanded={isOpen} type="button">
        Project actions
      </Button>
    )
  }
};

export const TopPlacement: Story = {
  args: {
    children: <MenuList label="More"><MenuItem label="Duplicate" /></MenuList>,
    placement: "top",
    renderTrigger: ({ ref, props }: PopoverRenderTriggerProps) => (
      <Button {...props} ref={ref} type="button">
        Open above
      </Button>
    )
  }
};
