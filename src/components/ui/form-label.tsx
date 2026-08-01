/**
 * FormLabel Component
 *
 * A reusable form label component with consistent styling.
 * Follows ShadCN UI patterns for consistency.
 */

import type { ReactNode } from "react";

interface FormLabelProps {
  htmlFor?: string;
  children?: ReactNode;
  required?: boolean;
  className?: string;
}

export function FormLabel({ htmlFor, children, required = false, className = "" }: FormLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={`block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 ${className}`}
    >
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}
