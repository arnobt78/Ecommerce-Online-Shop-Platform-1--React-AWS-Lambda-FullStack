# ATM.md — Assurance Traceability Matrix

Maps each REQ-ID → implementing artifact(s) → verifying artifact(s) → verification status.
Populated for baseline REQs from code inventory; `Test Evidence` and `Verified By` columns fill in as Stage 3/4 run per REQ going forward.

| REQ-ID | Implementation Artifact | Test Evidence | Verified By | Status |
|---|---|---|---|---|
| REQ-0001 | `package.json`, `src/index.js` | — | — | BASELINE (unverified this cycle) |
| REQ-0002 | `src/routes/AllRoutes.js`, `src/routes/ProtectedRoute.js` | — | — | BASELINE |
| REQ-0003 | `src/services/*`, `src/hooks/*` | — | — | BASELINE |
| REQ-0004 | `aws-lambda/functions/*`, `aws-lambda/template.yaml` | — | — | BASELINE |
| REQ-0005 | `vercel.json` | — | — | BASELINE |
| REQ-0006 | `tailwind.config.js`, `docs/UI_STYLING_GUIDE.md` | — | — | BASELINE |
| REQ-0100 | `aws-lambda/functions/auth/register.js` | — | — | BASELINE — R3, recommend verify before next touch |
| REQ-0101 | `aws-lambda/functions/auth/login.js` | — | — | BASELINE — R3, recommend verify before next touch |
| REQ-0102 | `src/context/*`, `src/pages/Admin/*` | — | — | BASELINE — R3 |
| REQ-0103 | `src/pages/Login.js`, `src/pages/Register.js` | — | — | BASELINE |
| REQ-0200 | `aws-lambda/functions/products/list.js`, `src/pages/Products/*` | — | — | BASELINE |
| REQ-0201 | `aws-lambda/functions/products/get.js`, `src/pages/ProductDetail.js` | — | — | BASELINE |
| REQ-0202 | `aws-lambda/functions/products/{create,update,delete}.js`, `src/pages/Admin/AdminProduct*.js` | — | — | BASELINE |
| REQ-0203 | `src/pages/Home/components/FeaturedProducts.js` | — | — | BASELINE |
| REQ-0300 | `src/reducers/cartReducers.js`, `src/pages/Cart/*` | — | — | BASELINE |
| REQ-0301 | `src/pages/Cart/components/StripeCheckout.js` | — | — | BASELINE — R3 |
| REQ-0302 | `aws-lambda/functions/payment/create-intent.js` | — | — | BASELINE — R3 |
| REQ-0303 | `aws-lambda/functions/payment/verify.js` | — | — | BASELINE — R3 |
| REQ-0304 | `aws-lambda/functions/payment/webhook.js` | — | — | BASELINE — R3 |
| REQ-0305 | `src/pages/Payment/PaymentSuccessPage.js`, `PaymentCancelPage.js` | — | — | BASELINE |
| REQ-0400 | `aws-lambda/functions/orders/index.js`, `src/pages/Order/OrderPage.js` | — | — | BASELINE |
| REQ-0401 | `src/pages/Order/components/{OrderSuccess,OrderFail}.js` | — | — | BASELINE |
| REQ-0402 | `aws-lambda/functions/admin/{orders,order-detail}.js`, `src/pages/Admin/AdminOrders*.js` | — | — | BASELINE |
| REQ-0403 | `aws-lambda/functions/admin/order-status.js` | — | — | BASELINE |
| REQ-0404 | `aws-lambda/functions/admin/add-tracking.js` | — | — | BASELINE |
| REQ-0405 | `aws-lambda/functions/admin/generate-label.js` | — | — | BASELINE |
| REQ-0406 | `aws-lambda/functions/admin/refund-order.js` | — | — | BASELINE — R3, recommend verify before next touch |
| REQ-0407 | `src/pages/Admin/AdminHistoryPage.js` | — | — | BASELINE |
| REQ-0500 | `aws-lambda/functions/reviews/*.js` | — | — | BASELINE |
| REQ-0501 | `aws-lambda/functions/admin/{reviews,review-update}.js`, `src/pages/Admin/AdminReviewsPage.js` | — | — | BASELINE |
| REQ-0600 | `aws-lambda/functions/tickets/create.js`, `src/pages/Tickets/CreateTicketPage.js` | — | — | BASELINE |
| REQ-0601 | `aws-lambda/functions/tickets/{list,get}.js`, `src/pages/Tickets/*` | — | — | BASELINE |
| REQ-0602 | `aws-lambda/functions/tickets/reply.js` | — | — | BASELINE |
| REQ-0603 | `aws-lambda/functions/tickets/update-status.js`, `src/pages/Admin/AdminTicketsPage.js` | — | — | BASELINE |
| REQ-0700 | `aws-lambda/functions/notifications/count.js` | — | — | BASELINE |
| REQ-0701 | `aws-lambda/functions/notifications/mark-read.js` | — | — | BASELINE |
| REQ-0800 | `src/pages/Admin/AdminDashboardPage.js` | — | — | BASELINE |
| REQ-0801 | `src/pages/Admin/AdminAnalyticsPage.js` | — | — | BASELINE |
| REQ-0802 | `aws-lambda/functions/admin/user-*.js`, `src/pages/Admin/AdminUser*.js` | — | — | BASELINE — R3 |
| REQ-0803 | `src/pages/Admin/AdminSettingsPage.js` | — | — | BASELINE |
| REQ-0804 | `src/pages/Dashboard/DashboardPage.js` | — | — | BASELINE |
| REQ-0900 | `aws-lambda/functions/email/send-email.js` | — | — | BASELINE |
| REQ-1000 | `aws-lambda/functions/admin/activity-logs.js` | — | — | BASELINE |
| REQ-1101 | (working tree diff — see `git status`) | — | — | IN-PROGRESS, uncommitted |
| REQ-1102 | (working tree diff — see `git status`) | — | — | IN-PROGRESS, uncommitted |
| REQ-1103 | `.gitignore` | — | — | IN-PROGRESS, uncommitted |
