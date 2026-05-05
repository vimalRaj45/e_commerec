const Razorpay = require('razorpay');
const crypto = require('crypto');
const config = require('../config');

const razorpay = new Razorpay({
  key_id: config.RAZORPAY_KEY_ID,
  key_secret: config.RAZORPAY_KEY_SECRET,
});

async function paymentRoutes(fastify, opts) {
  // Get Razorpay Key ID
  fastify.get('/razorpay-key', async (request, reply) => {
    return { success: true, data: { keyId: config.RAZORPAY_KEY_ID } };
  });

  // Create Razorpay Order
  fastify.post('/create-order', async (request, reply) => {
    const { orderId } = request.body;

    const order = await fastify.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return reply.code(404).send({ success: false, error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } });
    }

    const options = {
      amount: Math.round(parseFloat(order.total) * 100), // in paise
      currency: "INR",
      receipt: order.invoiceNumber,
    };

    try {
      const rpOrder = await razorpay.orders.create(options);
      
      await fastify.prisma.order.update({
        where: { id: orderId },
        data: { razorpayOrderId: rpOrder.id }
      });

      return { success: true, data: rpOrder };
    } catch (err) {
      return reply.code(500).send({ success: false, error: { code: 'PAYMENT_CREATION_FAILED', message: err.message } });
    }
  });

  // Verify Razorpay Payment
  fastify.post('/verify', async (request, reply) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = request.body;

    const generated_signature = crypto
      .createHmac('sha256', config.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');

    if (generated_signature === razorpay_signature) {
      try {
        await fastify.prisma.order.update({
          where: { razorpayOrderId: razorpay_order_id },
          data: { 
            paymentStatus: 'PAID',
            razorpayPaymentId: razorpay_payment_id
          }
        });
        return { success: true };
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ success: false, error: { code: 'UPDATE_FAILED', message: 'Failed to update order payment status' } });
      }
    } else {
      return reply.code(400).send({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Payment verification failed' } });
    }
  });
}

module.exports = paymentRoutes;
