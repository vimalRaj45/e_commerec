const fp = require('fastify-plugin');

async function authPlugin(fastify, opts) {
  fastify.decorate('authenticate', async (request, reply) => {
    try {
      await request.jwtVerify();
      
      // Check blocklist in Redis
      const jti = request.user.jti;
      if (jti) {
        const isBlocked = await fastify.redis.get(`blocklist:${jti}`);
        if (isBlocked) {
          throw new Error('Token is revoked');
        }
      }
    } catch (err) {
      reply.code(401).send({ 
        success: false, 
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized access' } 
      });
    }
  });

  fastify.decorate('requireOwner', async (request, reply) => {
    if (request.user.role !== 'OWNER') {
      reply.code(403).send({ 
        success: false, 
        error: { code: 'FORBIDDEN', message: 'Owner access required' } 
      });
    }
  });
}

module.exports = fp(authPlugin);
