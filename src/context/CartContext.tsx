// Parent: REQ-1301, REQ-1305
import { createContext, useContext, useReducer, useEffect, useRef, type ReactNode } from "react";
import { cartReducer, type CartState } from "../reducers";
import type { CartItem, Product } from "../types";

const cartInitialState: CartState = {
  cartList: [],
  total: 0,
};

const CART_STORAGE_KEY = "codebook-cart";

// Reads the persisted cart on first render so a page refresh doesn't wipe it.
// Falls back to the empty cart on any parse failure or missing/invalid data.
function loadPersistedCart(): CartState {
  if (typeof window === "undefined") return cartInitialState;
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return cartInitialState;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.cartList) || typeof parsed?.total !== "number") {
      return cartInitialState;
    }
    return parsed as CartState;
  } catch {
    return cartInitialState;
  }
}

interface CartContextValue {
  cartList: CartItem[];
  total: number;
  addToCart: (product: Product) => void;
  removeFromCart: (product: Product) => void;
  updateQuantity: (product: Product, newQuantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue>({
  ...cartInitialState,
  addToCart: () => {},
  removeFromCart: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
});

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(cartReducer, cartInitialState, loadPersistedCart);
  const previousUserIdRef = useRef<string | null>(null); // Track previous user ID to detect user changes

  // Persist cart to localStorage on every change so a refresh/reopen doesn't lose it.
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage unavailable (private browsing, quota exceeded) - cart still works in-memory
    }
  }, [state]);

  /**
   * Add product to cart or increase quantity if already exists
   * Cart items structure: { ...product, quantity: number }
   */
  function addToCart(product: Product) {
    // Validate product
    if (!product || !product.id) {
      console.warn("Cannot add invalid product to cart");
      return;
    }

    // Prevent adding out-of-stock items
    // Check both in_stock boolean and stock quantity (if available)
    const isOutOfStock = product.stock !== undefined && product.stock !== null ? product.stock === 0 : !product.in_stock;

    if (isOutOfStock) {
      console.warn("Cannot add out-of-stock product to cart:", product.name);
      return;
    }

    // Check if requested quantity exceeds available stock (if stock tracking enabled)
    if (product.stock !== undefined && product.stock !== null) {
      const existingItem = state.cartList.find((item) => item.id === product.id);
      const currentQuantity = existingItem ? existingItem.quantity : 0;
      const requestedQuantity = currentQuantity + 1; // Adding 1 more item

      if (requestedQuantity > product.stock) {
        console.warn(`Cannot add more items. Available stock: ${product.stock}, Requested: ${requestedQuantity}`, product.name);
        return;
      }
    }

    // Check if product already exists in cart
    const existingItemIndex = state.cartList.findIndex((item) => item.id === product.id);
    const productPrice = product.price || 0;

    let updatedList: CartItem[];
    let updatedTotal: number;

    if (existingItemIndex >= 0) {
      // Product exists - increase quantity
      updatedList = state.cartList.map((item, index) => {
        if (index === existingItemIndex) {
          return { ...item, quantity: (item.quantity || 1) + 1 };
        }
        return item;
      });
      updatedTotal = state.total + productPrice;
    } else {
      // New product - add with quantity 1
      updatedList = [...state.cartList, { ...product, quantity: 1 }];
      updatedTotal = state.total + productPrice;
    }

    dispatch({
      type: "ADD_TO_CART",
      payload: {
        products: updatedList,
        total: updatedTotal,
      },
    });
  }

  /**
   * Remove product from cart completely
   */
  function removeFromCart(product: Product) {
    if (!product || !product.id) return;

    const itemToRemove = state.cartList.find((item) => item.id === product.id);
    if (!itemToRemove) return;

    const itemTotal = (itemToRemove.quantity || 1) * (itemToRemove.price || 0);
    const updatedList = state.cartList.filter((item) => item.id !== product.id);
    const updatedTotal = Math.max(0, state.total - itemTotal); // Ensure total doesn't go negative

    dispatch({
      type: "REMOVE_FROM_CART",
      payload: {
        products: updatedList,
        total: updatedTotal,
      },
    });
  }

  /**
   * Update quantity of a product in cart
   */
  function updateQuantity(product: Product, newQuantity: number) {
    if (!product || !product.id) return;

    // Ensure quantity is at least 1
    const quantity = Math.max(1, Math.floor(newQuantity || 1));

    const existingItemIndex = state.cartList.findIndex((item) => item.id === product.id);
    if (existingItemIndex < 0) return;

    const existingItem = state.cartList[existingItemIndex]!;
    const oldQuantity = existingItem.quantity || 1;
    const quantityDiff = quantity - oldQuantity;

    // If quantity hasn't changed, no need to update
    if (quantityDiff === 0) return;

    // Check stock availability if increasing quantity and stock tracking is enabled
    if (quantityDiff > 0 && product.stock !== undefined && product.stock !== null) {
      if (quantity > product.stock) {
        console.warn(`Cannot increase quantity. Available stock: ${product.stock}, Requested: ${quantity}`, product.name);
        return; // Don't update if exceeds available stock
      }
    }

    const updatedList = state.cartList.map((item, index) => {
      if (index === existingItemIndex) {
        return { ...item, quantity };
      }
      return item;
    });

    const pricePerUnit = existingItem.price || 0;
    const updatedTotal = Math.max(0, state.total + quantityDiff * pricePerUnit); // Ensure total doesn't go negative

    dispatch({
      type: "UPDATE_QUANTITY",
      payload: {
        products: updatedList,
        total: updatedTotal,
      },
    });
  }

  function clearCart() {
    dispatch({
      type: "CLEAR_CART",
      payload: {
        products: [],
        total: 0,
      },
    });
  }

  /**
   * Clear cart when user changes (login/logout)
   * Monitors sessionStorage for user ID changes to prevent cart persisting across users
   */
  useEffect(() => {
    const checkUserChange = () => {
      try {
        const currentUserId = sessionStorage.getItem("cbid");
        const parsedUserId = currentUserId ? JSON.parse(currentUserId) : null;

        // If user ID changed (login, logout, or switch user), clear cart
        if (previousUserIdRef.current !== null && previousUserIdRef.current !== parsedUserId) {
          clearCart();
        }

        // Update previous user ID
        previousUserIdRef.current = parsedUserId;
      } catch {
        // If error parsing, treat as logout (no user)
        if (previousUserIdRef.current !== null) {
          clearCart();
          previousUserIdRef.current = null;
        }
      }
    };

    // Check on mount
    checkUserChange();

    // Listen for custom sessionStorage change event (from authService)
    window.addEventListener("sessionStorageChange", checkUserChange);

    // Listen for storage events (cross-tab updates)
    window.addEventListener("storage", checkUserChange);

    // Also check periodically to catch any missed updates
    const interval = setInterval(checkUserChange, 500);

    return () => {
      window.removeEventListener("sessionStorageChange", checkUserChange);
      window.removeEventListener("storage", checkUserChange);
      clearInterval(interval);
    };
  }, []); // Empty dependency array - only run on mount/unmount

  const value: CartContextValue = {
    cartList: state.cartList,
    total: state.total,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  return useContext(CartContext);
};
