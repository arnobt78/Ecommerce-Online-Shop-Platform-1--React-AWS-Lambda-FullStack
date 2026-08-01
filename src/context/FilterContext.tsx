// Parent: REQ-1301, REQ-1305
import { createContext, useContext, useReducer, useCallback, type ReactNode, type Dispatch } from "react";
import { filterReducer, type FilterState, type FilterAction } from "../reducers";
import type { Product } from "../types";

const filterInitialState: FilterState = {
  productList: [],
  onlyInStock: false,
  bestSellerOnly: false,
  sortBy: null,
  ratings: null,
};

interface FilterContextValue {
  state: FilterState;
  dispatch: Dispatch<FilterAction>;
  products: Product[];
  initialProductList: (products: Product[]) => void;
}

const FilterContext = createContext<FilterContextValue>({
  state: filterInitialState,
  dispatch: () => {},
  products: [],
  initialProductList: () => {},
});

export const FilterProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(filterReducer, filterInitialState);

  const initialProductList = useCallback((products: Product[]) => {
    dispatch({
      type: "PRODUCT_LIST",
      payload: {
        products: products,
      },
    });
  }, []);

  function bestSeller(products: Product[]): Product[] {
    return state.bestSellerOnly ? products.filter((product) => product.best_seller === true) : products;
  }

  function inStock(products: Product[]): Product[] {
    return state.onlyInStock ? products.filter((product) => product.in_stock === true) : products;
  }

  function sort(products: Product[]): Product[] {
    // Array.prototype.sort mutates in place — copy first so we never mutate
    // state.productList (bestSeller/inStock can return that same array reference
    // unchanged when their filters are off, so sorting it directly would corrupt
    // reducer state outside of a dispatch).
    if (state.sortBy === "lowtohigh") {
      return [...products].sort((a, b) => Number(a.price) - Number(b.price));
    }
    if (state.sortBy === "hightolow") {
      return [...products].sort((a, b) => Number(b.price) - Number(a.price));
    }
    return products;
  }

  function rating(products: Product[]): Product[] {
    if (state.ratings === "4STARSABOVE") {
      return products.filter((product) => (product.rating ?? 0) >= 4);
    }
    if (state.ratings === "3STARSABOVE") {
      return products.filter((product) => (product.rating ?? 0) >= 3);
    }
    if (state.ratings === "2STARSABOVE") {
      return products.filter((product) => (product.rating ?? 0) >= 2);
    }
    if (state.ratings === "1STARSABOVE") {
      return products.filter((product) => (product.rating ?? 0) >= 1);
    }
    return products;
  }

  const filteredProductList = rating(sort(inStock(bestSeller(state.productList))));

  const value: FilterContextValue = {
    state,
    dispatch,
    products: filteredProductList,
    initialProductList,
  };
  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
};

export const useFilter = () => {
  return useContext(FilterContext);
};
