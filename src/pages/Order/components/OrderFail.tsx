import { Link } from "react-router-dom";
import { AlertCircle, ShoppingCart } from "lucide-react";

export const OrderFail = () => {
  return (
    <section className="text-xl text-center my-10 py-5 dark:text-slate-100 border dark:border-slate-700 rounded">
      <div className="my-5">
        <AlertCircle className="h-16 w-16 mx-auto text-red-500 mb-5" strokeWidth={2} />
        <p>Payment failed, please try again!</p>
      </div>
      <div className="my-5">
        <p>Your order is not confirmed.</p>
        <p>
          Connect <span className="">codebook@example.com</span> for support.
        </p>
      </div>
      <Link to="/cart" type="button" className="inline-flex items-center text-white bg-blue-700 hover:bg-blue-800 rounded-lg text-lg px-5 py-2.5 mr-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none">
        Check Cart Again<ShoppingCart className="ml-2 h-5 w-5" strokeWidth={2} />
      </Link>
    </section>
  );
};
