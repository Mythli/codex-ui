import { Input } from "../../../../common/Input/Input";
import { Button } from "../../../../common/Button/Button";
import { useLocale } from "../../../../system/LocaleContext";
import styles from "./PureObservationInput.module.css";

export interface PureObservationInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
  buttonText?: string;
}

export function PureObservationInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  disabled = false,
  placeholder,
  buttonText,
}: PureObservationInputProps) {
  const { dict } = useLocale();
  const canSubmit = !isLoading && !disabled && value.trim().length > 0;

  const resolvedPlaceholder = placeholder || dict.experiment.observationPlaceholder;
  const resolvedButtonText = buttonText || dict.experiment.checkDiscoveries;

  return (
    <div className={styles.container}>
      <Input
        multiline
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={resolvedPlaceholder}
        rows={4}
        disabled={disabled || isLoading}
      />
      <Button
        variant="success"
        onClick={onSubmit}
        disabled={!canSubmit}
        isLoading={isLoading}
        leftIcon={!isLoading ? "✓" : undefined}
        style={{ width: '100%' }}
      >
        {isLoading ? dict.experiment.checking : resolvedButtonText}
      </Button>
    </div>
  );
}
