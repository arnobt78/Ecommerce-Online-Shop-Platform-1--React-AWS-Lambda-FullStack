// Parent: REQ-1200, REQ-1301, REQ-1304 — parity with aws-lambda/functions/products/*.js and
// aws-lambda/functions/admin/{generate-label unrelated}. Public routes are
// mounted at /products, admin routes at /admin/products (see app.ts).

import express, { type Request, type Response } from "express";
import { successResponse, errorResponse } from "../lib/response";
import { requireAuth, requireAdmin } from "../lib/auth";
import { getBaseUrl } from "../lib/requestContext";
import { logActivity } from "../services/activityLog.service";
import * as productsService from "../services/products.service";
import { createProductSchema, updateProductSchema } from "../services/products.service";
import { toCsv, fromCsv } from "../lib/csv";
import { generateProductDescription, AiInsightsUnavailableError } from "../services/aiInsights.service";

export const publicRouter = express.Router();
export const adminRouter = express.Router();

// GET /products?name_like=... — parity with functions/products/list.js
publicRouter.get("/products", async (req: Request, res: Response) => {
  try {
    const products = await productsService.getAllProducts((req.query.name_like as string) || "");
    return successResponse(res, products);
  } catch (error) {
    console.error("Products list error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// GET /products/:id — parity with functions/products/get.js
publicRouter.get("/products/:id", async (req: Request, res: Response) => {
  try {
    const product = await productsService.getProductById(req.params.id!);
    if (!product) return errorResponse(res, "Product not found", 404);
    return successResponse(res, product);
  } catch (error) {
    console.error("Product detail error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// GET /featured-products — client-side-filtering fallback path; kept for
// AWS Lambda route parity (REQ-1200). The frontend derives featured products
// from the already-cached full product list (useProducts.js useFeaturedProducts())
// rather than calling this endpoint directly.
publicRouter.get("/featured-products", async (_req: Request, res: Response) => {
  try {
    const products = await productsService.getFeaturedProducts();
    return successResponse(res, products);
  } catch (error) {
    console.error("Featured products error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// POST /admin/products — parity with functions/products/create.js
adminRouter.post("/admin/products", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, parsed.error.issues[0]?.message || "Invalid product data", 400);
    }

    const baseUrl = getBaseUrl(req);
    const product = await productsService.createProduct(parsed.data, baseUrl);

    logActivity({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: req.user!.name,
      action: "create",
      entityType: "product",
      entityId: product.id,
      details: { productName: product.name, productId: product.id },
    });

    return successResponse(res, product, 201);
  } catch (error) {
    console.error("Product create error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// POST /admin/products/generate-description — REQ-1664: on-demand AI draft
// (reuses the multi-provider chain from REQ-1613), never auto-saved — the
// admin reviews/edits in ProductForm and must still explicitly submit the form.
adminRouter.post("/admin/products/generate-description", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, author, category, level, tags } = (req.body || {}) as {
      name?: unknown; author?: unknown; category?: unknown; level?: unknown; tags?: unknown;
    };
    if (!name || typeof name !== "string") {
      return errorResponse(res, "name is required", 400);
    }

    const result = await generateProductDescription({
      name,
      author: typeof author === "string" ? author : undefined,
      category: typeof category === "string" ? category : undefined,
      level: typeof level === "string" ? level : undefined,
      tags: Array.isArray(tags) ? tags.filter((t): t is string => typeof t === "string") : undefined,
    });
    return successResponse(res, result);
  } catch (error) {
    if (error instanceof AiInsightsUnavailableError) {
      return errorResponse(res, { message: error.message, code: error.code }, 503);
    }
    console.error("Product description generation error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// PUT /admin/products/:id — parity with functions/products/update.js
adminRouter.put("/admin/products/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const productId = req.params.id!;
    const existingProduct = await productsService.getProductById(productId);
    if (!existingProduct) return errorResponse(res, "Product not found", 404);

    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, parsed.error.issues[0]?.message || "Invalid product data", 400);
    }

    const baseUrl = getBaseUrl(req);
    const updatedProduct = await productsService.updateProduct(productId, parsed.data, baseUrl);

    logActivity({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: req.user!.name,
      action: "update",
      entityType: "product",
      entityId: productId,
      details: { productName: updatedProduct.name, productId, updatedFields: Object.keys(req.body || {}) },
    });

    return successResponse(res, updatedProduct);
  } catch (error) {
    console.error("Product update error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// Parent: REQ-1662 — column order doubles as the export/re-import contract;
// `id` is included so a re-imported row updates the existing product instead
// of creating a duplicate.
const PRODUCT_CSV_COLUMNS = [
  "id", "name", "author", "category", "level", "pages", "price", "stock", "lowStockThreshold",
  "overview", "long_description", "image_local", "poster", "in_stock", "best_seller",
  "featured_product", "rating", "size", "sku", "isbn", "publisher", "publishedYear",
  "language", "edition", "fileFormat", "tags", "coverColor", "videoUrl",
];

// GET /admin/products/export — streamed CSV of the full catalog.
adminRouter.get("/admin/products/export", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const products = await productsService.getAllProducts();
    const rows = products.map((p) => ({
      id: p.id,
      name: p.name,
      author: p.author ?? "",
      category: p.category ?? "",
      level: p.level ?? "",
      pages: p.pages ?? "",
      price: p.price,
      stock: p.stock ?? "",
      lowStockThreshold: p.lowStockThreshold ?? "",
      overview: p.overview ?? "",
      long_description: p.long_description ?? "",
      image_local: p.image_local ?? "",
      poster: p.poster ?? "",
      in_stock: String(p.in_stock),
      best_seller: String(p.best_seller),
      featured_product: p.featured_product === 1 ? "true" : "false",
      rating: p.rating ?? "",
      size: p.size ?? "",
      sku: p.sku ?? "",
      isbn: p.isbn ?? "",
      publisher: p.publisher ?? "",
      publishedYear: p.publishedYear ?? "",
      language: p.language ?? "",
      edition: p.edition ?? "",
      fileFormat: p.fileFormat ?? "",
      tags: (p.tags || []).join("; "),
      coverColor: p.coverColor ?? "",
      videoUrl: p.videoUrl ?? "",
    }));

    const csv = toCsv(rows, PRODUCT_CSV_COLUMNS);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="products-export-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send(csv);
  } catch (error) {
    console.error("Product export error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Failed to export products" }, 500);
  }
});

const NUMERIC_CSV_FIELDS = new Set(["pages", "price", "stock", "lowStockThreshold", "rating", "size", "publishedYear"]);
const BOOLEAN_CSV_FIELDS = new Set(["in_stock", "best_seller"]);

// Converts a raw CSV row (every value a string) into the shape createProductSchema/
// updateProductSchema expect — numbers as numbers, tags as an array, booleans as booleans.
function coerceProductCsvRow(row: Record<string, string>): Record<string, unknown> {
  const coerced: Record<string, unknown> = {};
  for (const [key, rawValue] of Object.entries(row)) {
    const value = rawValue?.trim() ?? "";
    if (key === "id") continue; // handled separately by the caller, not a schema field
    if (value === "") continue; // omit blanks rather than overwriting with empty on update
    if (key === "tags") {
      coerced.tags = value.split(";").map((t) => t.trim()).filter(Boolean);
    } else if (key === "featured_product") {
      coerced.featured_product = value.toLowerCase() === "true" || value === "1";
    } else if (BOOLEAN_CSV_FIELDS.has(key)) {
      coerced[key] = value.toLowerCase() === "true";
    } else if (NUMERIC_CSV_FIELDS.has(key)) {
      coerced[key] = Number(value);
    } else {
      coerced[key] = value;
    }
  }
  return coerced;
}

interface CsvImportRowError {
  row: number;
  message: string;
}

// POST /admin/products/import { csv: string } — plain text body rather than
// multipart/file upload (no multer/file-handling infra exists in this
// backend at all — images upload client-side directly to Cloudinary — and a
// CSV is plain text, so the frontend just reads the File as text and sends
// it as JSON, avoiding a new dependency for this one feature).
adminRouter.post("/admin/products/import", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { csv } = (req.body || {}) as { csv?: unknown };
    if (typeof csv !== "string" || !csv.trim()) {
      return errorResponse(res, "csv (text) is required", 400);
    }

    let rows: Array<Record<string, string>>;
    try {
      rows = fromCsv(csv);
    } catch (parseError) {
      return errorResponse(res, `Failed to parse CSV: ${parseError instanceof Error ? parseError.message : String(parseError)}`, 400);
    }

    const baseUrl = getBaseUrl(req);
    const errors: CsvImportRowError[] = [];
    let created = 0;
    let updated = 0;

    // Sequential, not Promise.all — keeps per-row error reporting simple and
    // avoids hammering the DB with dozens of concurrent writes from one paste.
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const rowNumber = i + 2; // +1 for 0-index, +1 for the header row
      try {
        const id = row.id?.trim();
        const fields = coerceProductCsvRow(row);

        if (id) {
          const existing = await productsService.getProductById(id);
          if (!existing) {
            errors.push({ row: rowNumber, message: `Product id "${id}" not found — skipped` });
            continue;
          }
          const parsed = updateProductSchema.safeParse(fields);
          if (!parsed.success) {
            errors.push({ row: rowNumber, message: parsed.error.issues[0]?.message || "Invalid data" });
            continue;
          }
          await productsService.updateProduct(id, parsed.data, baseUrl);
          updated++;
        } else {
          const parsed = createProductSchema.safeParse(fields);
          if (!parsed.success) {
            errors.push({ row: rowNumber, message: parsed.error.issues[0]?.message || "Invalid data" });
            continue;
          }
          await productsService.createProduct(parsed.data, baseUrl);
          created++;
        }
      } catch (rowError) {
        errors.push({ row: rowNumber, message: rowError instanceof Error ? rowError.message : String(rowError) });
      }
    }

    logActivity({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: req.user!.name,
      action: "create",
      entityType: "product",
      entityId: "bulk-import",
      details: { created, updated, errorCount: errors.length },
    });

    return successResponse(res, { created, updated, errors });
  } catch (error) {
    console.error("Product import error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Failed to import products" }, 500);
  }
});

// DELETE /admin/products/:id — parity with functions/products/delete.js
adminRouter.delete("/admin/products/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const productId = req.params.id!;
    const existingProduct = await productsService.getProductById(productId);
    if (!existingProduct) return errorResponse(res, "Product not found", 404);

    await productsService.deleteProduct(productId);

    logActivity({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: req.user!.name,
      action: "delete",
      entityType: "product",
      entityId: productId,
      details: { productName: existingProduct.name, productId },
    });

    return successResponse(res, { message: "Product deleted successfully", id: productId });
  } catch (error) {
    console.error("Product delete error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
