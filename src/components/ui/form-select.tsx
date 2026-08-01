/**
 * FormSelect Component
 *
 * A reusable form select component with consistent styling.
 * Follows ShadCN UI patterns for consistency.
 */

import type { SelectHTMLAttributes } from "react";

export interface FormSelectOption {
  value: string;
  label: string;
}

interface FormSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange"> {
  id?: string;
  name?: string;
  value?: string;
  onChange?: SelectHTMLAttributes<HTMLSelectElement>["onChange"];
  options?: FormSelectOption[];
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function FormSelect({
  id,
  name,
  value,
  onChange,
  options = [],
  required = false,
  disabled = false,
  className = "",
  ...props
}: FormSelectProps) {
  return (
    <select
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
      className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-800 text-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
