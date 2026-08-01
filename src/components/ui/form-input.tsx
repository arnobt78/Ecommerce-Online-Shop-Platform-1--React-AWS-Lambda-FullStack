/**
 * FormInput Component
 *
 * A reusable form input component with consistent styling.
 * Follows ShadCN UI patterns for consistency.
 */

import type { InputHTMLAttributes } from "react";

interface FormInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "error"> {
  id?: string;
  name?: string;
  type?: string;
  value?: InputHTMLAttributes<HTMLInputElement>["value"];
  onChange?: InputHTMLAttributes<HTMLInputElement>["onChange"];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string | null;
  className?: string;
}

export function FormInput({
  id,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  error = null,
  className = "",
  ...props
}: FormInputProps) {
  return (
    <input
      type={type}
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-800 text-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed ${
        error
          ? "border-red-500 dark:border-red-500"
          : "border-gray-300 dark:border-gray-600"
      } ${className}`}
      {...props}
    />
  );
}
