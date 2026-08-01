// Parent: REQ-1202, REQ-1205, REQ-1301, REQ-1304
// Ported from aws-lambda/shared/products.js — same function contracts and
// business rules (max 3 featured products, stock decrement/increment with
// race-condition protection), Prisma instead of DynamoDB Scan/Query/Update.

import { z } from "zod";
import type { Product } from "@prisma/client";
import { prisma } from "../lib/prisma";

// Parent: REQ-1304 — validated at the route boundary before reaching the service.
// `.passthrough()` intentionally not used: unknown fields are silently dropped,
// matching the allow-list behavior updateProduct already enforced by hand.
export const createProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  author: z.string().nullish(),
  category: z.string().nullish(),
  level: z.string().nullish(),
  pages: z.coerce.number().nullish(),
  price: z.coerce.number().min(0, "Price is required"),
  stock: z.coerce.number().nullish(),
  lowStockThreshold: z.coerce.number().nullish(),
  overview: z.string().nullish(),
  long_description: z.string().nullish(),
  image_local: z.string().nullish(),
  poster: z.string().nullish(),
  in_stock: z.boolean().nullish(),
  best_seller: z.boolean().nullish(),
  featured_product: z.union([z.boolean(), z.literal(0), z.literal(1)]).nullish(),
  rating: z.coerce.number().nullish(),
  size: z.coerce.number().nullish(),
  baseUrl: z.string().nullish(),
  // REQ-1616: catalog/inventory metadata
  sku: z.string().nullish(),
  isbn: z.string().nullish(),
  publisher: z.string().nullish(),
  publishedYear: z.coerce.number().nullish(),
  language: z.string().nullish(),
  edition: z.string().nullish(),
  fileFormat: z.string().nullish(),
  tags: z.array(z.string()).nullish(),
  // Cover art / trailer pass (see schema.prisma) — hex color and trailer video URL.
  coverColor: z.string().nullish(),
  videoUrl: z.string().nullish(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export async function getAllProducts(searchTerm = ""): Promise<Product[]> {
  return prisma.product.findMany({
    where: searchTerm
      ? {
          OR: [
            { name: { contains: searchTerm, mode: "insensitive" } },
            { overview: { contains: searchTerm, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
  });
}

export async function getProductById(id: string): Promise<Product | null> {
  return prisma.product.findUnique({ where: { id } });
}

export async function getFeaturedProductsCount(): Promise<number> {
  return prisma.product.count({ where: { featured_product: 1 } });
}

export async function getFeaturedProducts(): Promise<Product[]> {
  return prisma.product.findMany({
    where: { featured_product: 1 },
    take: 3,
  });
}

// Parent: REQ-1507 — stores the product URL (not a base64 image) so the
// frontend generates the QR code client-side, exactly like the AWS backend.
function buildQrCodeUrl(baseUrl: string | null | undefined, productId: string): string | undefined {
  return baseUrl ? `${baseUrl}/products/${productId}` : undefined;
}

export async function createProduct(
  productData: CreateProductInput,
  baseUrl: string | null = null
): Promise<Product> {
  const featuredValue = productData.featured_product === true || productData.featured_product === 1 ? 1 : 0;

  if (featuredValue === 1) {
    const featuredCount = await getFeaturedProductsCount();
    if (featuredCount >= 3) {
      throw new Error("Maximum 3 featured products allowed. Please uncheck another featured product first.");
    }
  }

  const product = await prisma.product.create({
    data: {
      name: productData.name,
      author: productData.author || null,
      category: productData.category || null,
      level: productData.level || null,
      pages: productData.pages !== undefined && productData.pages !== null ? Number(productData.pages) : null,
      price: Number(productData.price) || 0,
      stock: productData.stock !== undefined && productData.stock !== null ? Number(productData.stock) : null,
      lowStockThreshold:
        productData.lowStockThreshold !== undefined && productData.lowStockThreshold !== null
          ? Number(productData.lowStockThreshold)
          : null,
      overview: productData.overview || "",
      long_description: productData.long_description || "",
      image_local: productData.image_local || "",
      poster: productData.poster || "",
      in_stock: productData.in_stock !== undefined ? Boolean(productData.in_stock) : true,
      best_seller: Boolean(productData.best_seller),
      featured_product: featuredValue,
      rating: productData.rating !== undefined && productData.rating !== null ? Number(productData.rating) : null,
      size: productData.size !== undefined && productData.size !== null ? Number(productData.size) : null,
      // REQ-1616: catalog/inventory metadata
      sku: productData.sku || null,
      isbn: productData.isbn || null,
      publisher: productData.publisher || null,
      publishedYear:
        productData.publishedYear !== undefined && productData.publishedYear !== null ? Number(productData.publishedYear) : null,
      language: productData.language || null,
      edition: productData.edition || null,
      fileFormat: productData.fileFormat || null,
      tags: productData.tags || [],
      coverColor: productData.coverColor || null,
      videoUrl: productData.videoUrl || null,
    },
  });

  // qrCode needs the generated id, so it's a second write (cheap, one-time, on create only).
  const qrCode = buildQrCodeUrl(baseUrl, product.id);
  if (qrCode) {
    return prisma.product.update({ where: { id: product.id }, data: { qrCode } });
  }
  return product;
}

const NUMERIC_FIELDS = ["price", "rating", "stock", "lowStockThreshold", "size", "pages", "publishedYear"] as const;
const BOOLEAN_FIELDS = ["in_stock", "best_seller"] as const;
const ALLOWED_UPDATE_FIELDS = [
  "name",
  "author",
  "category",
  "level",
  "pages",
  "price",
  "stock",
  "lowStockThreshold",
  "overview",
  "long_description",
  "image_local",
  "poster",
  "in_stock",
  "best_seller",
  "featured_product",
  "rating",
  "size",
  "qrCode",
  // REQ-1616: catalog/inventory metadata
  "sku",
  "isbn",
  "publisher",
  "publishedYear",
  "language",
  "edition",
  "fileFormat",
  "tags",
  "coverColor",
  "videoUrl",
] as const;

export async function updateProduct(
  id: string,
  updates: UpdateProductInput & { qrCode?: string | null },
  baseUrl: string | null = null
): Promise<Product> {
  const currentProduct = await getProductById(id);
  if (!currentProduct) {
    throw new Error(`Product not found: ${id}`);
  }

  const data: Record<string, unknown> = {};

  if (updates.featured_product !== undefined) {
    const featuredValue = updates.featured_product === true || updates.featured_product === 1 ? 1 : 0;
    const isCurrentlyFeatured = currentProduct.featured_product === 1;
    if (featuredValue === 1 && !isCurrentlyFeatured) {
      const featuredCount = await getFeaturedProductsCount();
      if (featuredCount >= 3) {
        throw new Error("Maximum 3 featured products allowed. Please uncheck another featured product first.");
      }
    }
  }

  ALLOWED_UPDATE_FIELDS.forEach((field) => {
    const value = (updates as Record<string, unknown>)[field];
    if (value === undefined || value === null) return;

    if ((NUMERIC_FIELDS as readonly string[]).includes(field)) {
      data[field] = Number(value);
    } else if (field === "featured_product") {
      data.featured_product = value === true || value === 1 ? 1 : 0;
    } else if ((BOOLEAN_FIELDS as readonly string[]).includes(field)) {
      data[field] = Boolean(value);
    } else {
      data[field] = value;
    }
  });

  // Backfill a QR code URL if this product never had one (mirrors the AWS backend's cleanup logic).
  const hasBase64QrCode = Boolean(currentProduct.qrCode && currentProduct.qrCode.startsWith("data:image"));
  if ((!currentProduct.qrCode || hasBase64QrCode) && baseUrl) {
    data.qrCode = buildQrCodeUrl(baseUrl, id);
  }

  if (Object.keys(data).length === 0) {
    throw new Error("No valid fields to update");
  }

  return prisma.product.update({ where: { id }, data });
}

export async function deleteProduct(id: string): Promise<true> {
  await prisma.product.delete({ where: { id } });
  return true;
}

export interface StockUpdateResult extends Product {
  _shouldTriggerLowStockAlert?: boolean;
  _lowStockThreshold?: number;
}

// Race-condition-safe decrement: only succeeds if stock hasn't changed since
// it was read (mirrors the DynamoDB ConditionExpression). Retried by the
// caller is not needed here since order creation already fails loudly on
// insufficient/contended stock, matching the AWS backend's behavior.
export async function decrementProductStock(productId: string, quantity: number): Promise<StockUpdateResult> {
  const product = await getProductById(productId);
  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  if (product.stock === null || product.stock === undefined) {
    return product; // no stock tracking for this product — nothing to do
  }

  const currentStock = Number(product.stock) || 0;
  const decrementAmount = Number(quantity) || 0;

  if (currentStock < decrementAmount) {
    throw new Error(
      `Insufficient stock for product ${product.name || productId}. Available: ${currentStock}, Requested: ${decrementAmount}`
    );
  }

  const newStock = Math.max(0, currentStock - decrementAmount);
  const newInStock = newStock > 0;

  const result = await prisma.product.updateMany({
    where: { id: productId, stock: currentStock }, // optimistic lock
    data: { stock: newStock, in_stock: newInStock },
  });

  if (result.count === 0) {
    throw new Error(`ConditionalCheckFailedException: stock for ${productId} changed concurrently`);
  }

  const updatedProduct = await getProductById(productId);
  if (!updatedProduct) {
    throw new Error(`Product not found: ${productId}`);
  }
  const lowStockThreshold = updatedProduct.lowStockThreshold ?? undefined;
  const shouldTriggerLowStockAlert =
    lowStockThreshold !== undefined && updatedProduct.stock! < lowStockThreshold && currentStock >= lowStockThreshold;

  return {
    ...updatedProduct,
    _shouldTriggerLowStockAlert: shouldTriggerLowStockAlert,
    _lowStockThreshold: lowStockThreshold,
  };
}

export async function incrementProductStock(productId: string, quantity: number): Promise<Product> {
  const product = await getProductById(productId);
  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  if (product.stock === null || product.stock === undefined) {
    return product;
  }

  const currentStock = Number(product.stock) || 0;
  const incrementAmount = Number(quantity) || 0;
  const newStock = currentStock + incrementAmount;
  const newInStock = newStock > 0;

  return prisma.product.update({
    where: { id: productId },
    data: { stock: newStock, in_stock: newInStock },
  });
}
