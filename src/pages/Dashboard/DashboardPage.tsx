import { useMemo, useEffect } from "react";
import { toast } from "../../lib/toast";
import { useTitle } from "../../hooks/useTitle";
import { useUserOrders } from "../../hooks/useUser";
import { DashboardCard } from "./components/DashboardCard";
import { DashboardCardSkeleton } from "./components/DashboardCardSkeleton";
import { DashboardEmpty } from "./components/DashboardEmpty";
import { AddressBook } from "./components/AddressBook";
import { WishlistSection } from "./components/WishlistSection";

export const DashboardPage = () => {
  useTitle("Dashboard");

  const { data: orders = [], isLoading: loading, error } = useUserOrders();

  // Sort orders by date (most recent first) - using useMemo to avoid re-sorting on every render
  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA; // Most recent first
    });
  }, [orders]);

  const totalOrders = useMemo(() => orders.length, [orders.length]);

  useEffect(() => {
    if (error) {
      toast.error(error.message, { closeButton: true, position: "bottom-right" });
    }
  }, [error]);

  return (
    <main>
      <section>
        <p className="text-2xl text-center font-medium dark:text-slate-100 my-10 underline underline-offset-8">
          My Dashboard{" "}
          {totalOrders > 0 && (
            <span className="text-lg font-normal text-gray-600 dark:text-gray-400">
              ({totalOrders} {totalOrders === 1 ? "order" : "orders"})
            </span>
          )}
        </p>
      </section>

      <section className="">
        <AddressBook />
      </section>

      <section className="">
        <WishlistSection />
      </section>

      <section>
        {loading ? (
          Array(2)
            .fill(0)
            .map((_, index) => <DashboardCardSkeleton key={`skeleton-${index}`} />)
        ) : sortedOrders.length > 0 ? (
          sortedOrders.map((order) => <DashboardCard key={order.id} order={order} />)
        ) : (
          <DashboardEmpty />
        )}
      </section>
    </main>
  );
};
