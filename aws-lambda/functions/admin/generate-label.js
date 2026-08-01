/**
 * AWS Lambda Function: Admin - Generate Shipping Label
 *
 * This Lambda function handles POST requests to generate shipping labels via Shippo API (admin only).
 *
 * Endpoint: POST /admin/orders/{id}/generate-label
 *
 * Authentication: Required (Bearer token in Authorization header)
 * Authorization: Admin role required
 *
 * Request Body:
 * {
 *   "carrier": "usps", // Optional: carrier code (default: usps)
 *   "service": "priority", // Optional: service level (default: priority)
 *   "fromAddress": { ... }, // Optional: override sender address
 *   "toAddress": { ... } // Optional: override recipient address (uses order shipping address by default)
 * }
 *
 * Response:
 * {
 *   "orderId": "...",
 *   "trackingNumber": "9400111899223197428490",
 *   "trackingCarrier": "usps",
 *   "labelUrl": "https://shippo-delivery.s3.amazonaws.com/...",
 *   "status": "shipped",
 *   "updatedAt": "2025-12-06T..."
 * }
 */

const { getOrderById, updateOrderTracking } = require("../../shared/orders");
const { requireAuth } = require("../../shared/auth");
const { logActivity } = require("../../shared/activityLog");
const {
  successResponse,
  errorResponse,
  handleOptions,
} = require("../../shared/response");

/**
 * Generate shipping label via Shippo API
 *
 * Flow:
 * 1. Create shipment with from/to addresses and parcel info
 * 2. Get available shipping rates
 * 3. Purchase label using selected rate
 * 4. Return tracking information and label URL
 *
 * @param {Object} order - Order object with user, items, and shipping info
 * @param {Object} options - Label generation options (carrier, service, dimensions, addresses)
 * @returns {Promise<Object>} Label data with trackingNumber, trackingCarrier, labelUrl, trackingUrl
 * @throws {Error} If Shippo API fails or address is incomplete
 */
