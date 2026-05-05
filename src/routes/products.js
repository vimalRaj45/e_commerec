const { productSchema } = require('../schemas/zod');

async function productRoutes(fastify, opts) {
  // Helper to invalidate product cache
  const invalidateCache = async () => {
    const keys = await fastify.redis.keys('products:list:*');
    if (keys.length > 0) {
      await fastify.redis.del(...keys);
    }
  };

  // List products (Public)
  fastify.get('/', async (request, reply) => {
    const { page = 1, limit = 20, search = '', category = '' } = request.query;
    const skip = (page - 1) * limit;
    
    const cacheKey = `products:list:${page}:${search}:${category}`;
    const cached = await fastify.redis.get(cacheKey);
    if (cached) return { success: true, data: cached };

    const where = {
      isActive: true,
      isDeleted: false,
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
      ...(category && { category }),
    };

    const [products, total] = await Promise.all([
      fastify.prisma.product.findMany({
        where,
        skip: Number(skip),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      fastify.prisma.product.count({ where }),
    ]);

    const result = { products, total, page: Number(page), limit: Number(limit) };
    await fastify.redis.set(cacheKey, JSON.stringify(result), { ex: 300 });

    return { success: true, data: result };
  });

  // Get single product (Public)
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params;
    const product = await fastify.prisma.product.findFirst({
      where: { id, isActive: true, isDeleted: false }
    });

    if (!product) {
      return reply.code(404).send({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' } });
    }

    return { success: true, data: product };
  });

  // Create product (Owner Only)
  fastify.post('/', { preHandler: [fastify.authenticate, fastify.requireOwner] }, async (request, reply) => {
    const data = productSchema.parse(request.body);
    const shop = await fastify.prisma.shop.findFirst();

    const product = await fastify.prisma.product.create({
      data: { ...data, shopId: shop.id }
    });

    await invalidateCache();
    return { success: true, data: product };
  });

  // Update product (Owner Only)
  fastify.put('/:id', { preHandler: [fastify.authenticate, fastify.requireOwner] }, async (request, reply) => {
    const { id } = request.params;
    const data = productSchema.parse(request.body);

    const product = await fastify.prisma.product.update({
      where: { id },
      data
    });

    await invalidateCache();
    return { success: true, data: product };
  });

  // Soft delete (Owner Only)
  fastify.delete('/:id', { preHandler: [fastify.authenticate, fastify.requireOwner] }, async (request, reply) => {
    const { id } = request.params;
    await fastify.prisma.product.update({
      where: { id },
      data: { isDeleted: true }
    });

    await invalidateCache();
    return { success: true };
  });

  // Toggle active (Owner Only)
  fastify.patch('/:id/toggle', { preHandler: [fastify.authenticate, fastify.requireOwner] }, async (request, reply) => {
    const { id } = request.params;
    const product = await fastify.prisma.product.findUnique({ where: { id } });
    
    const updated = await fastify.prisma.product.update({
      where: { id },
      data: { isActive: !product.isActive }
    });

    await invalidateCache();
    return { success: true, data: updated };
  });

  // Update stock (Owner Only)
  fastify.patch('/:id/stock', { preHandler: [fastify.authenticate, fastify.requireOwner] }, async (request, reply) => {
    const { id } = request.params;
    const { stock } = request.body;

    const updated = await fastify.prisma.product.update({
      where: { id },
      data: { stock: Number(stock) }
    });

    await invalidateCache();
    return { success: true, data: updated };
  });
}

module.exports = productRoutes;
