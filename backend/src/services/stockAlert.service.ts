// Parent: REQ-1657 — "Notify me" back-in-stock subscription. Sends via the
// existing Brevo templated-email infra (email.service.ts), reusing the same
// pattern as the low-stock digest (REQ-1654).

import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sendTemplatedEmail } from "./email.service";

export async function subscribeToStockAlert(productId: string, email: string, userId: string | null): Promise<void> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Product not found");

  try {
    await prisma.stockAlert.create({ data: { productId, email, userId: userId || undefined } });
  } catch (error) {
    // Already subscribed (unique constraint on productId+email) — idempotent no-op.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
    throw error;
  }
}

// Parent: REQ-1657 — called from products.service.updateProduct() whenever a
// product's stock transitions from 0 to a positive number. Notifies every
// pending subscriber in parallel, then marks each row notified (never deletes
// — notifiedAt gives a lightweight send-history audit trail).
export async function notifyStockAlertSubscribers(productId: string, productName: string): Promise<number> {
  const pending = await prisma.stockAlert.findMany({ where: { productId, notifiedAt: null } });
  if (pending.length === 0) return 0;

  await Promise.all(
    pending.map((alert) =>
      sendTemplatedEmail(alert.email, "back-in-stock", { productId, productName }).catch((error) => {
        console.error(`Failed to send back-in-stock email to ${alert.email}:`, error);
      })
    )
  );

  await prisma.stockAlert.updateMany({
    where: { id: { in: pending.map((a) => a.id) } },
    data: { notifiedAt: new Date() },
  });

  return pending.length;
}
