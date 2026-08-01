/**
 * DropdownMenu Component (REQ-1611)
 *
 * Hand-built shadcn-style dropdown, matching the existing AlertDialog pattern
 * (Context-based open state, Tailwind styling with dark-mode variants) — used
 * for admin table row actions (View/Edit/Delete) so DataTable rows show one
 * "..." trigger instead of 3 separate icon buttons.
 *
 * Usage:
 * <DropdownMenu>
 *   <DropdownMenuTrigger />
 *   <DropdownMenuContent>
 *     <DropdownMenuItem icon={Eye} onClick={...}>View</DropdownMenuItem>
 *     <DropdownMenuItem icon={Pencil} onClick={...}>Edit</DropdownMenuItem>
 *     <DropdownMenuItem icon={Trash2} variant="danger" onClick={...}>Delete</DropdownMenuItem>
 *   </DropdownMenuContent>
 * </DropdownMenu>
 */

import { useState, useRef, useEffect, createContext, useContext, type ReactNode } from "react";
import { MoreVertical, type LucideIcon } from "lucide-react";

interface DropdownMenuContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenuContext(): DropdownMenuContextValue {
  const context = useContext(DropdownMenuContext);
  if (!context) {
    throw new Error("DropdownMenu subcomponents must be used within a <DropdownMenu>");
  }
  return context;
}

export function DropdownMenu({ children }: { children?: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <DropdownMenuContext.Provider value={{ isOpen, setIsOpen }}>
      <div ref={containerRef} className="relative inline-block text-left">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

interface DropdownMenuTriggerProps {
  className?: string;
  label?: string;
}

export function DropdownMenuTrigger({ className = "", label = "Row actions" }: DropdownMenuTriggerProps) {
  const { isOpen, setIsOpen } = useDropdownMenuContext();
  return (
    <button
      type="button"
      onClick={() => setIsOpen(!isOpen)}
      aria-haspopup="true"
      aria-expanded={isOpen}
      aria-label={label}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${className}`}
    >
      <MoreVertical className="h-4 w-4" strokeWidth={2} />
    </button>
  );
}

interface DropdownMenuContentProps {
  children?: ReactNode;
  align?: "left" | "right";
}

export function DropdownMenuContent({ children, align = "right" }: DropdownMenuContentProps) {
  const { isOpen } = useDropdownMenuContext();
  if (!isOpen) return null;

  return (
    <div
      className={`absolute z-20 mt-1 w-40 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg py-1 ${
        align === "right" ? "right-0" : "left-0"
      }`}
    >
      {children}
    </div>
  );
}

interface DropdownMenuItemProps {
  children?: ReactNode;
  onClick?: () => void;
  icon?: LucideIcon;
  variant?: "default" | "danger";
  disabled?: boolean;
}

export function DropdownMenuItem({ children, onClick, icon: Icon, variant = "default", disabled = false }: DropdownMenuItemProps) {
  const { setIsOpen } = useDropdownMenuContext();

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        onClick?.();
        setIsOpen(false);
      }}
      className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        variant === "danger"
          ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
          : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
      }`}
    >
      {Icon && <Icon className="h-4 w-4" strokeWidth={2} />}
      {children}
    </button>
  );
}
