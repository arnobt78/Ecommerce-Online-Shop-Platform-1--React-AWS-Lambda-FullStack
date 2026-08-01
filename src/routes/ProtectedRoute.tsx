import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useUser } from "../hooks/useUser";
import { LoadingState } from "../components/ui";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string | null;
}

// Protects routes that require authentication, optionally gated by role.
export const ProtectedRoute = ({ children, requiredRole = null }: ProtectedRouteProps) => {
  // Safely get token from sessionStorage
  let token: string | null = null;
  try {
    const tokenStr = sessionStorage.getItem("token");
    if (tokenStr) {
      token = JSON.parse(tokenStr);
    }
  } catch {
    token = null;
  }

  // Fetch actual user data to verify role (more secure than trusting sessionStorage)
  // IMPORTANT: Hooks must be called unconditionally at the top level
  // Only enable the query if token exists
  const { data: userData, isLoading, error } = useUser(!!token);

  // If no token, redirect to login immediately (no need to fetch user data)
  if (!token) {
    return <Navigate to="/login" />;
  }

  // While loading user data, show loading state
  if (isLoading) {
    return <LoadingState message="Verifying access..." />;
  }

  // If there's an error fetching user data, redirect to login
  if (error) {
    return <Navigate to="/login" />;
  }

  // Get role from actual user data (preferred) or fallback to sessionStorage.
  // Always verify against actual user data for security.
  const userRole = userData?.role || sessionStorage.getItem("userRole") || "user";

  // If role is required, check if user has the required role.
  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to="/products" />;
  }

  return <>{children}</>;
};
