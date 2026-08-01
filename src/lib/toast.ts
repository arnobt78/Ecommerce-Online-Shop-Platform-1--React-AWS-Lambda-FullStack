/**
 * Toast wrapper around shadcn/ui's Sonner (replaces react-toastify).
 *
 * Drop-in compatible with the old `toast.success(message, { closeButton, position, autoClose })`
 * call sites (closeButton/position are now global <Toaster> defaults set in src/index.tsx, so
 * they're accepted but ignored here — this let the whole codebase migrate by swapping only the
 * import path, no call-site rewrites needed).
 *
 * Adds one real behavior change per REQ-1512: every toast gets a short, CRUD-operation-derived
 * title (e.g. "Created", "Updated", "Deleted", "Sign In Failed") with the original message as
 * the subtitle/description, instead of one flat line of text.
 */

import { toast as sonnerToast } from "sonner";

type TitleRule = [RegExp, string];

// Ordered so more specific phrases (e.g. "sign in failed") win over generic ones ("failed").
const SUCCESS_TITLE_RULES: TitleRule[] = [
  [/logged? ?in|signed? ?in/i, "Signed In"],
  [/logged? ?out|signed? ?out/i, "Signed Out"],
  [/registered|account created/i, "Account Created"],
  [/refunded/i, "Refunded"],
  [/cancell?ed/i, "Cancelled"],
  [/migrat/i, "Migration Complete"],
  [/label generated|generated/i, "Generated"],
  [/mark(ed)? .*read/i, "Marked as Read"],
  [/status updated/i, "Status Updated"],
  [/tracking/i, "Tracking Updated"],
  [/copied/i, "Copied"],
  [/uploaded/i, "Uploaded"],
  [/created|added|submitted|sent/i, "Created"],
  [/updated|saved|changed/i, "Updated"],
  [/deleted|removed/i, "Deleted"],
];

const ERROR_TITLE_RULES: TitleRule[] = [
  [/sign ?in|login|credential/i, "Sign In Failed"],
  [/regist(er|ration)/i, "Registration Failed"],
  [/payment/i, "Payment Failed"],
  [/refund/i, "Refund Failed"],
  [/upload/i, "Upload Failed"],
  [/copy|clipboard/i, "Copy Failed"],
  [/load|fetch/i, "Couldn't Load"],
  [/creat/i, "Couldn't Create"],
  [/updat|sav/i, "Couldn't Update"],
  [/delet|remov/i, "Couldn't Delete"],
];

export type ToastMessage = string | { message?: string; [key: string]: unknown } | null | undefined;

export interface ToastOptions {
  autoClose?: number | false;
  closeButton?: boolean;
  position?: string;
}

function deriveTitle(message: string, rules: TitleRule[], fallback: string): string {
  const text = String(message ?? "");
  const match = rules.find(([pattern]) => pattern.test(text));
  return match ? match[1] : fallback;
}

function toDescription(message: ToastMessage): string {
  if (typeof message === "string") return message;
  if (message && typeof message === "object" && typeof message.message === "string") {
    return message.message;
  }
  return String(message ?? "");
}

type ToastKind = "success" | "error" | "warning" | "info";

function show(kind: ToastKind, message: ToastMessage, options: ToastOptions = {}) {
  const description = toDescription(message);
  const title =
    kind === "error"
      ? deriveTitle(description, ERROR_TITLE_RULES, "Something Went Wrong")
      : kind === "warning"
        ? deriveTitle(description, SUCCESS_TITLE_RULES, "Heads Up")
        : deriveTitle(description, SUCCESS_TITLE_RULES, "Success");

  const fn = kind === "warning" ? sonnerToast.warning : kind === "info" ? sonnerToast.info : sonnerToast[kind];
  return fn(title, {
    description,
    duration: options.autoClose === false ? Infinity : options.autoClose || 4000,
  });
}

export const toast = {
  success: (message: ToastMessage, options?: ToastOptions) => show("success", message, options),
  error: (message: ToastMessage, options?: ToastOptions) => show("error", message, options),
  warning: (message: ToastMessage, options?: ToastOptions) => show("warning", message, options),
  warn: (message: ToastMessage, options?: ToastOptions) => show("warning", message, options),
  info: (message: ToastMessage, options?: ToastOptions) => show("info", message, options),
};
