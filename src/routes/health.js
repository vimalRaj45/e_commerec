async function healthRoutes(fastify, opts) {
  fastify.get('/', async (request, reply) => {
    try {
      await fastify.prisma.$queryRaw`SELECT 1`;
      const redisPing = await fastify.redis.ping();
      
      return { 
        status: "ok", 
        db: "ok", 
        redis: redisPing === "PONG" ? "ok" : "error" 
      };
    } catch (err) {
      reply.code(500).send({ status: "error", message: err.message });
    }
  });
}

module.exports = healthRoutes;
