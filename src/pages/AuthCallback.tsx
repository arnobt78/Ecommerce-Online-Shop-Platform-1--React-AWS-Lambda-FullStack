/**
 * AuthCallback
 *
 * Landing page for the Google OAuth2 redirect (REQ-1503). The backend
 * redirects here with `#token=...&user=...` on success (URL fragment, not
 * query string, so the token never touches server logs or the Referer
 * header), or `?error=...` on failure. Runs the exact same session-bootstrap
 * Login.js does after a normal email/password login, so the rest of the app
 * can't tell the difference between the two sign-in paths.
 */

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "../lib/toast";
import { useQueryClient } from "@tanstack/react-query";
import { useTitle } from "../hooks/useTitle";
import { getNotificationCount } from "../services/notificationService";

interface OAuthCallbackUser {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  image?: string;
}

export const AuthCallback = () => {
  useTitle("Signing in...");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return; // StrictMode double-invoke guard
    hasRun.current = true;

    const hashParams = new URLSearchParams(
      window.location.hash.replace(/^#/, ""),
    );
    const queryParams = new URLSearchParams(window.location.search);
    const error = queryParams.get("error") || hashParams.get("error");

    if (error) {
      toast.error(
        "Google sign-in failed. Please try again or use email/password.",
        {
          closeButton: true,
          position: "bottom-right",
        },
      );
      navigate("/login");
      return;
    }

    const token = hashParams.get("token");
    const refreshToken = hashParams.get("refreshToken");
    const userJson = hashParams.get("user");

    if (!token || !userJson) {
      toast.error("Sign-in response was incomplete. Please try again.", {
        closeButton: true,
        position: "bottom-right",
      });
      navigate("/login");
      return;
    }

    try {
      const user: OAuthCallbackUser = JSON.parse(userJson);

      // Same sessionStorage contract as authService.ts login()/register().
      sessionStorage.setItem("token", JSON.stringify(token));
      if (refreshToken) sessionStorage.setItem("refreshToken", JSON.stringify(refreshToken)); // REQ-1667
      sessionStorage.setItem("cbid", JSON.stringify(user.id));
      if (user.email) sessionStorage.setItem("userEmail", user.email);
      if (user.name) sessionStorage.setItem("userName", user.name);
      sessionStorage.setItem("userRole", user.role || "user");
      if (user.image) {
        sessionStorage.setItem("userImage", user.image);
      } else {
        sessionStorage.removeItem("userImage");
      }
      window.dispatchEvent(new Event("sessionStorageChange"));

      // Same post-login cache handling as Login.js's handleLogin.
      queryClient.clear();
      queryClient.prefetchQuery({
        queryKey: ["notification-count"],
        queryFn: getNotificationCount,
        staleTime: 0,
      });

      navigate("/products");
    } catch (parseError) {
      toast.error(
        parseError instanceof Error ? parseError.message : String(parseError),
        {
          closeButton: true,
          position: "bottom-right",
        },
      );
      navigate("/login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main>
      <section>
        <p className="text-2xl text-center font-medium dark:text-slate-100 my-10">
          Signing you in...
        </p>
      </section>
    </main>
  );
};
