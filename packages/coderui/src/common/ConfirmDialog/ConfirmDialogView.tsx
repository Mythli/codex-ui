import type { ReactNode } from "react";
import { Button } from "../Button/Button";
import { DialogView } from "../Dialog";

export type ConfirmDialogVariant = "info" | "warning" | "danger";

export type ConfirmDialogViewProps = {
  cancelText?: string;
  confirmText?: string;
  error?: ReactNode;
  isLoading?: boolean;
  loadingText?: string;
  message: ReactNode;
  onCancel?: () => void;
  onConfirm?: () => void;
  role?: "dialog" | "group";
  title: ReactNode;
  variant?: ConfirmDialogVariant;
};

export function ConfirmDialogView({
  cancelText = "Cancel",
  confirmText = "Confirm",
  error,
  isLoading = false,
  loadingText,
  message,
  onCancel,
  onConfirm,
  role = "dialog",
  title,
  variant = "warning"
}: ConfirmDialogViewProps) {
  return (
    <DialogView
      actions={(
        <>
          <Button disabled={isLoading} onClick={onCancel} type="button" variant="secondary">
            {cancelText}
          </Button>
          <Button disabled={isLoading} onClick={onConfirm} type="button" variant={variant === "danger" ? "danger" : "primary"}>
            {isLoading ? loadingText ?? `${confirmText}...` : confirmText}
          </Button>
        </>
      )}
      description={message}
      error={error}
      role={role}
      size="compact"
      title={title}
    />
  );
}
