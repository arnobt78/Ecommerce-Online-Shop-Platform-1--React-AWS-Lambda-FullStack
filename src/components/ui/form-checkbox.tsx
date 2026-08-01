/**
 * FormCheckbox Component
 *
 * A reusable form checkbox component with consistent styling.
 * Follows ShadCN UI patterns for consistency.
 */

import type { InputHTMLAttributes } from "react";

interface FormCheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  id?: string;
  name?: string;
  checked?: boolean;
  onChange?: InputHTMLAttributes<HTMLInputElement>["onChange"];
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function FormCheckbox({
  id,
  name,
  checked,
  onChange,
  label,
  disabled = false,
  className = "",
  ...props
}: FormCheckboxProps) {
  return (
    <div className={`flex items-center ${className}`}>
      <input
        type="checkbox"
        id={id}
        name={name}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className={`w-4 h-4 text-sky-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        }`}
        {...props}
      />
      {label && (
        <label
          htmlFor={id}
          className={`ml-2 text-sm font-medium ${
            disabled
              ? "text-gray-400 dark:text-gray-500 cursor-not-allowed"
              : "text-gray-700 dark:text-gray-300 cursor-pointer"
          }`}
        >
          {label}
        </label>
      )}
    </div>
  );
}
