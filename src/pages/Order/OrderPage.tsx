import { useLocation } from "react-router-dom";
import { useTitle } from "../../hooks/useTitle";
import { OrderSuccess } from "./components/OrderSuccess";
import { OrderFail } from "./components/OrderFail";
import type { Order } from "../../types";

interface OrderPageState {
  status: boolean;
  data?: Order;
}

export const OrderPage = () => {
  useTitle("Order Summary");
  const { state } = useLocation() as { state: OrderPageState };

  return <main>{state.status && state.data ? <OrderSuccess data={state.data} /> : <OrderFail />}</main>;
};
