/**
 * CartPage Component
 *
 * Main cart page that displays cart items or empty state.
 */

import { useTitle } from "../../hooks/useTitle";
import { CartEmpty } from "./components/CartEmpty";
import { CartList } from "./components/CartList";
import { useCart } from "../../context";
import { useMemo } from "react";

export const CartPage = () => {
  const { cartList } = useCart();

  // Calculate total items count (sum of all quantities)
  const totalItems = useMemo(() => {
    return cartList.reduce((sum, item) => sum + (item.quantity || 1), 0);
  }, [cartList]);

  useTitle(`Cart (${totalItems})`);

  return (
    <main>
      { cartList.length ? <CartList /> : <CartEmpty /> }
    </main>
  )
}
