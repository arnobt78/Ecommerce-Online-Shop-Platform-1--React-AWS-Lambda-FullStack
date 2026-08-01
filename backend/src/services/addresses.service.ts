// Parent: REQ-1618 — customer address book. Self-service CRUD, ownership
// always derived from the authenticated user (never trusts a userId in the
// request body), with a single-default-per-user invariant enforced here
// since Prisma has no partial-unique-index support for it.

import { z } from "zod";
import type { Address } from "@prisma/client";
import { prisma } from "../lib/prisma";

export const addressInputSchema = z.object({
  label: z.string().max(50).optional(),
  fullName: z.string().min(1, "Full name is required").max(200),
  street1: z.string().min(1, "Street address is required").max(200),
  street2: z.string().max(200).optional(),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(1, "State is required").max(100),
  zip: z.string().min(1, "ZIP/postal code is required").max(20),
  country: z.string().min(1).max(2).default("US"),
  phone: z.string().max(30).optional(),
  isDefault: z.boolean().optional(),
});
export type AddressInput = z.infer<typeof addressInputSchema>;
export const updateAddressSchema = addressInputSchema.partial();
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;

export async function getAddressesByUserId(userId: string): Promise<Address[]> {
  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

export async function createAddress(userId: string, input: AddressInput): Promise<Address> {
  const existingCount = await prisma.address.count({ where: { userId } });
  const makeDefault = input.isDefault === true || existingCount === 0;

  if (makeDefault) {
    await prisma.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
  }

  return prisma.address.create({
    data: { ...input, userId, isDefault: makeDefault },
  });
}

export async function updateAddress(userId: string, addressId: string, input: UpdateAddressInput): Promise<Address> {
  const existing = await prisma.address.findUnique({ where: { id: addressId } });
  if (!existing || existing.userId !== userId) {
    throw new Error("Address not found");
  }

  if (input.isDefault === true) {
    await prisma.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
  }

  return prisma.address.update({ where: { id: addressId }, data: input });
}

export async function deleteAddress(userId: string, addressId: string): Promise<{ message: string; id: string }> {
  const existing = await prisma.address.findUnique({ where: { id: addressId } });
  if (!existing || existing.userId !== userId) {
    throw new Error("Address not found");
  }

  await prisma.address.delete({ where: { id: addressId } });

  // Promote the oldest remaining address to default so a user is never left
  // with saved addresses but none marked default.
  if (existing.isDefault) {
    const next = await prisma.address.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
    if (next) {
      await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }

  return { message: "Address deleted successfully", id: addressId };
}
