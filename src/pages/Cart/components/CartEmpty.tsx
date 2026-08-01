import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";

export const CartEmpty = () => {
  return (
    <section className="text-xl text-center my-10 py-5 dark:text-slate-100 border dark:border-slate-700 rounded">
      <div className="my-5">
        <ShoppingCart className="h-16 w-16 mx-auto text-green-600 mb-5" strokeWidth={2} />
        <p>Oops! Your cart looks empty!</p>
        <p>Add eBooks to your cart from our store collection.</p>
      </div>
      <Link
        to="/products"
        type="button"
        className="inline-flex items-center text-white bg-blue-700 hover:bg-blue-800 rounded-lg text-lg px-5 py-2.5 mr-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none"
      >
        Continue Shopping <ShoppingCart className="ml-2 h-5 w-5" strokeWidth={2} />
      </Link>
    </section>
  );
};
