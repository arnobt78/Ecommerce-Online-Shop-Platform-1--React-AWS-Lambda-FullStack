export { HomePage } from "./Home/HomePage";
export { ProductsList } from "./Products/ProductsList";
export { ProductDetail } from "./ProductDetail";

export { CartPage } from "./Cart/CartPage";
export { OrderPage } from "./Order/OrderPage";
export { OrderDetailPage } from "./Order/OrderDetailPage";
export { DashboardPage } from "./Dashboard/DashboardPage";
export { PaymentSuccessPage } from "./Payment/PaymentSuccessPage";
export { PaymentCancelPage } from "./Payment/PaymentCancelPage";
export { GuestOrderLookupPage } from "./Payment/GuestOrderLookupPage";

export { Login } from "./Login";
export { Register } from "./Register";
export { AuthCallback } from "./AuthCallback";

// Admin pages are intentionally NOT re-exported here — AllRoutes.tsx code-splits
// them via React.lazy(() => import("./Admin")) so the ~330KB admin bundle
// (charts, tables, forms) never loads for the vast majority of visits that
// never touch /admin/*. Statically re-exporting them from this barrel would
// pull their whole module graph back into the main chunk. Import directly
// from "./Admin" (or a specific admin page file) if you need one elsewhere.
export { CreateTicketPage, TicketsListPage, TicketDetailPage } from "./Tickets";

export { PageNotFound } from "./PageNotFound";
