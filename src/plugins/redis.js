const fp = require('fastify-plugin');
const { Redis } = require('@upstash/redis');
const config = require('../config');

async function redisPlugin(fastify, opts) {
  const redis = new Redis({
    url: config.UPSTASH_REDIS_URL,
    token: config.UPSTASH_REDIS_TOKEN,
  });

  fastify.decorate('redis', redis);
}

module.exports = fp(redisPlugin);
