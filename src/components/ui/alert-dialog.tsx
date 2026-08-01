/**
 * ShadCN-style AlertDialog Component
 *
 * A modal dialog component for confirming actions.
 * Based on Radix UI AlertDialog primitives, styled with Tailwind CSS.
 *
 * Usage:
 * <AlertDialog>
 *   <AlertDialogTrigger>Open</AlertDialogTrigger>
 *   <AlertDialogContent>
 *     <AlertDialogHeader>
 *       <AlertDialogTitle>Are you sure?</AlertDialogTitle>
 *       <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
 *     </AlertDialogHeader>
 *     <AlertDialogFooter>
 *       <AlertDialogCancel>Cancel</AlertDialogCancel>
 *       <AlertDialogAction>Continue</AlertDialogAction>
 *     </AlertDialogFooter>
 *   </AlertDialogContent>
 * </AlertDialog>
 */

import {
  useState,
  createContext,
  useContext,
  type ReactNode,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
} from "react";

interface AlertDialogContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

// Context for managing dialog state
const AlertDialogContext = createContext<AlertDialogContextValue | null>(null);

function useAlertDialogContext(): AlertDialogContextValue {
  const context = useContext(AlertDialogContext);
  if (!context) {
    throw new Error("AlertDialog subcomponents must be used within an <AlertDialog>");
  }
  return context;
}

interface AlertDialogProps {
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * AlertDialog Root Component
 * Manages the open/close state of the dialog
 */
export function AlertDialog({ children, open, onOpenChange }: AlertDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? (onOpenChange as (open: boolean) => void) : setInternalOpen;

  return (
    <AlertDialogContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </AlertDialogContext.Provider>
  );
}

interface AlertDialogTriggerProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  asChild?: boolean;
}

/**
 * AlertDialog Trigger Component
 * Button that opens the dialog
 */
export function AlertDialogTrigger({ children, asChild: _asChild, ...props }: AlertDialogTriggerProps) {
  const { setIsOpen } = useAlertDialogContext();
  return (
    <div onClick={() => setIsOpen(true)} {...props}>
      {children}
    </div>
  );
}

interface AlertDialogContentProps {
  children?: ReactNode;
  className?: string;
}

/**
 * AlertDialog Content Component
 * The actual dialog content
 */
export function AlertDialogContent({ children, className = "" }: AlertDialogContentProps) {
  const { isOpen, setIsOpen } = useAlertDialogContext();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/70"
        onClick={() => setIsOpen(false)}
      />
      {/* Dialog */}
      <div
        className={`relative z-50 w-full max-w-lg mx-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

interface AlertDialogSectionProps {
  children?: ReactNode;
  className?: string;
}

/**
 * AlertDialog Header Component
 * Container for title and description
 */
export function AlertDialogHeader({ children, className = "" }: AlertDialogSectionProps) {
  return <div className={`px-6 pt-6 ${className}`}>{children}</div>;
}

/**
 * AlertDialog Title Component
 */
export function AlertDialogTitle({ children, className = "" }: AlertDialogSectionProps) {
  return (
    <h2
      className={`text-lg font-medium text-gray-700 dark:text-white ${className}`}
    >
      {children}
    </h2>
  );
}

/**
 * AlertDialog Description Component
 */
export function AlertDialogDescription({ children, className = "" }: AlertDialogSectionProps) {
  return (
    <p className={`mt-2 text-sm text-gray-600 dark:text-gray-400 ${className}`}>
      {children}
    </p>
  );
}

/**
 * AlertDialog Footer Component
 * Container for action buttons
 */
export function AlertDialogFooter({ children, className = "" }: AlertDialogSectionProps) {
  return (
    <div
      className={`px-6 py-4 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 ${className}`}
    >
      {children}
    </div>
  );
}

interface AlertDialogButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  children?: ReactNode;
  className?: string;
}

/**
 * AlertDialog Cancel Button
 */
export function AlertDialogCancel({
  children,
  onClick,
  className = "",
  ...props
}: AlertDialogButtonProps) {
  const { setIsOpen } = useAlertDialogContext();

  return (
    <button
      type="button"
      onClick={(e) => {
        setIsOpen(false);
        if (onClick) onClick(e);
      }}
      className={`px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors ${className}`}
      {...props}
    >
      {children || "Cancel"}
    </button>
  );
}

/**
 * AlertDialog Action Button
 */
export function AlertDialogAction({
  children,
  onClick,
  className = "",
  ...props
}: AlertDialogButtonProps) {
  const { setIsOpen } = useAlertDialogContext();

  return (
    <button
      type="button"
      onClick={(e) => {
        if (onClick) onClick(e);
        setIsOpen(false);
      }}
      className={`px-4 py-2 text-sm font-medium text-white bg-red-600 dark:bg-red-500 rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors ${className}`}
      {...props}
    >
      {children || "Continue"}
    </button>
  );
}
