import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "../lib/toast";
import { useQueryClient } from "@tanstack/react-query";
import { useTitle } from "../hooks/useTitle";
import { useDemoAccounts } from "../hooks/useAuth";
import { login, demoLogin } from "../services";
import type { DemoAccount } from "../services/authService";
import { getNotificationCount } from "../services/notificationService";
import { GoogleSignInButton } from "../components";
import {
  StaggerContainer,
  StaggerItem,
  ScrollReveal,
  RippleButton,
  AuthSplitLayout,
  FormInput,
  FormLabel,
} from "../components/ui";

// Friendly labels for the roles returned by GET /auth/demo-accounts (REQ-1510).
// The accounts themselves (email/role) come from the database, never from env vars.
const DEMO_ROLE_LABELS: Record<string, string> = {
  admin: "Guest Admin",
  user: "Guest User",
};

const LOGIN_BULLETS = [
  "Instant access to every ebook you've purchased",
  "Track orders and shipments in real time",
  "Personalized recommendations as you browse",
];

export const Login = () => {
  useTitle("Login");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDemoLoggingIn, setIsDemoLoggingIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: demoAccounts = [] } = useDemoAccounts();

  // After any successful login (password or demo), bootstrap the session.
  // userRole is already correctly set in sessionStorage by login()/demoLogin()
  // (from the real API response) — don't second-guess it here.
  function afterLoginSuccess() {
    // Clear React Query cache to prevent showing previous user's data
    queryClient.clear();

    // Prefetch notification count so it's ready when dropdown opens
    queryClient.prefetchQuery({
      queryKey: ["notification-count"],
      queryFn: getNotificationCount,
      staleTime: 0, // Always fetch fresh count on login
    });

    navigate("/products");
  }

  // One-click demo login — no password ever touches the client, the backend
  // only allows emails already flagged isDemo in the database (REQ-1510).
  async function handleDemoLogin(account: DemoAccount) {
    setIsDropdownOpen(false);
    setIsDemoLoggingIn(true);
    try {
      const data = await demoLogin(account.email);
      if (data.accessToken) {
        afterLoginSuccess();
      } else {
        toast.error(data as unknown as string);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error), {
        closeButton: true,
        position: "bottom-right",
      });
    } finally {
      setIsDemoLoggingIn(false);
    }
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const data = await login({ email, password });
      if (data.accessToken) {
        afterLoginSuccess();
      } else {
        toast.error(data as unknown as string);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error), {
        closeButton: true,
        position: "bottom-right",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthSplitLayout
      imageSrc="/images/10011.avif"
      imageAlt="Person reading a computer science ebook on a tablet"
      eyebrow="Welcome Back"
      title="Pick up right where you left off"
      subtitle="Sign in to access your library, track orders, and keep learning with CodeBook's curated computer science ebooks."
      bullets={LOGIN_BULLETS}
    >
      <StaggerContainer className="w-full">
        <StaggerItem className="mb-6">
          <h1 className="text-2xl font-medium text-gray-700 dark:text-slate-100">
            Sign in
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            New to CodeBook?{" "}
            <Link
              to="/register"
              className="text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300 font-medium"
            >
              Create an account
            </Link>
          </p>
        </StaggerItem>

        <form onSubmit={handleLogin}>
          {/* Demo account quick-login — accounts come from the database (REQ-1510),
            clicking one logs in immediately with no password round trip. */}
          {demoAccounts.length > 0 && (
            // Mounts after the async useDemoAccounts() query resolves, so it
            // can't rely on the StaggerContainer's already-fired orchestration
            // (a late-mounting variant child won't replay a parent's past
            // transition) — ScrollReveal triggers its own animation on mount.
            <ScrollReveal direction="bottom" once className="mb-6">
              <FormLabel>Quick Login (Demo Accounts)</FormLabel>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  disabled={isDemoLoggingIn}
                  className="w-full bg-gray-50 border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 flex items-center justify-between disabled:opacity-60"
                >
                  <span>
                    {isDemoLoggingIn ? "Signing in…" : "Select a demo account"}
                  </span>
                  <svg
                    className={`w-4 h-4 transition-transform ${
                      isDropdownOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <>
                    {/* Backdrop to close dropdown */}
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsDropdownOpen(false)}
                    ></div>
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg dark:bg-gray-700 dark:border-gray-600">
                      <div className="py-1">
                        {demoAccounts.map((account) => (
                          <button
                            key={account.email}
                            type="button"
                            onClick={() => handleDemoLogin(account)}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 dark:text-white"
                          >
                            {DEMO_ROLE_LABELS[account.role] || account.name}
                            <span className="block text-xs text-gray-500 dark:text-gray-400">
                              {account.email}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollReveal>
          )}

          {/* Email Input */}
          <StaggerItem className="mb-6">
            <FormLabel htmlFor="email">Email</FormLabel>
            <FormInput
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="test@example.com"
              required
              autoComplete="off"
            />
          </StaggerItem>

          {/* Password Input */}
          <StaggerItem className="mb-6">
            <FormLabel htmlFor="password">Password</FormLabel>
            <FormInput
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </StaggerItem>

          {/* Login Button */}
          <StaggerItem>
            <div className="cta-shine-wrap rounded-lg w-full">
              <RippleButton
                type="submit"
                disabled={isSubmitting}
                className="cta-shine-button text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 disabled:opacity-60"
              >
                {isSubmitting ? "Signing in…" : "Sign in"}
              </RippleButton>
            </div>
          </StaggerItem>

          {/* Continue with Google (REQ-1500) */}
          <StaggerItem>
            <GoogleSignInButton />
          </StaggerItem>
        </form>
      </StaggerContainer>
    </AuthSplitLayout>
  );
};
