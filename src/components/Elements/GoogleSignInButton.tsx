/**
 * GoogleSignInButton
 *
 * One-click "Continue with Google" button for the Login and Register pages.
 * Redirects the browser to the backend's OAuth2 entry point; the backend
 * handles the Google redirect/callback dance and sends the browser back to
 * /auth/callback with a session token (see AuthCallback.js).
 */

import { API_BASE_URL } from "../../lib/apiBase";

export const GoogleSignInButton = () => {
  function handleClick() {
    window.location.href = `${API_BASE_URL}/auth/google`;
  }

  return (
    <div className="mb-6">
      <div className="relative flex items-center py-2">
        <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
        <span className="mx-3 text-xs uppercase text-gray-500 dark:text-gray-400">
          Or continue with
        </span>
        <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
      </div>
      <button
        type="button"
        onClick={handleClick}
        className="w-full flex items-center justify-center gap-2 border border-gray-300 bg-white text-gray-700 text-sm font-medium rounded-lg px-5 py-2.5 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600 transition"
      >
        <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
          <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
          <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
          <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
        </svg>
        Continue with Google
      </button>
    </div>
  );
};
