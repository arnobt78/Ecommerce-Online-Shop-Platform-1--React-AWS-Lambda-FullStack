/**
 * Demo Account Utility
 *
 * Centralized utility for checking if an account is a demo/protected account.
 * Demo accounts are protected from edit/delete operations.
 */

// Demo account emails that should be protected
const DEMO_ACCOUNT_EMAILS: string[] = ["test@example.com", "admin@example.com"];

export function isDemoAccount(email: string | null | undefined): boolean {
  if (!email) return false;
  return DEMO_ACCOUNT_EMAILS.includes(email.toLowerCase().trim());
}

export function getDemoAccountEmails(): string[] {
  return [...DEMO_ACCOUNT_EMAILS];
}
