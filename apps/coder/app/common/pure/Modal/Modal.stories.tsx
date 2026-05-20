import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../Button/Button";
import { ConfirmDialogView } from "../ConfirmDialog";
import { DialogView } from "../Dialog";
import { Field } from "../Field";
import { Input } from "../Input/Input";
import { Modal } from "./Modal";

const meta: Meta<typeof Modal> = {
  title: "Common/Modal",
  component: Modal
};

export default meta;

type Story = StoryObj<typeof Modal>;

export const Rename: Story = {
  args: {
    "aria-label": "Rename project",
    isOpen: true,
    onClose: () => undefined,
    children: (
      <DialogView
        actions={(
          <>
            <Button variant="secondary">Cancel</Button>
            <Button variant="primary">Save</Button>
          </>
        )}
        description="Keep it short and recognizable."
        title="Rename project"
      >
        <Field label="Project name">
          <Input defaultValue="Codex UI" />
        </Field>
      </DialogView>
    )
  }
};

export const DangerConfirm: Story = {
  args: {
    "aria-label": "Delete chat",
    isOpen: true,
    onClose: () => undefined,
    size: "compact",
    children: (
      <ConfirmDialogView
        confirmText="Delete"
        message="Delete this chat from the chat list?"
        title="Delete chat"
        variant="danger"
      />
    )
  }
};
