/**
 * AWS Lambda - Products Helper Functions
 *
 * This module contains helper functions for product operations.
 * These functions are used by Lambda functions to interact with DynamoDB.
 *
 * Note: This is similar to lib/products.js but adapted for Lambda environment.
 */

const { dynamoDB, TABLES } = require("./dynamodb");
const {
  ScanCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");
const { generateProductQRCode } = require("./qrcode");

// Lazy load uuid (ESM module) - will be imported when needed
let uuidModule = null;
async function getUuid() {
  if (!uuidModule) {
    uuidModule = await import("uuid");
  }
  const { v4: uuidv4 } = uuidModule;
  return uuidv4();
}

/**
 * Get all products (with optional search)
 *
 * @param {string} searchTerm - Optional search term to filter products
 * @returns {Promise<Array>} Array of products
 *
 * How it works:
 * 1. Uses DynamoDB ScanCommand to get all items from Products table
 * 2. If searchTerm is provided, filters products by name or overview
 * 3. Returns array of products
 *
 * Note: ScanCommand reads all items (good for small datasets)
 * For larger datasets, consider using QueryCommand with GSI (Global Secondary Index)
 */
async function getAllProducts(searchTerm = "") {
  try {
    const command = new ScanCommand({
      TableName: TABLES.PRODUCTS,
    });

    const result = await dynamoDB.send(command);
    let products = result.Items || [];

    // Ensure products is always an array
    if (!Array.isArray(products)) {
      console.warn(
        "getAllProducts: result.Items is not an array, converting:",
        typeof products
      );
      products = [];
    }

    // Filter by search term if provided (client-side filtering)
    // In production, consider using DynamoDB FilterExpression for better performance
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      products = products.filter(
        (product) =>
          product?.name?.toLowerCase().includes(term) ||
          product?.overview?.toLowerCase().includes(term)
      );
    }

    // Ensure all products have required fields and handle undefined/null values
    products = products
      .map((product) => {
        // Return product as-is, but ensure it's a valid object
        if (!product || typeof product !== "object") {
          console.warn("getAllProducts: Invalid product found:", product);
          return null;
        }
        return product;
      })
      .filter(Boolean); // Remove any null/undefined products

    // Log successful retrieval for debugging
    console.log("getAllProducts success:", {
      totalProducts: products.length,
      searchTerm: searchTerm || "none",
      tableName: TABLES.PRODUCTS,
    });

    return products;
  } catch (error) {
    console.error("getAllProducts error:", {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack,
      errorString: String(error),
      tableName: TABLES.PRODUCTS,
    });

    // Check if table doesn't exist
    if (
      error.name === "ResourceNotFoundException" ||
      error.message?.includes("does not exist")
    ) {
      throw new Error(
        `DynamoDB table '${TABLES.PRODUCTS}' does not exist. Please create the table first.`
      );
    }

    // Re-throw with more context
    throw new Error(`Failed to get products: ${error.message}`);
  }
}

/**
 * Get product by ID
 *
 * @param {string} id - Product ID (UUID)
 * @returns {Promise<Object|null>} Product object or null if not found
 *
 * How it works:
 * 1. Uses DynamoDB GetCommand to fetch a single item by primary key (id)
 * 2. Returns the product or null if not found
 */
async function getProductById(id) {
  try {
    const command = new GetCommand({
      TableName: TABLES.PRODUCTS,
      Key: { id: id },
    });

    const result = await dynamoDB.send(command);
    return result.Item || null;
  } catch (error) {
    console.error("getProductById error:", error);
    throw error;
  }
}

/**
 * Get featured products from products table
 * Filters products where featured_product = 1 (Number type for GSI support)
 *
 * @returns {Promise<Array>} Array of featured products (max 3)
 *
 * How it works:
 * 1. Uses QueryCommand with GSI (featured-product-index) if available, otherwise ScanCommand
 * 2. Filters for featured_product = 1 (Number type, 1 = featured, 0 = not featured)
 * 3. Returns featured products (limited to 3 for consistency)
 *
 * Note: featured_product is stored as Number (1/0) instead of Boolean to support GSI
 */
