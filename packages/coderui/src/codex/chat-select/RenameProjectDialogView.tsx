import { Button, DialogView, Field, Input } from "../../common";

export function RenameProjectDialogView({
  name,
  onCancel,
  onChange,
  onSubmit
}: {
  name: string;
  onCancel?: () => void;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
}) {
  return (
    <form onSubmit={(event) => { event.preventDefault(); onSubmit?.(); }}>
      <DialogView
        actions={(
          <>
            <Button onClick={onCancel} type="button" variant="secondary">Cancel</Button>
            <Button disabled={!name.trim()} type="submit" variant="primary">Rename</Button>
          </>
        )}
        description="Keep it short and recognizable."
        title="Rename project"
      >
        <Field label="Project name">
          <Input aria-label="Project name" onChange={(event) => onChange?.(event.target.value)} value={name} />
        </Field>
      </DialogView>
    </form>
  );
}
