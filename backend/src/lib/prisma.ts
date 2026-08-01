// Parent: REQ-1201, REQ-1202, REQ-1301
// Single Prisma Client instance, reused across the app (avoids exhausting
// Postgres connections under Fluid/serverless-style redeploys).

import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