async function getFeaturedProducts() {
  try {
    // Try to use GSI Query first (more efficient)
    try {
      const { QueryCommand } = require("@aws-sdk/lib-dynamodb");
      const command = new QueryCommand({
        TableName: TABLES.PRODUCTS,
        IndexName: "featured-product-index",
        KeyConditionExpression: "#featured = :featured",
        ExpressionAttributeNames: {
          "#featured": "featured_product",
        },
        ExpressionAttributeValues: {
          ":featured": 1, // Number: 1 = featured, 0 = not featured
        },
        Limit: 3,
      });

      const result = await dynamoDB.send(command);
      if (result.Items && result.Items.length > 0) {
        return result.Items;
      }
    } catch (gsiError) {
      // GSI not available yet, fall back to ScanCommand
      console.log("GSI not available, using ScanCommand:", gsiError.message);
    }

    // Fallback: Use ScanCommand with FilterExpression
    const command = new ScanCommand({
      TableName: TABLES.PRODUCTS,
      FilterExpression: "#featured = :featured",
      ExpressionAttributeNames: {
        "#featured": "featured_product", // 'featured' is a reserved keyword
      },
      ExpressionAttributeValues: {
        ":featured": 1, // Number: 1 = featured, 0 = not featured
      },
      Limit: 3, // Limit to 3 featured products
    });

    const result = await dynamoDB.send(command);
    return result.Items || [];
  } catch (error) {
    console.error("getFeaturedProducts error:", error);
    // If filter fails (e.g., no products with featured_product field yet), return empty array
    // This allows graceful migration
    if (
      error.name === "ValidationException" ||
      error.message?.includes("featured_product")
    ) {
      return [];
    }
    throw error;
  }
}

/**
 * Get count of featured products
 * Helper function to check how many products are currently marked as featured
 *
 * @returns {Promise<number>} Count of featured products
 *
 * Note: featured_product is stored as Number (1/0) instead of Boolean to support GSI
 */
async function getFeaturedProductsCount() {
  try {
    // Try to use GSI Query first (more efficient)
    try {
      const { QueryCommand } = require("@aws-sdk/lib-dynamodb");
      const command = new QueryCommand({
        TableName: TABLES.PRODUCTS,
        IndexName: "featured-product-index",
        KeyConditionExpression: "#featured = :featured",
        ExpressionAttributeNames: {
          "#featured": "featured_product",
        },
        ExpressionAttributeValues: {
          ":featured": 1, // Number: 1 = featured, 0 = not featured
        },
        Select: "COUNT", // Only count, don't return items
      });

      const result = await dynamoDB.send(command);
      if (result.Count !== undefined) {
        return result.Count;
      }
    } catch (gsiError) {
      // GSI not available yet, fall back to ScanCommand
      console.log("GSI not available, using ScanCommand:", gsiError.message);
    }

    // Fallback: Use ScanCommand with FilterExpression
    const command = new ScanCommand({
      TableName: TABLES.PRODUCTS,
      FilterExpression: "#featured = :featured",
      ExpressionAttributeNames: {
        "#featured": "featured_product", // 'featured' is a reserved keyword
      },
      ExpressionAttributeValues: {
        ":featured": 1, // Number: 1 = featured, 0 = not featured
      },
      Select: "COUNT", // Only count, don't return items
    });

    const result = await dynamoDB.send(command);
    return result.Count || 0;
  } catch (error) {
    console.error("getFeaturedProductsCount error:", error);
    // If filter fails (e.g., no products with featured_product field yet), return 0
    return 0;
  }
}

/**
 * Create a new product
 *
 * @param {Object} productData - Product data (name, price, description, etc.)
 * @param {string} baseUrl - Base URL for QR code generation (e.g., "https://codebook-aws.vercel.app")
 * @returns {Promise<Object>} Created product with generated ID
 *
 * Required fields: name, price
 * Optional fields: overview, long_description, image_local, poster, in_stock, best_seller, featured_product, rating
 */
