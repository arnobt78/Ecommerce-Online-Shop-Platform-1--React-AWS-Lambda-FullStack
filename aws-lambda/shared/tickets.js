/**
 * AWS Lambda - Tickets Helper Functions
 *
 * This module provides utilities for managing support tickets in DynamoDB.
 * Tickets are used for customer support communication between customers and admins.
 */

const { dynamoDB, TABLES } = require("./dynamodb");
const {
  PutCommand,
  GetCommand,
  UpdateCommand,
  ScanCommand,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");

// Lazy load uuid (ESM module) - will be imported when needed
let uuidModule = null;
async function getUuid() {
  if (!uuidModule) {
    uuidModule = await import("uuid");
  }
  const { v4: uuidv4 } = uuidModule;
  return uuidv4();
}

/**
 * Create a new support ticket
 *
 * @param {Object} ticketData - Ticket data
 * @param {string} ticketData.userId - Customer user ID
 * @param {string} ticketData.customerEmail - Customer email
 * @param {string} ticketData.customerName - Customer name
 * @param {string} ticketData.subject - Ticket subject
 * @param {string} ticketData.message - Initial message
 * @returns {Promise<Object>} Created ticket object
 */
async function createTicket(ticketData) {
  const {
    userId,
    customerEmail,
    customerName,
    subject,
    message,
  } = ticketData;

  // Validate required fields
  if (!userId || !customerEmail || !subject || !message) {
    throw new Error("Missing required fields: userId, customerEmail, subject, message");
  }

  // Generate ticket ID
  const ticketId = await getUuid();
  const now = new Date().toISOString();

  // Create ticket object
  const ticket = {
    id: ticketId,
    userId,
    customerEmail,
    customerName: customerName || "Customer",
    subject: subject.trim(),
    status: "open", // open, in_progress, resolved, closed
    messages: [
      {
        id: await getUuid(),
        senderId: userId,
        senderEmail: customerEmail,
        senderName: customerName || "Customer",
        senderRole: "customer",
        message: message.trim(),
        createdAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  // Save to DynamoDB
  await dynamoDB.send(
    new PutCommand({
      TableName: TABLES.TICKETS,
      Item: ticket,
    })
  );

  return ticket;
}

/**
 * Get a ticket by ID
 *
 * @param {string} ticketId - Ticket ID
 * @returns {Promise<Object|null>} Ticket object or null if not found
 */
async function getTicketById(ticketId) {
  const result = await dynamoDB.send(
    new GetCommand({
      TableName: TABLES.TICKETS,
      Key: { id: ticketId },
    })
  );

  return result.Item || null;
}

/**
 * Get all tickets for a customer (by userId)
 *
 * Uses the userId-index GSI for efficient querying.
 * This is much more efficient than Scan with FilterExpression.
 *
 * @param {string} userId - Customer user ID
 * @returns {Promise<Array>} Array of ticket objects, sorted by updatedAt descending
 */
async function getTicketsByUserId(userId) {
  try {
    // Use Query with GSI for efficient access
    const result = await dynamoDB.send(
      new QueryCommand({
        TableName: TABLES.TICKETS,
        IndexName: "userId-index", // Use GSI for efficient querying
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
      })
    );

    // Sort by updatedAt descending (most recent first)
    return (result.Items || []).sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );
  } catch (error) {
    // Fallback to Scan if GSI query fails (e.g., GSI not yet active)
    console.warn("GSI query failed, falling back to Scan:", error.message);
    const result = await dynamoDB.send(
      new ScanCommand({
        TableName: TABLES.TICKETS,
        FilterExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
      })
    );

    // Sort by updatedAt descending (most recent first)
    return (result.Items || []).sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );
  }
}

/**
 * Get all tickets (admin only)
 *
 * @returns {Promise<Array>} Array of all ticket objects
 */
async function getAllTickets() {
  const result = await dynamoDB.send(
    new ScanCommand({
      TableName: TABLES.TICKETS,
    })
  );

  // Sort by updatedAt descending (most recent first)
  return (result.Items || []).sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
  );
}

/**
 * Add a reply to a ticket
 *
 * @param {string} ticketId - Ticket ID
 * @param {Object} replyData - Reply data
 * @param {string} replyData.senderId - Sender user ID
 * @param {string} replyData.senderEmail - Sender email
 * @param {string} replyData.senderName - Sender name
 * @param {string} replyData.senderRole - Sender role (admin or customer)
 * @param {string} replyData.message - Reply message
 * @returns {Promise<Object>} Updated ticket object
 */
async function addTicketReply(ticketId, replyData) {
  const {
    senderId,
    senderEmail,
    senderName,
    senderRole,
    message,
  } = replyData;

  // Validate required fields
  if (!senderId || !senderEmail || !senderRole || !message) {
    throw new Error("Missing required fields: senderId, senderEmail, senderRole, message");
  }

  // Get existing ticket
  const ticket = await getTicketById(ticketId);
  if (!ticket) {
    throw new Error("Ticket not found");
  }

  // Generate reply ID
  const replyId = await getUuid();
  const now = new Date().toISOString();

  // Create reply object
  const reply = {
    id: replyId,
    senderId,
    senderEmail,
    senderName: senderName || (senderRole === "admin" ? "Admin" : "Customer"),
    senderRole,
    message: message.trim(),
    createdAt: now,
  };

  // Add reply to messages array
  const updatedMessages = [...(ticket.messages || []), reply];

  // Update ticket status if admin replies (set to in_progress if it was open)
  let updatedStatus = ticket.status;
  if (senderRole === "admin" && ticket.status === "open") {
    updatedStatus = "in_progress";
  }

  // Update ticket
  await dynamoDB.send(
    new UpdateCommand({
      TableName: TABLES.TICKETS,
      Key: { id: ticketId },
      UpdateExpression:
        "SET messages = :messages, #status = :status, updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":messages": updatedMessages,
        ":status": updatedStatus,
        ":updatedAt": now,
      },
    })
  );

  // Return updated ticket
  return {
    ...ticket,
    messages: updatedMessages,
    status: updatedStatus,
    updatedAt: now,
  };
}

/**
 * Update ticket status
 *
 * @param {string} ticketId - Ticket ID
 * @param {string} status - New status (open, in_progress, resolved, closed)
 * @returns {Promise<Object>} Updated ticket object
 */
async function updateTicketStatus(ticketId, status) {
  // Validate status
  const validStatuses = ["open", "in_progress", "resolved", "closed"];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
  }

  // Get existing ticket
  const ticket = await getTicketById(ticketId);
  if (!ticket) {
    throw new Error("Ticket not found");
  }

  const now = new Date().toISOString();

  // Update ticket status
  await dynamoDB.send(
    new UpdateCommand({
      TableName: TABLES.TICKETS,
      Key: { id: ticketId },
      UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": status,
        ":updatedAt": now,
      },
    })
  );

  // Return updated ticket
  return {
    ...ticket,
    status,
    updatedAt: now,
  };
}

/**
 * Delete a ticket
 *
 * @param {string} ticketId - Ticket ID
 * @returns {Promise<Object>} Deletion result
 */
async function deleteTicket(ticketId) {
  const { DeleteCommand } = require("@aws-sdk/lib-dynamodb");

  await dynamoDB.send(
    new DeleteCommand({
      TableName: TABLES.TICKETS,
      Key: { id: ticketId },
    })
  );

  return { id: ticketId, deleted: true };
}

module.exports = {
  createTicket,
  getTicketById,
  getTicketsByUserId,
  getAllTickets,
  addTicketReply,
  updateTicketStatus,
  deleteTicket,
};

