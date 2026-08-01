/**
 * Date Formatting Utility
 *
 * Centralized utility for formatting dates consistently across the application.
 * Ensures consistent date display with proper formatting options.
 */

export function formatDateShort(dateString: string | Date | null | undefined): string {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "N/A";
  }
}

export function formatDateLong(dateString: string | Date | null | undefined): string {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "N/A";
  }
}

export function formatDateFull(dateString: string | Date | null | undefined): string {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "N/A";
  }
}

export interface FormatDateOptions {
  includeTime?: boolean;
  format?: "short" | "long" | "full";
}

export function formatDate(dateString: string | Date | null | undefined, options: FormatDateOptions = {}): string {
  const { includeTime = false, format = "short" } = options;

  if (includeTime || format === "long") {
    return formatDateLong(dateString);
  }
  if (format === "full") {
    return formatDateFull(dateString);
  }
  return formatDateShort(dateString);
}
