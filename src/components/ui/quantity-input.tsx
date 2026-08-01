/**
 * QuantityInput Component
 *
 * A reusable quantity input component with increase/decrease buttons.
 * Follows ShadCN UI patterns for consistency.
 */

import type { ChangeEvent } from "react";
import { Minus, Plus } from "lucide-react";

interface QuantityInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number | null;
  disabled?: boolean;
  className?: string;
}

export function QuantityInput({
  value,
  onChange,
  min = 1,
  max,
  disabled = false,
  className = "",
}: QuantityInputProps) {
  const handleDecrease = () => {
    if (!disabled && value > min) {
      onChange(value - 1);
    }
  };

  const handleIncrease = () => {
    if (!disabled && (!max || value < max)) {
      onChange(value + 1);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value.trim();

    // Handle empty input - allow it temporarily for better UX
    if (inputValue === "") {
      return; // Don't update, let user continue typing
    }

    const newValue = parseInt(inputValue, 10);

    // Handle invalid input
    if (isNaN(newValue)) {
      return; // Don't update if invalid
    }

    // Validate and update
    if (newValue >= min && (!max || newValue <= max)) {
      onChange(newValue);
    } else if (newValue < min) {
      onChange(min);
    } else if (max && newValue > max) {
      onChange(max);
    }
  };

  return (
    <div
      className={`flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden ${className}`}
    >
      <button
        type="button"
        onClick={handleDecrease}
        disabled={disabled || value <= min}
        className="px-3 py-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Decrease quantity"
      >
        <Minus className="h-4 w-4" strokeWidth={2} />
      </button>
      <input
        type="number"
        min={min}
        max={max ?? undefined}
        value={value}
        onChange={handleInputChange}
        disabled={disabled}
        className="w-16 px-2 py-1.5 text-center text-sm border-0 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <button
        type="button"
        onClick={handleIncrease}
        disabled={disabled || Boolean(max && value >= max)}
        className="px-3 py-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Increase quantity"
      >
        <Plus className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
