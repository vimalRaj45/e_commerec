const config = require('../config');

async function generateInvoiceNumber(redis) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const key = `invoice:seq:${dateStr}`;
  
  const seq = await redis.incr(key);
  // Set TTL to 48 hours for the key just in case
  await redis.expire(key, 172800);
  
  const paddedSeq = seq.toString().padStart(4, '0');
  return `INV-${dateStr}-${paddedSeq}`;
}

module.exports = { generateInvoiceNumber };
