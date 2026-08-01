/**
 * FormTextarea Component
 *
 * A reusable form textarea component with consistent styling.
 * Follows ShadCN UI patterns for consistency.
 */

import type { TextareaHTMLAttributes } from "react";

interface FormTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> {
  id?: string;
  name?: string;
  value?: string;
  onChange?: TextareaHTMLAttributes<HTMLTextAreaElement>["onChange"];
  placeholder?: string;
  rows?: number;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function FormTextarea({
  id,
  name,
  value,
  onChange,
  placeholder,
  rows = 3,
  required = false,
  disabled = false,
  className = "",
  ...props
}: FormTextareaProps) {
  return (
    <textarea
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      rows={rows}
      className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-800 text-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed resize-y ${className}`}
      {...props}
    />
  );
}
