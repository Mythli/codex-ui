import React, { useId } from 'react';
import ReactSelect, { Props as ReactSelectProps, StylesConfig } from 'react-select';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<ReactSelectProps<SelectOption, boolean>, 'styles'> {
  /** Optional custom class name for the container */
  className?: string;
}

/**
 * A themed wrapper around react-select that perfectly matches the Learning UI design system.
 */
export function Select(props: SelectProps) {
  const id = useId();

  const customStyles: StylesConfig<SelectOption, boolean> = {
    control: (base, state) => ({
      ...base,
      backgroundColor: 'var(--lui-color-bg-main)',
      borderColor: state.isFocused ? 'var(--lui-color-primary)' : 'var(--lui-color-border-dark)',
      borderRadius: 'var(--lui-radius-sm)',
      padding: 'var(--lui-space-1)',
      boxShadow: state.isFocused ? '0 0 0 3px var(--lui-color-primary-bg)' : 'none',
      borderWidth: '2px',
      transition: 'border-color 0.2s, box-shadow 0.2s',
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
      backgroundColor: state.isSelected 
        ? 'var(--lui-color-primary)' 
        : state.isFocused 
          ? 'var(--lui-color-bg-alt)' 
          : 'transparent',
      color: state.isSelected 
        ? 'var(--lui-color-text-inverse)' 
        : 'var(--lui-color-text-main)',
      cursor: 'pointer',
      borderRadius: 'var(--lui-radius-sm)',
      padding: 'var(--lui-space-2) var(--lui-space-3)',
      '&:active': {
        backgroundColor: 'var(--lui-color-primary-hover)',
      }
    }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: 'var(--lui-color-bg-alt)',
      border: '1px solid var(--lui-color-border)',
      borderRadius: 'var(--lui-radius-sm)',
    }),
    multiValueLabel: (base) => ({
      ...base,
      color: 'var(--lui-color-text-main)',
      fontSize: 'var(--lui-font-size-sm)',
      fontWeight: 600,
      padding: 'var(--lui-space-1) var(--lui-space-2)',
    }),
    multiValueRemove: (base) => ({
      ...base,
      color: 'var(--lui-color-text-muted)',
      cursor: 'pointer',
      '&:hover': {
        backgroundColor: 'var(--lui-color-danger-bg)',
        color: 'var(--lui-color-danger)',
      }
    }),
    singleValue: (base) => ({
      ...base,
      color: 'var(--lui-color-text-main)',
    }),
    input: (base) => ({
      ...base,
      color: 'var(--lui-color-text-main)',
    }),
    placeholder: (base) => ({
      ...base,
      color: 'var(--lui-color-text-light)',
    }),
    indicatorSeparator: (base) => ({
      ...base,
      backgroundColor: 'var(--lui-color-border)',
    }),
    dropdownIndicator: (base) => ({
      ...base,
      color: 'var(--lui-color-text-muted)',
      cursor: 'pointer',
      '&:hover': {
        color: 'var(--lui-color-text-main)',
      }
    }),
    clearIndicator: (base) => ({
      ...base,
      color: 'var(--lui-color-text-muted)',
      cursor: 'pointer',
      '&:hover': {
        color: 'var(--lui-color-danger)',
      }
    })
  };

  return <ReactSelect instanceId={id} menuPosition="fixed" styles={customStyles} {...props} />;
}
