// Parent: REQ-1301, REQ-1302, REQ-1305
// Single source of truth for the decoded-JWT shape attached to `req.user` by
// requireAuth (lib/auth.ts). Kept separate from Prisma's generated User type
// because the JWT payload is a deliberately-trimmed subset (id/email/name/role),
// never the full DB row.
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}
