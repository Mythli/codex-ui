import type { ReactNode } from "react";
import styles from "./SegmentedControl.module.css";

export type SegmentedControlOption<T extends string> = {
  icon?: ReactNode;
  id: T;
  label: string;
};

export function SegmentedControl<T extends string>({
  ariaLabel,
  className,
  onChange,
  options,
  value
}: {
  ariaLabel: string;
  className?: string;
  onChange: (value: T) => void;
  options: readonly SegmentedControlOption<T>[];
  value: T;
}) {
  return (
    <div aria-label={ariaLabel} className={[styles.segmented, className ?? ""].filter(Boolean).join(" ")} data-testid="segmented-control" role="group">
      {options.map((item) => {
        const isActive = item.id === value;

        return (
          <button
            aria-pressed={isActive}
            className={[styles.option, isActive ? styles.optionActive : ""].filter(Boolean).join(" ")}
            data-segment-id={item.id}
            data-testid="segmented-control-option"
            key={item.id}
            onClick={() => onChange(item.id)}
            title={item.label}
            type="button"
          >
            {item.icon}
            <span className={styles.label}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
