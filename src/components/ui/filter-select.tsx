/**
 * FilterSelect Component
 *
 * A reusable filter dropdown component.
 * Follows ShadCN UI patterns for consistency.
 */

export interface FilterSelectOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options?: FilterSelectOption[];
  className?: string;
}

export function FilterSelect({ value, onChange, options = [], className = "" }: FilterSelectProps) {
  return (
    <div className={`flex-shrink-0 ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
