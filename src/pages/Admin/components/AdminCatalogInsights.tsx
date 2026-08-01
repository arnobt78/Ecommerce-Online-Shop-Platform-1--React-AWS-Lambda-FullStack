/**
 * AdminCatalogInsights Component
 *
 * Catalog-focused admin dashboard sections — category/genre breakdown,
 * publication-year and language distribution, top-rated products, and a
 * catalog completeness/health summary. Enrichment pass inspired by the
 * university-library reference project's admin dashboard, adapted to this
 * app's own Card + slim-progress-bar visual language (not that project's
 * DaisyUI classes) so it stays consistent with the rest of the admin UI.
 *
 * Pure presentational component — all data comes from AdminStats, which is
 * already derived client-side from the cached products query in
 * adminService.getAdminStats(), so this section updates immediately after
 * any product create/update/delete without a page refresh.
 */

import type { CategoryStat, TopRatedProduct, CatalogHealth } from "../../../services/adminService";
import { Card } from "../../../components/ui";

interface ProgressRowProps {
  label: string;
  value: number;
  total: number;
  barColorClassName?: string;
  valueLabel?: string;
}

const ProgressRow = ({ label, value, total, barColorClassName = "bg-blue-500", valueLabel }: ProgressRowProps) => {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700 dark:text-gray-300 truncate">{label}</span>
        <span className="font-medium text-gray-800 dark:text-white shrink-0 ml-2">{valueLabel ?? value}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
        <div className={`h-1.5 rounded-full ${barColorClassName}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

interface AdminCatalogInsightsProps {
  categoryStats: CategoryStat[];
  productsByYear: Array<[string, number]>;
  productsByLanguage: Array<[string, number]>;
  topRatedProducts: TopRatedProduct[];
  catalogHealth: CatalogHealth;
  totalProducts: number;
}

export const AdminCatalogInsights = ({
  categoryStats,
  productsByYear,
  productsByLanguage,
  topRatedProducts,
  catalogHealth,
  totalProducts,
}: AdminCatalogInsightsProps) => {
  const maxCategoryCount = Math.max(1, ...categoryStats.map((c) => c.count));
  const maxYearCount = Math.max(1, ...productsByYear.map(([, count]) => count));
  const maxLanguageCount = Math.max(1, ...productsByLanguage.map(([, count]) => count));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Category / genre breakdown */}
      <Card className="p-4 sm:p-6">
        <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-white">📚 Catalog Categories</h3>
        <div className="space-y-3">
          {categoryStats.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No products found</p>
          ) : (
            categoryStats.map((category) => (
              <ProgressRow
                key={category.category}
                label={category.category}
                value={category.count}
                total={maxCategoryCount}
                barColorClassName="bg-gradient-to-r from-blue-500 to-violet-500"
                valueLabel={`${category.count}${category.avgRating > 0 ? ` · ⭐ ${category.avgRating.toFixed(1)}` : ""}`}
              />
            ))
          )}
        </div>
      </Card>

      {/* Top rated products */}
      <Card className="p-4 sm:p-6">
        <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-white">⭐ Top Rated Products</h3>
        <div className="space-y-2">
          {topRatedProducts.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No rated products yet</p>
          ) : (
            topRatedProducts.map((product) => (
              <div key={product.id} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-900/50 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-white">{product.name}</p>
                  {product.author && <p className="truncate text-xs text-gray-500 dark:text-gray-400">by {product.author}</p>}
                </div>
                <span className="ml-2 shrink-0 text-xs font-semibold text-amber-600 dark:text-amber-400">⭐ {product.rating.toFixed(1)}</span>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Publication year distribution */}
      <Card className="p-4 sm:p-6">
        <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-white">📅 Products by Publication Year</h3>
        <div className="space-y-3">
          {productsByYear.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No publication year data</p>
          ) : (
            productsByYear.map(([year, count]) => (
              <ProgressRow key={year} label={year} value={count} total={maxYearCount} barColorClassName="bg-gradient-to-r from-emerald-500 to-teal-500" />
            ))
          )}
        </div>
      </Card>

      {/* Language distribution */}
      <Card className="p-4 sm:p-6">
        <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-white">🌍 Products by Language</h3>
        <div className="space-y-3">
          {productsByLanguage.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No language data</p>
          ) : (
            productsByLanguage.map(([language, count]) => (
              <ProgressRow key={language} label={language} value={count} total={maxLanguageCount} barColorClassName="bg-gradient-to-r from-purple-500 to-pink-500" />
            ))
          )}
        </div>
      </Card>

      {/* Catalog health — spans full width on large screens */}
      <Card className="p-4 sm:p-6 lg:col-span-2">
        <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-white">🏥 Catalog Health</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ProgressRow label="Products with ISBN" value={catalogHealth.productsWithIsbn} total={totalProducts} barColorClassName="bg-gradient-to-r from-indigo-500 to-blue-500" />
          <ProgressRow label="Products with Publisher" value={catalogHealth.productsWithPublisher} total={totalProducts} barColorClassName="bg-gradient-to-r from-sky-500 to-cyan-500" />
          <ProgressRow
            label="In Stock"
            value={catalogHealth.inStockProducts}
            total={totalProducts}
            barColorClassName="bg-gradient-to-r from-green-500 to-emerald-500"
            valueLabel={`${catalogHealth.inStockProducts} / ${totalProducts}`}
          />
          <ProgressRow
            label="Out of Stock"
            value={catalogHealth.outOfStockProducts}
            total={totalProducts}
            barColorClassName="bg-gradient-to-r from-rose-500 to-red-500"
            valueLabel={`${catalogHealth.outOfStockProducts} / ${totalProducts}`}
          />
        </div>
        {catalogHealth.averagePages > 0 && (
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">Average page count: {Math.round(catalogHealth.averagePages)} pages</p>
        )}
      </Card>
    </div>
  );
};
