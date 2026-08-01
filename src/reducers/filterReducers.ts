// Parent: REQ-1301, REQ-1305

import type { Product } from "../types";

export type RatingFilter = "4STARSABOVE" | "3STARSABOVE" | "2STARSABOVE" | "1STARSABOVE" | null;
export type SortByFilter = "lowtohigh" | "hightolow" | null;

export interface FilterState {
  productList: Product[];
  onlyInStock: boolean;
  bestSellerOnly: boolean;
  sortBy: SortByFilter;
  ratings: RatingFilter;
}

export type FilterAction =
  | { type: "PRODUCT_LIST"; payload: { products: Product[] } }
  | { type: "SORT_BY"; payload: { sortBy: SortByFilter } }
  | { type: "RATINGS"; payload: { ratings: RatingFilter } }
  | { type: "BEST_SELLER_ONLY"; payload: { bestSellerOnly: boolean } }
  | { type: "ONLY_IN_STOCK"; payload: { onlyInStock: boolean } }
  | { type: "CLEAR_FILTER" };

export const filterReducer = (state: FilterState, action: FilterAction): FilterState => {
  switch (action.type) {
    case "PRODUCT_LIST":
      // Matches the original behavior exactly: intentionally does NOT spread
      // `state` here, so every other filter resets to its type default
      // whenever a fresh product list arrives (pre-existing behavior, not a bug
      // introduced by this TS conversion — see FilterProvider's initial state).
      return { productList: action.payload.products } as FilterState;

    case "SORT_BY":
      return { ...state, sortBy: action.payload.sortBy };

    case "RATINGS":
      return { ...state, ratings: action.payload.ratings };

    case "BEST_SELLER_ONLY":
      return { ...state, bestSellerOnly: action.payload.bestSellerOnly };

    case "ONLY_IN_STOCK":
      return { ...state, onlyInStock: action.payload.onlyInStock };

    case "CLEAR_FILTER":
      return {
        ...state,
        onlyInStock: false,
        bestSellerOnly: false,
        sortBy: null,
        ratings: null,
      };

    default:
      throw new Error("No case found!");
  }
};