async function createProduct(productData, baseUrl = null) {
  try {
    // Convert featured_product to Number (1/0) for GSI support
    // Accept both Boolean and Number for backward compatibility
    const featuredValue =
      productData.featured_product !== undefined
        ? productData.featured_product === true ||
          productData.featured_product === 1
          ? 1
          : 0
        : 0;

    // Validate featured_product: max 3 featured products allowed
    if (featuredValue === 1) {
      const featuredCount = await getFeaturedProductsCount();
      if (featuredCount >= 3) {
        throw new Error(
          "Maximum 3 featured products allowed. Please uncheck another featured product first."
        );
      }
    }

    // Generate UUID for product ID
    const id = await getUuid();

    // Store QR code URL (not base64 PNG) to minimize DynamoDB storage and RCU consumption
    // Frontend will generate QR code from URL client-side (fast, no cost)
    // This stores only ~100 bytes (URL string) instead of 2-4KB (base64 PNG)
    let qrCode = null;
    if (baseUrl) {
      // Store the product URL string, not the base64 PNG
      // Frontend component will generate QR code from this URL
      qrCode = `${baseUrl}/products/${id}`;
      console.log(`✅ QR code URL stored for product ${id}: ${qrCode}`);
    }

    // Prepare product object with required fields
    // Note: featured_product is stored as Number (1/0) instead of Boolean to support GSI
    const product = {
      id,
      name: productData.name,
      price: Number(productData.price) || 0,
      stock:
        productData.stock !== undefined ? Number(productData.stock) : undefined,
      lowStockThreshold:
        productData.lowStockThreshold !== undefined
          ? Number(productData.lowStockThreshold)
          : undefined,
      overview: productData.overview || "",
      long_description: productData.long_description || "",
      image_local: productData.image_local || "",
      poster: productData.poster || "",
      in_stock:
        productData.in_stock !== undefined
          ? Boolean(productData.in_stock)
          : true,
      best_seller:
        productData.best_seller !== undefined
          ? Boolean(productData.best_seller)
          : false,
      featured_product: featuredValue, // Number: 1 = featured, 0 = not featured (for GSI support)
      rating:
        productData.rating !== undefined
          ? Number(productData.rating)
          : undefined,
      qrCode: qrCode || undefined, // Store QR code as base64 data URL
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const command = new PutCommand({
      TableName: TABLES.PRODUCTS,
      Item: product,
    });

    await dynamoDB.send(command);
    return product;
  } catch (error) {
    console.error("createProduct error:", error);
    throw error;
  }
}

/**
 * Update an existing product
 *
 * @param {string} id - Product ID (UUID)
 * @param {Object} updates - Fields to update
 * @param {string} baseUrl - Base URL for QR code generation (optional, used if product doesn't have QR code)
 * @returns {Promise<Object>} Updated product
 */
async function updateProduct(id, updates, baseUrl = null) {
  try {
    // Get current product to check if it has QR code
    const currentProduct = await getProductById(id);
    if (!currentProduct) {
      throw new Error(`Product not found: ${id}`);
    }

    // Store QR code URL (not base64 PNG) to minimize DynamoDB storage and RCU consumption
    // Frontend will generate QR code from URL client-side (fast, no cost)
    // This stores only ~100 bytes (URL string) instead of 2-4KB (base64 PNG)
    // Replace base64 PNG with URL if product doesn't have qrCode OR if it has base64 PNG (cleanup)
    const hasBase64QRCode = currentProduct.qrCode && currentProduct.qrCode.startsWith("data:image");
    if ((!currentProduct.qrCode || hasBase64QRCode) && baseUrl) {
      // Store the product URL string, replacing base64 PNG if it exists
      // Frontend component will generate QR code from this URL
      updates.qrCode = `${baseUrl}/products/${id}`;
      if (hasBase64QRCode) {
        console.log(`✅ QR code URL stored (replaced base64 PNG) for product ${id}: ${updates.qrCode}`);
      } else {
        console.log(`✅ QR code URL stored for existing product ${id}: ${updates.qrCode}`);
      }
    }

    // Convert featured_product to Number (1/0) for GSI support
    // Accept both Boolean and Number for backward compatibility
    let featuredValue = undefined;
    if (updates.featured_product !== undefined) {
      featuredValue =
        updates.featured_product === true || updates.featured_product === 1
          ? 1
          : 0;
    }

    // Validate featured_product: max 3 featured products allowed
    // Only check if trying to set featured_product to 1 (featured)
    if (featuredValue === 1) {
      // Handle both Number and Boolean for backward compatibility
      const isCurrentlyFeatured =
        currentProduct?.featured_product === 1 ||
        currentProduct?.featured_product === true;

      // Only validate if trying to set a new product as featured
      if (!isCurrentlyFeatured) {
        const featuredCount = await getFeaturedProductsCount();
        if (featuredCount >= 3) {
          throw new Error(
            "Maximum 3 featured products allowed. Please uncheck another featured product first."
          );
        }
      }
    }

    // Build update expression dynamically based on provided fields
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    // Allowed fields to update (added featured_product, rating, stock, lowStockThreshold, qrCode)
    const allowedFields = [
      "name",
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
      "qrCode",
    ];

    allowedFields.forEach((field) => {
      // Check if field exists and is not undefined (but allow 0, false, and empty string for some fields)
      // For stock and lowStockThreshold, we need to explicitly check for undefined/null, not falsy values
      const shouldInclude =
        updates[field] !== undefined && updates[field] !== null;

      if (shouldInclude) {
        const nameKey = `#${field}`;
        const valueKey = `:${field}`;
        updateExpressions.push(`${nameKey} = ${valueKey}`);

        // Handle reserved keywords and field names
        if (field === "featured_product") {
          expressionAttributeNames[nameKey] = "featured_product"; // Use full field name
        } else {
          expressionAttributeNames[nameKey] = field;
        }

        // Convert price to number, boolean fields to boolean, featured_product to Number, rating to Number, stock fields to Number
        // IMPORTANT: For stock and lowStockThreshold, 0 is a valid value, so we must preserve it
        if (
          field === "price" ||
          field === "rating" ||
          field === "stock" ||
          field === "lowStockThreshold"
        ) {
          const numValue = Number(updates[field]);
          // Allow 0 as a valid value (don't skip it)
          expressionAttributeValues[valueKey] = numValue;
          console.log(
            `Updating ${field} to:`,
            numValue,
            `(original: ${updates[field]}, type: ${typeof updates[field]})`
          );
        } else if (field === "featured_product") {
          // Store as Number (1/0) for GSI support
          expressionAttributeValues[valueKey] = featuredValue;
        } else if (field === "in_stock" || field === "best_seller") {
          expressionAttributeValues[valueKey] = Boolean(updates[field]);
        } else {
          expressionAttributeValues[valueKey] = updates[field];
        }
      } else {
        // Log why field is being skipped (for debugging)
        if (field === "stock" || field === "lowStockThreshold") {
          console.log(
            `Skipping ${field} update: value is ${
              updates[field]
            } (type: ${typeof updates[field]})`
          );
        }
      }
    });

    // Always update updatedAt timestamp
    updateExpressions.push("#updatedAt = :updatedAt");
    expressionAttributeNames["#updatedAt"] = "updatedAt";
    expressionAttributeValues[":updatedAt"] = new Date().toISOString();

    if (updateExpressions.length === 0) {
      throw new Error("No valid fields to update");
    }

    // Debug logging to verify update expression
    console.log("📝 updateProduct - Update expression:", {
      productId: id,
      updateExpressions,
      expressionAttributeNames,
      expressionAttributeValues,
      stockInExpression: expressionAttributeValues[":stock"],
      lowStockThresholdInExpression:
        expressionAttributeValues[":lowStockThreshold"],
    });

    const command = new UpdateCommand({
      TableName: TABLES.PRODUCTS,
      Key: { id },
      UpdateExpression: `SET ${updateExpressions.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    });

    const result = await dynamoDB.send(command);

    // Debug logging to verify DynamoDB response
    console.log("✅ updateProduct - DynamoDB response:", {
      productId: id,
      attributesReturned: result.Attributes,
      stock: result.Attributes?.stock,
      stockType: typeof result.Attributes?.stock,
      lowStockThreshold: result.Attributes?.lowStockThreshold,
      lowStockThresholdType: typeof result.Attributes?.lowStockThreshold,
    });

    return result.Attributes;
  } catch (error) {
    console.error("updateProduct error:", error);
    throw error;
  }
}

/**
 * Delete a product by ID
 *
 * @param {string} id - Product ID (UUID)
 * @returns {Promise<boolean>} True if deleted successfully
 */
async function deleteProduct(id) {
  try {
    const command = new DeleteCommand({
      TableName: TABLES.PRODUCTS,
      Key: { id },
    });

    await dynamoDB.send(command);
    return true;
  } catch (error) {
    console.error("deleteProduct error:", error);
    throw error;
  }
}

/**
 * Decrement product stock by quantity (used when order is placed)
 * Only updates if product has stock tracking enabled (stock !== undefined)
 *
 * @param {string} productId - Product ID (UUID)
 * @param {number} quantity - Quantity to decrement
 * @returns {Promise<Object>} Updated product
 * @throws {Error} If stock would go negative or product not found
 */
async function decrementProductStock(productId, quantity) {
  try {
    // Get current product to check stock
    const product = await getProductById(productId);
    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }

    // If product doesn't have stock tracking, skip update
    if (product.stock === undefined) {
      console.log(
        `Product ${productId} doesn't have stock tracking, skipping stock update`
      );
      return product;
    }

    const currentStock = Number(product.stock) || 0;
    const decrementAmount = Number(quantity) || 0;

    // Validate stock availability
    if (currentStock < decrementAmount) {
      throw new Error(
        `Insufficient stock for product ${
          product.name || productId
        }. Available: ${currentStock}, Requested: ${decrementAmount}`
      );
    }

    // Calculate new stock
    const newStock = Math.max(0, currentStock - decrementAmount); // Ensure non-negative

    // Automatically update in_stock boolean based on new stock value
    const newInStock = newStock > 0;

    // Update product stock and in_stock status
    // Use ConditionExpression to prevent race conditions (ensure stock hasn't changed since we read it)
    const command = new UpdateCommand({
      TableName: TABLES.PRODUCTS,
      Key: { id: productId },
      UpdateExpression:
        "SET stock = :stock, in_stock = :in_stock, updatedAt = :updatedAt",
      ConditionExpression: "stock = :currentStock", // Ensure stock hasn't changed (prevents race conditions)
      ExpressionAttributeValues: {
        ":stock": newStock,
        ":in_stock": newInStock,
        ":currentStock": currentStock, // Current stock value we read
        ":updatedAt": new Date().toISOString(),
      },
      ReturnValues: "ALL_NEW",
    });

    const result = await dynamoDB.send(command);
    const updatedProduct = result.Attributes;

    // Check if stock is now below low stock threshold
    // Only trigger if: threshold is set, new stock is below threshold, and old stock was above threshold
    const lowStockThreshold = Number(updatedProduct.lowStockThreshold) || undefined;
    const shouldTriggerLowStockAlert = 
      lowStockThreshold !== undefined && 
      updatedProduct.stock < lowStockThreshold && 
      currentStock >= lowStockThreshold;

    // Log successful stock update
    console.log(`✅ Stock decremented successfully for product ${productId}:`, {
      productName: updatedProduct.name,
      oldStock: currentStock,
      newStock: updatedProduct.stock,
      decrementAmount,
      in_stock: updatedProduct.in_stock,
      lowStockThreshold,
      shouldTriggerLowStockAlert,
    });

    // Return updated product with low stock alert flag
    return {
      ...updatedProduct,
      _shouldTriggerLowStockAlert: shouldTriggerLowStockAlert,
      _lowStockThreshold: lowStockThreshold,
    };
  } catch (error) {
    console.error(`❌ decrementProductStock error for product ${productId}:`, {
      error: error.message,
      errorName: error.name,
      errorCode: error.code,
      productId,
      quantity,
    });
    throw error;
  }
}

/**
 * Increment product stock by quantity (used when order is cancelled or refunded)
 * Only updates if product has stock tracking enabled (stock !== undefined)
 *
 * @param {string} productId - Product ID (UUID)
 * @param {number} quantity - Quantity to increment
 * @returns {Promise<Object>} Updated product
 * @throws {Error} If product not found
 */
async function incrementProductStock(productId, quantity) {
  try {
    // Get current product to check stock
    const product = await getProductById(productId);
    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }

    // If product doesn't have stock tracking, skip update
    if (product.stock === undefined) {
      console.log(
        `Product ${productId} doesn't have stock tracking, skipping stock update`
      );
      return product;
    }

    const currentStock = Number(product.stock) || 0;
    const incrementAmount = Number(quantity) || 0;

    // Calculate new stock
    const newStock = currentStock + incrementAmount;

    // Automatically update in_stock boolean based on new stock value
    // If stock was 0 and now > 0, set in_stock = true
    const newInStock = newStock > 0;

    // Update product stock and in_stock status
    // Note: ConditionExpression is optional for increment (adding stock is safe),
    // but included for consistency and to ensure product still exists
    const command = new UpdateCommand({
      TableName: TABLES.PRODUCTS,
      Key: { id: productId },
      UpdateExpression:
        "SET stock = :stock, in_stock = :in_stock, updatedAt = :updatedAt",
      ConditionExpression: "attribute_exists(id)", // Ensure product still exists (prevents errors if product was deleted)
      ExpressionAttributeValues: {
        ":stock": newStock,
        ":in_stock": newInStock,
        ":updatedAt": new Date().toISOString(),
      },
      ReturnValues: "ALL_NEW",
    });

    const result = await dynamoDB.send(command);
    const updatedProduct = result.Attributes;

    // Log successful stock update
    console.log(`✅ Stock incremented successfully for product ${productId}:`, {
      productName: updatedProduct.name,
      oldStock: currentStock,
      newStock: updatedProduct.stock,
      incrementAmount,
      in_stock: updatedProduct.in_stock,
    });

    return updatedProduct;
  } catch (error) {
    console.error(`❌ incrementProductStock error for product ${productId}:`, {
      error: error.message,
      errorName: error.name,
      errorCode: error.code,
      productId,
      quantity,
    });
    throw error;
  }
}

module.exports = {
  getAllProducts,
  getProductById,
  getFeaturedProducts,
  getFeaturedProductsCount,
  createProduct,
  updateProduct,
  deleteProduct,
  decrementProductStock,
  incrementProductStock,
};
