const { cartItemSchema } = require('../schemas/zod');
const { v4: uuidv4 } = require('uuid');

async function cartRoutes(fastify, opts) {
  // Helper to get or create cart session ID
  const getSessionId = (request, reply) => {
    let sessionId = request.cookies.cart_session;
    if (!sessionId) {
      sessionId = uuidv4();
      reply.setCookie('cart_session', sessionId, {
        path: '/',
        httpOnly: true,
        maxAge: 86400, // 24 hours
        sameSite: 'strict',
      });
    }
    return sessionId;
  };

  // Get Cart
  fastify.get('/', async (request, reply) => {
    const sessionId = getSessionId(request, reply);
    const cart = await fastify.redis.get(`cart:${sessionId}`) || [];
    
    if (cart.length === 0) return { success: true, data: [] };

    // Fetch fresh product data for each item
    const products = await fastify.prisma.product.findMany({
      where: {
        id: { in: cart.map(item => item.productId) },
        isDeleted: false,
      }
    });

    const detailedCart = cart.map(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product || !product.isActive) return null;
      return {
        ...item,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        stock: product.stock,
      };
    }).filter(Boolean);

    return { success: true, data: detailedCart };
  });

  // Add to Cart
  fastify.post('/add', async (request, reply) => {
    const { productId, quantity, size } = cartItemSchema.parse(request.body);
    const sessionId = getSessionId(request, reply);

    const product = await fastify.prisma.product.findFirst({
      where: { id: productId, isActive: true, isDeleted: false }
    });

    if (!product) {
      return reply.code(404).send({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' } });
    }

    if (product.stock < quantity) {
      return reply.code(400).send({ success: false, error: { code: 'OUT_OF_STOCK', message: 'Insufficient stock' } });
    }

    let cart = await fastify.redis.get(`cart:${sessionId}`) || [];
    const existingIndex = cart.findIndex(item => item.productId === productId && item.size === size);

    if (existingIndex > -1) {
      cart[existingIndex].quantity += quantity;
      if (cart[existingIndex].quantity > 20) cart[existingIndex].quantity = 20;
    } else {
      cart.push({ productId, quantity, size });
    }

    await fastify.redis.set(`cart:${sessionId}`, JSON.stringify(cart), { ex: 86400 });
    return { success: true, data: cart };
  });

  // Update Cart Item
  fastify.put('/update', async (request, reply) => {
    const { productId, quantity, size } = cartItemSchema.parse(request.body);
    const sessionId = getSessionId(request, reply);

    let cart = await fastify.redis.get(`cart:${sessionId}`) || [];
    const existingIndex = cart.findIndex(item => item.productId === productId && item.size === size);

    if (existingIndex > -1) {
      cart[existingIndex].quantity = quantity;
      await fastify.redis.set(`cart:${sessionId}`, JSON.stringify(cart), { ex: 86400 });
    }

    return { success: true, data: cart };
  });

  // Remove from Cart
  fastify.delete('/remove/:productId', async (request, reply) => {
    const { productId } = request.params;
    const { size } = request.query;
    const sessionId = getSessionId(request, reply);

    let cart = await fastify.redis.get(`cart:${sessionId}`) || [];
    cart = cart.filter(item => !(item.productId === productId && item.size === size));

    await fastify.redis.set(`cart:${sessionId}`, JSON.stringify(cart), { ex: 86400 });
    return { success: true, data: cart };
  });

  // Clear Cart
  fastify.delete('/clear', async (request, reply) => {
    const sessionId = getSessionId(request, reply);
    await fastify.redis.del(`cart:${sessionId}`);
    return { success: true };
  });
}

module.exports = cartRoutes;
