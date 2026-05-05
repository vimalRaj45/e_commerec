const { shopUpdateSchema } = require('../schemas/zod');

async function shopRoutes(fastify, opts) {
  // Get Shop Details (Public)
  fastify.get('/', async (request, reply) => {
    let shop = await fastify.prisma.shop.findFirst();
    
    // Auto-create shop if it doesn't exist (initial setup)
    if (!shop) {
      shop = await fastify.prisma.shop.create({
        data: {
          name: "My Shop",
          slug: "my-shop",
          description: "Welcome to my shop",
        }
      });
    }
    
    return { success: true, data: shop };
  });

  // Update Shop Details (Owner Only)
  fastify.put('/', { 
    preHandler: [fastify.authenticate, fastify.requireOwner] 
  }, async (request, reply) => {
    const data = shopUpdateSchema.parse(request.body);
    const shop = await fastify.prisma.shop.findFirst();
    
    const updated = await fastify.prisma.shop.update({
      where: { id: shop.id },
      data
    });

    return { success: true, data: updated };
  });
}

module.exports = shopRoutes;
