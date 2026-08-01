import { Link } from "react-router-dom";
import { CheckCircle2, ShoppingCart } from "lucide-react";
import type { Order } from "../../../types";

interface OrderSuccessProps {
  data: Order;
}

export const OrderSuccess = ({ data }: OrderSuccessProps) => {
  return (
    <section className="text-xl text-center my-10 py-5 dark:text-slate-100 border dark:border-slate-700 rounded">
      <div className="my-5">
        <CheckCircle2 className="h-16 w-16 mx-auto text-green-600 mb-5" strokeWidth={2} />
        <p>Thank you {data.user.name} for the order!</p>
        <p>Your Order ID: {data.id}</p>
      </div>
      <div className="my-5">
        <p>Your order is confirmed.</p>
        <p>Please check your mail ({data.user.email}) for the eBook.</p>
        <p className="my-5">Payment ID: xyz_123456789</p>
      </div>
      <Link to="/products" type="button" className="inline-flex items-center text-white bg-blue-700 hover:bg-blue-800 rounded-lg text-lg px-5 py-2.5 mr-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none">
        Continue Shopping <ShoppingCart className="ml-2 h-5 w-5" strokeWidth={2} />
      </Link>
    </section>
  );
};
