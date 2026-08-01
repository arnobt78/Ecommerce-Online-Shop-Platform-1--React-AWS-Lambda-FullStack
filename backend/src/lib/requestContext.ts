// Parent: REQ-1200 (products/create.js, products/update.js parity), REQ-1301
// Same base-URL priority order the AWS Lambda handlers used, so generated
// QR code URLs keep pointing at the storefront product page.

import type { Request } from "express";

export function getBaseUrl(req: Request): string | null {
  const forwardedHost = req.headers["x-forwarded-host"];
  return (
    process.env.BASE_URL ||
    req.body?.baseUrl ||
    req.headers.origin ||
    (forwardedHost ? `https://${forwardedHost}` : null)
  );
}
