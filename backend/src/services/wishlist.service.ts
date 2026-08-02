// Parent: REQ-1656 — save-for-later wishlist. Thin wrapper over the Wishlist
// join table; the unique (userId, productId) constraint makes "add" naturally
// idempotent (a second add for the same product is a silent no-op, not an error).

import { Prisma, type Wishlist, type Product } from "@prisma/client";
import { prisma } from "../lib/prisma";

export type WishlistWithProduct = Wishlist & { product: Product };

export async function getWishlistByUserId(userId: string): Promise<WishlistWithProduct[]> {
  return prisma.wishlist.findMany({
    where: { userId },
    include: { product: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function isProductWishlisted(userId: string, productId: string): Promise<boolean> {
  const row = await prisma.wishlist.findUnique({ where: { userId_productId: { userId, productId } } });
  return row !== null;
}

export async function addToWishlist(userId: string, productId: string): Promise<WishlistWithProduct> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Product not found");

  try {
    return await prisma.wishlist.create({
      data: { userId, productId },
      include: { product: true },
    });
  } catch (error) {
    // Already wishlisted (unique constraint) — treat as success, return the existing row.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.wishlist.findUnique({
        where: { userId_productId: { userId, productId } },
        include: { product: true },
      });
      if (existing) return existing;
    }
    throw error;
  }
}

export async function removeFromWishlist(userId: string, productId: string): Promise<void> {
  await prisma.wishlist.deleteMany({ where: { userId, productId } });
}
