import { ConfirmDialogView } from "../../common";

export function DeleteChatDialogView({
  chatTitle,
  error,
  isDeleting = false,
  onCancel,
  onConfirm
}: {
  chatTitle: string;
  error?: string;
  isDeleting?: boolean;
  onCancel?: () => void;
  onConfirm?: () => void;
}) {
  return (
    <ConfirmDialogView
      confirmText="Delete"
      error={error}
      isLoading={isDeleting}
      loadingText="Deleting"
      message={`Delete "${chatTitle || "this chat"}" from the chat list?`}
      onCancel={onCancel}
      onConfirm={onConfirm}
      title="Delete chat"
      variant="danger"
    />
  );
}
