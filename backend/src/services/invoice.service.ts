// Parent: REQ-1612 — order-confirmation invoice PDF, attached via email.service.ts.
// pdfkit renders with its built-in base-14 fonts (Helvetica), so no font files
// or headless-browser dependency are needed to produce a PDF on the server.

import PDFDocument from "pdfkit";

export interface InvoiceLineItem {
  name?: string;
  productName?: string;
  quantity?: number;
  price?: number;
}

export interface InvoiceData {
  orderId: string;
  orderDate?: string;
  customerName?: string;
  customerEmail?: string;
  items?: InvoiceLineItem[];
  total?: number;
}

// Deterministic invoice number derived from the order id — avoids adding a
// stateful running counter (and the schema migration/race-condition handling
// that would require) just to satisfy "every invoice needs a number."
function invoiceNumberFor(orderId: string): string {
  return `INV-${orderId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

const CURRENCY = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  const items = data.items || [];
  const invoiceNumber = invoiceNumberFor(data.orderId);
  const orderDate = data.orderDate || new Date().toLocaleDateString();
  const computedSubtotal = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
  const total = data.total ?? computedSubtotal;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Header — right column uses a fixed 145pt box (400..545) and tracks its
    // own running y so a full order-id UUID (which wraps to 2 lines at this
    // width) pushes the following line down instead of overlapping it.
    const rightColX = 400;
    const rightColWidth = 145;
    doc.fontSize(20).fillColor("#2563eb").text("CodeBook Store", 50, 50);
    doc.fontSize(10).fillColor("#6b7280").text("Latest Computer Science E-Books & Learning", 50, 74);

    doc.fontSize(18).fillColor("#111827").text("INVOICE", rightColX, 50, { width: rightColWidth, align: "right" });
    doc.fontSize(10).fillColor("#374151");
    let rightY = 78;
    const rightLines = [`Invoice #: ${invoiceNumber}`, `Order #: ${data.orderId}`, `Date: ${orderDate}`];
    for (const line of rightLines) {
      doc.text(line, rightColX, rightY, { width: rightColWidth, align: "right" });
      rightY += doc.heightOfString(line, { width: rightColWidth, align: "right" }) + 4;
    }

    // Bill-to
    const dividerY = Math.max(130, rightY + 6);
    doc.moveTo(50, dividerY).lineTo(545, dividerY).strokeColor("#e5e7eb").stroke();
    doc.fontSize(11).fillColor("#111827").text("Bill To:", 50, dividerY + 15);
    doc.fontSize(10).fillColor("#374151");
    doc.text(data.customerName || "Customer", 50, dividerY + 32);
    if (data.customerEmail) doc.text(data.customerEmail, 50, dividerY + 46);

    // Line-item table — top offset tracks dividerY so a wrapped order-id
    // (pushing the Bill To block down) can never make it collide with the table.
    const tableTop = dividerY + 90;
    const col = { name: 50, qty: 320, price: 390, lineTotal: 470 };
    doc.fontSize(10).fillColor("#ffffff");
    doc.rect(50, tableTop, 495, 22).fill("#2563eb");
    doc.fillColor("#ffffff");
    doc.text("Item", col.name + 8, tableTop + 6);
    doc.text("Qty", col.qty, tableTop + 6, { width: 50, align: "right" });
    doc.text("Unit Price", col.price, tableTop + 6, { width: 70, align: "right" });
    doc.text("Total", col.lineTotal, tableTop + 6, { width: 65, align: "right" });

    let y = tableTop + 22;
    doc.fillColor("#374151");
    items.forEach((item, index) => {
      const quantity = item.quantity || 1;
      const price = item.price || 0;
      const rowHeight = 22;
      if (index % 2 === 1) {
        doc.rect(50, y, 495, rowHeight).fill("#f9fafb");
        doc.fillColor("#374151");
      }
      const label = item.name || item.productName || "Product";
      doc.fontSize(9).text(label, col.name + 8, y + 6, { width: 260, ellipsis: true });
      doc.text(String(quantity), col.qty, y + 6, { width: 50, align: "right" });
      doc.text(CURRENCY.format(price), col.price, y + 6, { width: 70, align: "right" });
      doc.text(CURRENCY.format(price * quantity), col.lineTotal, y + 6, { width: 65, align: "right" });
      y += rowHeight;
    });

    // Totals
    y += 10;
    doc.moveTo(350, y).lineTo(545, y).strokeColor("#e5e7eb").stroke();
    y += 10;
    doc.fontSize(11).fillColor("#111827");
    doc.text("Total", 350, y, { width: 120, align: "right" });
    doc.text(CURRENCY.format(total), col.lineTotal, y, { width: 65, align: "right" });

    // Footer
    doc.fontSize(9).fillColor("#9ca3af").text(
      "Thank you for shopping with CodeBook Store. This is a computer-generated invoice.",
      50,
      750,
      { align: "center", width: 495 }
    );

    doc.end();
  });
}