async function generateShippoLabel(order, options = {}) {
  const shippoApiKey = process.env.SHIPPO_API_KEY;

  if (!shippoApiKey) {
    throw new Error("Shippo API key not configured");
  }

  // Extract shipping address from order (orders may not have shippingAddress field)
  const shippingAddress = order.shippingAddress || order.address || {};

  // Default sender address (can be configured in environment variables)
  // USPS requires both email and phone for sender address
  const fromAddress = options.fromAddress || {
    name: process.env.SHIPPO_FROM_NAME || "CodeBook Store",
    street1: process.env.SHIPPO_FROM_STREET1 || "123 Main St",
    city: process.env.SHIPPO_FROM_CITY || "New York",
    state: process.env.SHIPPO_FROM_STATE || "NY",
    zip: process.env.SHIPPO_FROM_ZIP || "10001",
    country: process.env.SHIPPO_FROM_COUNTRY || "US",
    // USPS requires both email and phone - provide defaults if not set
    phone: process.env.SHIPPO_FROM_PHONE || "+1 555 123 4567",
    email: process.env.SHIPPO_FROM_EMAIL || "arnobt78@gmail.com",
  };

  // Validate sender address has required fields for USPS
  if (!fromAddress.email || !fromAddress.phone) {
    throw new Error(
      "Sender address must include both email and phone number for USPS shipping. " +
        "Please set SHIPPO_FROM_EMAIL and SHIPPO_FROM_PHONE environment variables."
    );
  }

  // Recipient address from order (use user info as fallback)
  // Shippo validates US addresses automatically - must be valid addresses
  let toAddress = options.toAddress;

  if (!toAddress) {
    // Try to get address from order
    const hasValidAddress =
      shippingAddress.street1 &&
      shippingAddress.city &&
      shippingAddress.state &&
      shippingAddress.zip;

    if (hasValidAddress) {
      // Use order address if complete
      toAddress = {
        name:
          shippingAddress.name ||
          order.user?.name ||
          order.customerName ||
          "Customer",
        street1:
          shippingAddress.street1 ||
          shippingAddress.address ||
          shippingAddress.street,
        street2: shippingAddress.street2 || shippingAddress.address2 || "",
        city: shippingAddress.city,
        state: shippingAddress.state,
        zip:
          shippingAddress.zip ||
          shippingAddress.postalCode ||
          shippingAddress.zipCode,
        country: shippingAddress.country || "US",
        phone: shippingAddress.phone || order.user?.phone || "+1 555 123 4567",
        email: order.user?.email || order.customerEmail || "",
      };
    } else {
      // In test mode, use a valid test address (Shippo validates addresses)
      // Use a real valid address format for test mode
      if (shippoApiKey.startsWith("shippo_test_")) {
        console.warn(
          "Order has incomplete shipping address. Using valid test address for Shippo validation."
        );
        toAddress = {
          name: order.user?.name || order.customerName || "Test Customer",
          street1: "965 Mission St", // Valid San Francisco address
          street2: "",
          city: "San Francisco",
          state: "CA",
          zip: "94103",
          country: "US",
          phone:
            order.user?.phone || shippingAddress.phone || "+1 555 123 4567",
          email:
            order.user?.email || order.customerEmail || "customer@example.com",
        };
      } else {
        throw new Error(
          "Incomplete shipping address. Please ensure street, city, state, and zip are provided."
        );
      }
    }
  }

  // Ensure required fields are present (Shippo requires these for validation)
  if (
    !toAddress.street1 ||
    !toAddress.city ||
    !toAddress.state ||
    !toAddress.zip
  ) {
    throw new Error(
      "Recipient address is incomplete. Required fields: street1, city, state, zip"
    );
  }

  // Ensure phone and email for USPS (required for sender, recommended for recipient)
  if (!toAddress.phone) {
    toAddress.phone = order.user?.phone || "+1 555 123 4567";
  }
  if (!toAddress.email) {
    toAddress.email =
      order.user?.email || order.customerEmail || "customer@example.com";
  }

  // Calculate parcel weight and dimensions (defaults if not provided)
  // Use cartList if items field doesn't exist (backward compatibility)
  const orderItems = order.items || order.cartList || [];
  const totalWeight =
    orderItems.reduce((sum, item) => {
      // Estimate weight: 0.5 lbs per item (can be improved with product weight field)
      return sum + (item.quantity || 1) * 0.5;
    }, 0) || 1.0; // Default to 1 lb if no items

  // Determine if we're in test mode
  const isTestMode = shippoApiKey.startsWith("shippo_test_");

  // Note: carrier_accounts requires carrier account object IDs (UUIDs), not carrier codes
  // In test mode, we don't specify carrier_accounts and instead filter rates to USPS only
  // This avoids the UUID requirement and registration errors

  // Create shipment object for Shippo
  const shipmentData = {
    address_from: fromAddress,
    address_to: toAddress,
    parcels: [
      {
        length: options.length || "10",
        width: options.width || "8",
        height: options.height || "4",
        distance_unit: "in",
        weight: totalWeight.toString(),
        mass_unit: "lb",
      },
    ],
    // Don't specify carrier_accounts - we'll filter rates to USPS in test mode instead
    // carrier_accounts requires UUIDs of carrier account objects, not carrier codes
    async: false, // Synchronous (wait for rates)
  };

  console.log("Creating Shippo shipment:", {
    test_mode: isTestMode,
    from_address: `${fromAddress.city}, ${fromAddress.state}`,
    to_address: `${toAddress.city}, ${toAddress.state}`,
    weight: totalWeight,
    note: isTestMode
      ? "Will filter rates to USPS only"
      : "All carriers available",
  });

  // Call Shippo API to create shipment
  const shippoResponse = await fetch("https://api.goshippo.com/shipments", {
    method: "POST",
    headers: {
      Authorization: `ShippoToken ${shippoApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(shipmentData),
  });

  if (!shippoResponse.ok) {
    const errorData = await shippoResponse.json().catch(() => ({}));
    throw new Error(
      errorData.detail ||
        errorData.message ||
        `Shippo API error: ${shippoResponse.status}`
    );
  }

  const shipment = await shippoResponse.json();

  console.log("Shippo shipment created:", {
    object_id: shipment.object_id,
    status: shipment.status,
    rates_count: shipment.rates?.length || 0,
    test_mode: isTestMode,
  });

  // Get rates for the shipment (if not already included in shipment response)
  let rates = shipment.rates || [];
  if (!rates || rates.length === 0) {
    // Fetch rates separately if not included in shipment response
    // This is common when shipment is created without async: false
    const ratesResponse = await fetch(
      `https://api.goshippo.com/shipments/${shipment.object_id}/rates`,
      {
        method: "GET",
        headers: {
          Authorization: `ShippoToken ${shippoApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (ratesResponse.ok) {
      const ratesData = await ratesResponse.json();
      rates = ratesData.results || ratesData || [];
    } else {
      // If rates fetch fails, log but continue (may be included in shipment)
      console.warn(
        "Failed to fetch rates separately, checking shipment object"
      );
    }
  }

  if (!rates || rates.length === 0) {
    throw new Error(
      "No shipping rates available for this shipment. Please check address and parcel dimensions."
    );
  }

  // Log all available rates for debugging
  console.log(
    "Available shipping rates:",
    rates.map((rate) => ({
      object_id: rate.object_id,
      carrier: rate.carrier || rate.provider || rate.servicelevel?.carrier,
      service: rate.servicelevel?.name,
      amount: rate.amount,
      currency: rate.currency,
    }))
  );

  // In test mode, filter to only USPS rates to avoid carrier registration errors
  let availableRates = rates;
  if (isTestMode) {
    availableRates = rates.filter((rate) => {
      const carrier = (
        rate.carrier ||
        rate.provider ||
        rate.servicelevel?.carrier ||
        ""
      ).toLowerCase();
      return carrier === "usps" || carrier.includes("usps");
    });

    if (availableRates.length === 0) {
      console.warn(
        "No USPS rates found in test mode, available carriers:",
        rates
          .map((r) => r.carrier || r.provider || r.servicelevel?.carrier)
          .filter(Boolean)
      );
      // In test mode, if no USPS rates, throw error with helpful message
      throw new Error(
        "No USPS rates available in test mode. USPS doesn't require carrier registration. " +
          "Please ensure your shipment addresses are valid US addresses."
      );
    }

    console.log(
      `Filtered to ${availableRates.length} USPS rate(s) for test mode`
    );
  }

  // Select rate (use first available rate, or filter by service if specified)
  const selectedRate = options.service
    ? availableRates.find(
        (rate) => rate.servicelevel?.token === options.service
      ) || availableRates[0]
    : availableRates[0];

  if (!selectedRate) {
    throw new Error(
      "No suitable shipping rate found for the specified service level"
    );
  }

  console.log("Selected shipping rate:", {
    rate_id: selectedRate.object_id,
    carrier:
      selectedRate.carrier ||
      selectedRate.provider ||
      selectedRate.servicelevel?.carrier,
    service: selectedRate.servicelevel?.name,
    amount: selectedRate.amount,
    currency: selectedRate.currency,
    test_mode: isTestMode,
  });

  // Purchase label (create transaction)
  const transactionData = {
    rate: selectedRate.object_id,
    async: false, // Synchronous (wait for label)
  };

  const transactionResponse = await fetch(
    "https://api.goshippo.com/transactions",
    {
      method: "POST",
      headers: {
        Authorization: `ShippoToken ${shippoApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(transactionData),
    }
  );

  if (!transactionResponse.ok) {
    const errorData = await transactionResponse.json().catch(() => ({}));
    throw new Error(
      errorData.detail ||
        errorData.message ||
        `Shippo transaction error: ${transactionResponse.status}`
    );
  }

  const transaction = await transactionResponse.json();

  // Log transaction response for debugging (especially in test mode)
  console.log("Shippo transaction response:", {
    object_id: transaction.object_id,
    status: transaction.status,
    tracking_number: transaction.tracking_number,
    tracking_status: transaction.tracking_status,
    carrier: transaction.carrier,
    label_url: transaction.label_url,
    tracking_url_provider: transaction.tracking_url_provider,
    test_mode: isTestMode,
    full_response_keys: Object.keys(transaction),
    messages: transaction.messages, // Include error messages if any
  });

  // Check for transaction errors BEFORE extracting tracking info
  if (transaction.status === "ERROR") {
    console.error("Shippo transaction failed:", {
      status: transaction.status,
      messages: transaction.messages,
      object_id: transaction.object_id,
      test_mode: isTestMode,
      carrier: transaction.carrier,
    });

    // In test mode, if it's a carrier registration error, provide helpful message
    const errorMessage =
      transaction.messages?.[0]?.text ||
      "Shippo transaction failed to create label.";
    if (
      isTestMode &&
      (errorMessage.includes("not yet registered") ||
        errorMessage.includes("registration"))
    ) {
      throw new Error(
        `Carrier account not registered. In test mode, we use USPS which doesn't require registration. ` +
          `If you see this error, the rate selection may have failed. Error: ${errorMessage}`
      );
    }
    throw new Error(errorMessage);
  }

  // Extract tracking information (only if transaction succeeded)
  // Note: In test mode, Shippo may not return tracking_number immediately
  // It might be in tracking_status object or available later via webhook
  const trackingNumber =
    transaction.tracking_number ||
    transaction.tracking_status?.tracking_number ||
    transaction.tracking_status?.tracking_number_provider ||
    null;

  const labelUrl = transaction.label_url || transaction.label_url_pdf || null;

  // In test mode, if no tracking number, generate a test tracking number
  // This allows testing the full flow even without real Shippo tracking
  // Format: TEST-XXXXXXXXXXXX (12 characters from transaction ID or timestamp)
  let finalTrackingNumber = trackingNumber;
  if (!finalTrackingNumber && shippoApiKey.startsWith("shippo_test_")) {
    // Generate test tracking number from transaction ID or timestamp
    const idSource =
      transaction.object_id?.replace(/[^a-zA-Z0-9]/g, "") ||
      transaction.id?.replace(/[^a-zA-Z0-9]/g, "") ||
      Date.now().toString();
    finalTrackingNumber = `TEST-${idSource.slice(-12).toUpperCase()}`;
    console.log("Generated test tracking number:", finalTrackingNumber);
  }

  return {
    trackingNumber: finalTrackingNumber,
    trackingCarrier: transaction.carrier || shipment.carrier || "usps",
    labelUrl: labelUrl,
    trackingUrl: transaction.tracking_url_provider || null,
    status: transaction.status,
    shippoTransactionId: transaction.object_id,
  };
}

/**
 * Lambda Handler Function
 *
 * @param {object} event - Lambda event object from HTTP API
 * @param {object} context - Lambda context object
 * @returns {Promise<object>} Lambda response object
 */
exports.handler = async (event, context) => {
  // Log the incoming request for debugging
  console.log("Admin Generate Label Lambda invoked:", {
    method: event.requestContext?.http?.method || event.httpMethod,
    path: event.requestContext?.http?.path || event.path,
    pathParameters: event.pathParameters,
  });

  // Handle CORS preflight request (OPTIONS)
  const httpMethod = event.requestContext?.http?.method || event.httpMethod;
  if (httpMethod === "OPTIONS") {
    return handleOptions();
  }

  try {
    // Require authentication and admin role
    const user = await requireAuth(event);
    if (user.role !== "admin") {
      return errorResponse("Admin access required", 403);
    }

    // Extract order ID from path parameters
    const orderId = event.pathParameters?.id;
    if (!orderId) {
      return errorResponse("Order ID is required", 400);
    }

    // Get order from database
    const order = await getOrderById(orderId);
    if (!order) {
      return errorResponse("Order not found", 404);
    }

    // Parse request body (optional options)
    let options = {};
    try {
      const body = event.body ? JSON.parse(event.body) : {};
      options = {
        carrier: body.carrier,
        service: body.service,
        fromAddress: body.fromAddress,
        toAddress: body.toAddress,
        length: body.length,
        width: body.width,
        height: body.height,
      };
    } catch (parseError) {
      // Invalid JSON - use defaults
      console.warn("Invalid request body, using defaults:", parseError.message);
    }

    // Generate shipping label via Shippo
    const labelData = await generateShippoLabel(order, options);

    // Update order with tracking information and set status to "shipped"
    const updatedOrder = await updateOrderTracking(orderId, {
      trackingNumber: labelData.trackingNumber,
      trackingCarrier: labelData.trackingCarrier,
      labelUrl: labelData.labelUrl,
      status: "shipped", // Automatically set to shipped when label is generated
    });

    // Log activity (non-blocking - don't fail if logging fails)
    logActivity({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "status_change",
      entityType: "order",
      entityId: orderId,
      details: {
        previousStatus: order.status,
        newStatus: "shipped",
        trackingNumber: labelData.trackingNumber,
        trackingCarrier: labelData.trackingCarrier,
        labelGenerated: true,
        orderId: orderId,
      },
    }).catch((logError) => {
      console.error("Failed to log activity:", logError);
      // Don't throw - activity logging is non-critical
    });

    // Return success response with label data
    // Ensure all fields are included even if some are null/undefined
    // Include user data for email notifications
    return successResponse({
      orderId: updatedOrder.id,
      trackingNumber:
        updatedOrder.trackingNumber || labelData.trackingNumber || null,
      trackingCarrier:
        updatedOrder.trackingCarrier || labelData.trackingCarrier || "usps",
      labelUrl: updatedOrder.labelUrl || labelData.labelUrl || null,
      trackingUrl: labelData.trackingUrl || null,
      status: updatedOrder.status,
      updatedAt: updatedOrder.updatedAt,
      // Include user data for email notifications
      user: updatedOrder.user || order.user || null,
      userId: updatedOrder.userId || order.userId || null,
      userEmail: updatedOrder.user?.email || order.user?.email || null,
      userName: updatedOrder.user?.name || order.user?.name || null,
      message: "Shipping label generated successfully",
    });
  } catch (error) {
    console.error("Generate label error:", {
      error: error.message,
      stack: error.stack,
      orderId: event.pathParameters?.id,
    });

    // Provide user-friendly error messages
    let errorMessage = "Failed to generate shipping label";
    let statusCode = 500;

    if (error.message.includes("Incomplete shipping address")) {
      errorMessage =
        "Shipping address is incomplete. Please ensure all required fields are provided.";
      statusCode = 400;
    } else if (error.message.includes("No shipping rates")) {
      errorMessage =
        "No shipping rates available. Please check address and parcel dimensions.";
      statusCode = 400;
    } else if (error.message.includes("Shippo API")) {
      errorMessage =
        "Shipping service temporarily unavailable. Please try again or use manual tracking.";
      statusCode = 503;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return errorResponse(errorMessage, statusCode);
  }
};
