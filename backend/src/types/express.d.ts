// Parent: REQ-1301, REQ-1302
// Augments Express's Request type globally so every route/middleware sees
// `req.user` as AuthUser | undefined without re-declaring it per file.
import type { AuthUser } from "./auth";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
