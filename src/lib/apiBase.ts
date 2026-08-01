// Single source of truth for the backend base URL, used by every src/services/*
// module. Previously each service file hardcoded its own copy of this line with
// a fallback pointing at the now-retired AWS Lambda/API Gateway endpoint — if
// VITE_LAMBDA_API_URL was ever unset (fresh clone, misconfigured deploy target),
// requests would silently go to a dead endpoint instead of the real Express
// backend. Falls back to the documented local-dev backend port instead.
export const API_BASE_URL = import.meta.env.VITE_LAMBDA_API_URL || "http://localhost:3000";
