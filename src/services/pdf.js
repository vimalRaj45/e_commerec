const PDFDocument = require('pdfkit');

function generateBillPDF(order, shop) {
  const doc = new PDFDocument({ margin: 50 });

  // Header
  doc.fontSize(20).text(shop.name, { align: 'center' });
  doc.fontSize(10).text(`GSTIN: ${shop.gstin || 'N/A'}`, { align: 'center' });
  doc.text(`${shop.address || ''}`, { align: 'center' });
  doc.text(`Phone: ${shop.phone || ''}`, { align: 'center' });
  doc.moveDown();

  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown();

  // Invoice Details
  const startY = doc.y;
  doc.text(`Invoice No: ${order.invoiceNumber}`, 50, startY);
  doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 350, startY);
  doc.moveDown();
  doc.text(`Customer: ${order.customerName}`);
  doc.text(`Phone: ${order.customerPhone}`);
  doc.text(`Address: ${order.customerAddress || 'N/A'}`);
  doc.text(`Delivery: ${order.deliveryType}`);
  doc.moveDown();

  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown();

  // Table Header
  const tableTop = doc.y;
  doc.font('Helvetica-Bold');
  doc.text('Sr', 50, tableTop);
  doc.text('Item Name', 80, tableTop);
  doc.text('HSN', 280, tableTop);
  doc.text('Qty', 350, tableTop);
  doc.text('Price', 400, tableTop);
  doc.text('Amount', 480, tableTop);
  doc.font('Helvetica');
  doc.moveDown();

  let currentY = tableTop + 20;

  order.items.forEach((item, index) => {
    const amount = (parseFloat(item.price) * item.quantity).toFixed(2);
    doc.text(index + 1, 50, currentY);
    doc.text(item.name, 80, currentY, { width: 190 });
    doc.text(item.hsnCode || '-', 280, currentY);
    doc.text(item.quantity, 350, currentY);
    doc.text(parseFloat(item.price).toFixed(2), 400, currentY);
    doc.text(amount, 480, currentY);
    currentY += 20;
  });

  doc.moveDown();
  doc.moveTo(50, currentY).lineTo(550, currentY).stroke();
  currentY += 10;

  // Totals
  const subtotal = parseFloat(order.subtotal).toFixed(2);
  const cgst = parseFloat(order.cgst).toFixed(2);
  const sgst = parseFloat(order.sgst).toFixed(2);
  const total = parseFloat(order.total).toFixed(2);

  doc.text('Subtotal:', 350, currentY);
  doc.text(subtotal, 480, currentY, { align: 'right' });
  currentY += 15;

  doc.text('CGST (9%):', 350, currentY);
  doc.text(cgst, 480, currentY, { align: 'right' });
  currentY += 15;

  doc.text('SGST (9%):', 350, currentY);
  doc.text(sgst, 480, currentY, { align: 'right' });
  currentY += 15;

  doc.font('Helvetica-Bold');
  doc.text('Total:', 350, currentY);
  doc.text(total, 480, currentY, { align: 'right' });
  doc.font('Helvetica');

  // Footer
  doc.moveDown(4);
  doc.fontSize(12).text('Thank you for shopping with us!', { align: 'center' });
  doc.fontSize(10).text(`Contact: ${shop.phone || ''}`, { align: 'center' });

  return doc;
}

module.exports = { generateBillPDF };
