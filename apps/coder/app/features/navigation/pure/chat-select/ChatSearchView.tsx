import { Field, Input } from "@app/common/pure";

export function ChatSearchView({
  onChange,
  placeholder = "Search chats",
  value
}: {
  onChange?: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <Field label="Search">
      <Input aria-label="Search chats" onChange={(event) => onChange?.(event.target.value)} placeholder={placeholder} value={value} />
    </Field>
  );
}
