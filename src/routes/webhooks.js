const crypto = require('crypto');
const config = require('../config');

async function webhookRoutes(fastify, opts) {
  fastify.post('/razorpay', async (request, reply) => {
    const signature = request.headers['x-razorpay-signature'];
    const body = JSON.stringify(request.body);

    const expectedSignature = crypto
      .createHmac('sha256', config.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (signature === expectedSignature) {
      const event = request.body.event;
      if (event === 'payment.captured') {
        const payment = request.body.payload.payment.entity;
        const razorpayOrderId = payment.order_id;
        
        await fastify.prisma.order.update({
          where: { razorpayOrderId },
          data: { 
            paymentStatus: 'PAID',
            razorpayPaymentId: payment.id
          }
        });
      }
      return { status: 'ok' };
    } else {
      return reply.code(400).send({ status: 'invalid signature' });
    }
  });
}

module.exports = webhookRoutes;
