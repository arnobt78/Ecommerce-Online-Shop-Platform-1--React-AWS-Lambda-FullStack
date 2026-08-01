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
