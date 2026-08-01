/**
 * Payment Cancel Page
 *
 * Displays message when user cancels payment.
 * Uses reusable UI components (Card, PageHeader) for consistency.
 */

import { useNavigate } from "react-router-dom";
import { Card, PageHeader } from "../../components/ui";

export const PaymentCancelPage = () => {
  const navigate = useNavigate();

  return (
    <div className="py-8">
      <PageHeader title="Payment Cancelled" description="Your payment was cancelled" />

      <Card className="mt-6">
        <div className="p-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full mb-4">
            <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-medium text-gray-700 dark:text-white mb-2">Payment Cancelled</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Your payment was cancelled. No charges were made to your account.</p>

          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate("/cart")} className="px-6 py-3 text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 font-medium rounded-lg transition-colors">
              Return to Cart
            </button>
            <button onClick={() => navigate("/products")} className="px-6 py-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 font-medium rounded-lg transition-colors">
              Continue Shopping
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};
