import React, { useId } from 'react';
import ReactSelect, { StylesConfig, components, MultiValueGenericProps, OptionProps } from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { PureBadge, BadgeColor } from '../Badge/PureBadge';

export interface TagOption {
  value: string;
  label: string;
  color?: BadgeColor;
}

export interface TagSelectProps {
  options: TagOption[];
  value: TagOption[];
  onChange: (selected: TagOption[]) => void;
  placeholder?: string;
  /** Whether users can type to create new tags. Defaults to true. */
  creatable?: boolean;
  /** Whether the select input is disabled */
  isDisabled?: boolean;
}

const MultiValueLabel = (props: MultiValueGenericProps<TagOption>) => {
  return (
    <div style={{ padding: 'var(--lui-space-1)' }}>
      <PureBadge variant="solid" color={props.data.color || 'default'} size="sm">
        {props.data.label}
      </PureBadge>
    </div>
  );
};

const Option = (props: OptionProps<TagOption>) => {
  return (
    <components.Option {...props}>
      <PureBadge variant="tinted" color={props.data.color || 'default'} size="sm">
        {props.data.label}
      </PureBadge>
    </components.Option>
  );
};

/**
 * A multi-select component that renders items as PureBadges.
 * Allows users to select existing tags or type to create new ones (if creatable is true).
 */
export function TagSelect({ options, value, onChange, placeholder, creatable = true, isDisabled = false }: TagSelectProps) {
  const id = useId();

  const customStyles: StylesConfig<TagOption, true> = {
    control: (base, state) => ({
      ...base,
      backgroundColor: state.isDisabled ? 'var(--lui-color-bg-alt)' : 'var(--lui-color-bg-main)',
      borderColor: state.isFocused ? 'var(--lui-color-primary)' : 'var(--lui-color-border-dark)',
      borderRadius: 'var(--lui-radius-sm)',
      padding: 'var(--lui-space-1)',
      boxShadow: state.isFocused ? '0 0 0 3px var(--lui-color-primary-bg)' : 'none',
      borderWidth: '2px',
      transition: 'border-color 0.2s, box-shadow 0.2s',
      opacity: state.isDisabled ? 0.7 : 1,
      '&:hover': {
        borderColor: state.isFocused ? 'var(--lui-color-primary)' : 'var(--lui-color-border-dark)',
      }
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: 'var(--lui-color-bg-elevated)',
      borderRadius: 'var(--lui-radius-md)',
      boxShadow: 'var(--lui-shadow-lg)',
      border: '1px solid var(--lui-color-border)',
      zIndex: 9999, // Ensure it floats above modals
      overflow: 'hidden',
    }),
    menuPortal: (base) => ({
      ...base,
      zIndex: 9999,
    }),
    menuList: (base) => ({
      ...base,
      padding: 'var(--lui-space-1)',
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? 'var(--lui-color-bg-alt)' : 'transparent',
      cursor: 'pointer',
      borderRadius: 'var(--lui-radius-sm)',
      padding: 'var(--lui-space-2) var(--lui-space-3)',
      '&:active': {
        backgroundColor: 'var(--lui-color-bg-alt)',
      }
    }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: 'transparent',
      margin: 'var(--lui-space-1)',
      display: 'flex',
      alignItems: 'center'
    }),
    multiValueLabel: (base) => ({
      ...base,
      padding: 0,
    }),
    multiValueRemove: (base) => ({
      ...base,
      color: 'var(--lui-color-text-muted)',
      cursor: 'pointer',
      borderRadius: 'var(--lui-radius-sm)',
      '&:hover': {
        backgroundColor: 'var(--lui-color-danger-bg)',
        color: 'var(--lui-color-danger)',
      }
    }),
    input: (base) => ({
      ...base,
      color: 'var(--lui-color-text-main)',
    }),
    placeholder: (base) => ({
      ...base,
      color: 'var(--lui-color-text-light)',
    }),
    clearIndicator: (base) => ({
      ...base,
      color: 'var(--lui-color-text-muted)',
      cursor: 'pointer',
      '&:hover': {
        color: 'var(--lui-color-danger)',
      }
    }),
    dropdownIndicator: (base) => ({
      ...base,
      color: 'var(--lui-color-text-muted)',
      cursor: 'pointer',
      '&:hover': {
        color: 'var(--lui-color-text-main)',
      }
    })
  };

  const SelectComponent = creatable ? CreatableSelect : ReactSelect;

  return (
    <SelectComponent
      instanceId={id}
      isMulti
      isDisabled={isDisabled}
      menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
      menuPosition="fixed"
      options={options}
      value={value}
      onChange={(val) => onChange(val as TagOption[])}
      placeholder={placeholder}
      styles={customStyles}
      components={{ MultiValueLabel, Option }}
    />
  );
}
