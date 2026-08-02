// Parent: REQ-1658 — checkout discount codes. Every validation/discount
// calculation lives here so it's the single source of truth for both the
// admin CRUD routes and the checkout-time apply/verify calls — the discount
// amount a client sees at checkout is always re-derived server-side at
// order-creation time too (see orders.routes.ts), never trusted as-is.

import { z } from "zod";
import type { Coupon } from "@prisma/client";
import { prisma } from "../lib/prisma";

export const createCouponSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(30)
    .transform((c) => c.trim().toUpperCase()),
  type: z.enum(["percent", "fixed"]),
  value: z.coerce.number().positive(),
  minOrderAmount: z.coerce.number().nonnegative().nullish(),
  maxUses: z.coerce.number().int().positive().nullish(),
  expiresAt: z.coerce.date().nullish(),
  active: z.boolean().optional(),
});
export type CreateCouponInput = z.infer<typeof createCouponSchema>;

export const updateCouponSchema = createCouponSchema.partial();
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;

export async function getAllCoupons(): Promise<Coupon[]> {
  return prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getCouponById(id: string): Promise<Coupon | null> {
  return prisma.coupon.findUnique({ where: { id } });
}

export async function createCoupon(input: CreateCouponInput): Promise<Coupon> {
  return prisma.coupon.create({
    data: {
      code: input.code,
      type: input.type,
      value: input.value,
      minOrderAmount: input.minOrderAmount ?? null,
      maxUses: input.maxUses ?? null,
      expiresAt: input.expiresAt ?? null,
      active: input.active ?? true,
    },
  });
}

export async function updateCoupon(id: string, input: UpdateCouponInput): Promise<Coupon> {
  const existing = await getCouponById(id);
  if (!existing) throw new Error("Coupon not found");

  return prisma.coupon.update({
    where: { id },
    data: {
      ...(input.code !== undefined && { code: input.code }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.value !== undefined && { value: input.value }),
      ...(input.minOrderAmount !== undefined && { minOrderAmount: input.minOrderAmount }),
      ...(input.maxUses !== undefined && { maxUses: input.maxUses }),
      ...(input.expiresAt !== undefined && { expiresAt: input.expiresAt }),
      ...(input.active !== undefined && { active: input.active }),
    },
  });
}

export async function deleteCoupon(id: string): Promise<true> {
  await prisma.coupon.delete({ where: { id } });
  return true;
}

export interface CouponValidationResult {
  coupon: Coupon;
  discountAmountCents: number;
}

// Parent: REQ-1658 — the one function both /payment/create-intent and
// /orders call to (re)compute the discount server-side. `subtotalCents` is
// always the server's own recomputed cart total (see payment.routes.ts),
// never a client-sent figure, so a coupon can't be combined with a tampered
// subtotal to manufacture a larger discount than intended.
export async function validateAndApplyCoupon(code: string, subtotalCents: number): Promise<CouponValidationResult> {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!coupon) throw new Error("Invalid coupon code");
  if (!coupon.active) throw new Error("This coupon is no longer active");
  if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new Error("This coupon has expired");
  if (coupon.maxUses !== null && coupon.timesUsed >= coupon.maxUses) throw new Error("This coupon has reached its usage limit");
  if (coupon.minOrderAmount !== null && subtotalCents < Math.round(coupon.minOrderAmount * 100)) {
    throw new Error(`This coupon requires a minimum order of $${coupon.minOrderAmount.toFixed(2)}`);
  }

  const discountAmountCents =
    coupon.type === "percent"
      ? Math.round((subtotalCents * coupon.value) / 100)
      : Math.min(subtotalCents, Math.round(coupon.value * 100));

  return { coupon, discountAmountCents };
}

// Parent: REQ-1658 — increments usage only once an order is actually
// created (not at the earlier "apply at checkout" validation step), so an
// abandoned checkout never consumes a limited-use coupon's redemption count.
export async function incrementCouponUsage(code: string): Promise<void> {
  await prisma.coupon.updateMany({
    where: { code: code.trim().toUpperCase() },
    data: { timesUsed: { increment: 1 } },
  });
}
