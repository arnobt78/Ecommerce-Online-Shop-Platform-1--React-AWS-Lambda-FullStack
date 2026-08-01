import { ShoppingCart } from "lucide-react";

export const DashboardEmpty = () => {
  return (
    <section className="text-xl text-center my-10 py-8 sm:py-10 px-4 dark:text-slate-100 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-800 transition-colors">
      <div className="my-5">
        <ShoppingCart className="h-16 w-16 mx-auto text-green-600 dark:text-green-400 mb-5" strokeWidth={2} />
        <p className="text-lg sm:text-xl mb-2">
          Oops! Your order dashboard looks empty!
        </p>
        <p className="text-base sm:text-lg text-gray-600 dark:text-slate-400">
          Add eBooks to your cart from our store collection.
        </p>
      </div>
      <a
        href="/"
        type="button"
        className="inline-flex items-center text-white bg-blue-700 hover:bg-blue-800 rounded-lg text-base sm:text-lg px-5 py-2.5 mr-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none transition-colors"
      >
        Continue Shopping <ShoppingCart className="ml-2 h-5 w-5" strokeWidth={2} />
      </a>
    </section>
  );
};
