// Parent: REQ-1204, REQ-1301
// Idempotent seed script (safe to re-run — uses upsert throughout):
//  - Product catalog from the repo's legacy data/db.json (15 products).
//  - Two fresh test accounts matching docs/DROPDOWN_TEST_CREDENTIALS_DOCS.md's
//    own convention: test@admin.com (admin) and test@user.com (user), both "12345678".
// tickets/reviews/activity_log intentionally start empty — no legacy source data.

import "dotenv/config";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface TestAccount {
  email: string;
  password: string;
  name: string;
  role: string;
}

const TEST_ACCOUNTS: TestAccount[] = [
  { email: "test@admin.com", password: "12345678", name: "Test Admin", role: "admin" },
  { email: "test@user.com", password: "12345678", name: "Test User", role: "user" },
];

async function seedUsers(): Promise<void> {
  for (const account of TEST_ACCOUNTS) {
    const hashedPassword = await bcrypt.hash(account.password, 10);
    await prisma.user.upsert({
      where: { email: account.email },
      update: { isDemo: true }, // re-run-safe: (re)tag as demo even if the account already existed
      create: {
        email: account.email,
        password: hashedPassword,
        name: account.name,
        role: account.role,
        isDemo: true,
      },
    });
    console.log(`Seeded user: ${account.email} (${account.role})`);
  }
}

interface RawProduct {
  id: string;
  name: string;
  author?: string;
  category?: string;
  level?: string;
  pages?: number | string;
  price?: number | string;
  overview?: string;
  long_description?: string;
  image_local?: string;
  poster?: string;
  in_stock?: boolean;
  stock?: number | string;
  lowStockThreshold?: number | string;
  size?: number;
  best_seller?: boolean;
  featured_product?: boolean | number;
  rating?: number | string;
  // REQ-1616: catalog/inventory metadata
  sku?: string;
  isbn?: string;
  publisher?: string;
  publishedYear?: number;
  language?: string;
  edition?: string;
  fileFormat?: string;
  tags?: string[];
}

async function seedProducts(): Promise<void> {
  const dbJsonPath = path.join(__dirname, "..", "..", "data", "db.json");
  let db: { products?: RawProduct[] } | undefined;
  try {
    db = JSON.parse(fs.readFileSync(dbJsonPath, "utf-8")) as { products?: RawProduct[] };
  } catch {
    console.warn(`No data/db.json found at ${dbJsonPath} — skipping product seed.`);
    return;
  }

  const products = db?.products || [];
  for (const p of products) {
    const fields = {
      name: p.name,
      author: p.author || null,
      category: p.category || null,
      level: p.level || null,
      pages: p.pages !== undefined ? Number(p.pages) : null,
      price: Number(p.price) || 0,
      overview: p.overview || "",
      long_description: p.long_description || "",
      image_local: p.image_local || "",
      poster: p.poster || "",
      in_stock: p.in_stock !== undefined ? Boolean(p.in_stock) : true,
      stock: p.stock !== undefined ? Number(p.stock) : null,
      lowStockThreshold: p.lowStockThreshold !== undefined ? Number(p.lowStockThreshold) : null,
      size: p.size || null,
      best_seller: Boolean(p.best_seller),
      featured_product: p.featured_product === true || p.featured_product === 1 ? 1 : 0,
      rating: p.rating !== undefined ? Number(p.rating) : null,
      // REQ-1616: catalog/inventory metadata
      sku: p.sku || null,
      isbn: p.isbn || null,
      publisher: p.publisher || null,
      publishedYear: p.publishedYear !== undefined ? Number(p.publishedYear) : null,
      language: p.language || null,
      edition: p.edition || null,
      fileFormat: p.fileFormat || null,
      tags: p.tags || [],
    };
    await prisma.product.upsert({
      where: { id: p.id },
      // Keep re-runs in sync with data/db.json (the seed catalog is the source
      // of truth for demo content — this intentionally overwrites prior admin
      // edits to seeded products on re-seed, same as any fixture reset).
      update: fields,
      create: { id: p.id, ...fields },
    });
  }
  console.log(`Seeded ${products.length} products from data/db.json`);
}

async function main(): Promise<void> {
  await seedUsers();
  await seedProducts();
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
