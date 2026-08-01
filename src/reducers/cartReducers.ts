// Parent: REQ-1301, REQ-1305
// Manages cart state with quantity tracking. Cart items are Product + quantity.

import type { CartItem } from "../types";

export interface CartState {
  cartList: CartItem[];
  total: number;
}

export type CartAction =
  | { type: "ADD_TO_CART"; payload: { products: CartItem[]; total: number } }
  | { type: "REMOVE_FROM_CART"; payload: { products: CartItem[]; total: number } }
  | { type: "UPDATE_QUANTITY"; payload: { products: CartItem[]; total: number } }
  | { type: "CLEAR_CART"; payload: { products: CartItem[]; total: number } };

export const cartReducer = (state: CartState, action: CartAction): CartState => {
  const { type, payload } = action;

  switch (type) {
    case "ADD_TO_CART":
      return { ...state, cartList: payload.products, total: payload.total };

    case "REMOVE_FROM_CART":
      return { ...state, cartList: payload.products, total: payload.total };

    case "UPDATE_QUANTITY":
      return { ...state, cartList: payload.products, total: payload.total };

    case "CLEAR_CART":
      return { ...state, cartList: payload.products, total: payload.total };

    default:
      throw new Error("No case found!");
  }
};
