/**
 * FormError Component
 *
 * A reusable form error message component with consistent styling.
 * Follows ShadCN UI patterns for consistency.
 */

interface FormErrorProps {
  message?: string;
  className?: string;
}

export function FormError({ message, className = "" }: FormErrorProps) {
  if (!message) return null;

  return (
    <p className={`mt-1 text-sm text-red-600 dark:text-red-400 ${className}`}>
      {message}
    </p>
  );
}
