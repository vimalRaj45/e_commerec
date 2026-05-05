const fastify = require('fastify')({
  logger: true,
  bodyLimit: 5242880, // 5MB
});
const path = require('path');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');

// Register Plugins
fastify.register(require('@fastify/formbody'));
fastify.register(require('@fastify/multipart'), {
  limits: { fileSize: 5242880 }, // 5MB
});
fastify.register(require('@fastify/cookie'), {
  secret: config.JWT_SECRET,
  parseOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.NODE_ENV === 'production',
  },
});
fastify.register(require('@fastify/jwt'), {
  secret: config.JWT_SECRET,
  cookie: {
    cookieName: 'refresh_token',
    signed: false,
  },
});
fastify.register(require('@fastify/cors'), {
  origin: config.NODE_ENV === 'production' ? ['https://your-domain.com'] : true,
  credentials: true,
});
fastify.register(require('@fastify/rate-limit'), {
  max: 100,
  timeWindow: '1 minute',
});
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, '../public'),
  prefix: '/',
});
fastify.register(require('@fastify/swagger'), {
  swagger: {
    info: { title: 'ShopOS API', version: '1.0.0' },
    host: `localhost:${config.PORT}`,
    schemes: ['http'],
    consumes: ['application/json'],
    produces: ['application/json'],
  },
});
fastify.register(require('@fastify/swagger-ui'), {
  routePrefix: '/docs',
});

// Custom Plugins
fastify.register(require('./plugins/prisma'));
fastify.register(require('./plugins/redis'));
fastify.register(require('./plugins/auth'));

// Global Error Handler
fastify.setErrorHandler(errorHandler);

// Security Headers Hook
fastify.addHook('onSend', async (request, reply, payload) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-XSS-Protection', '1; mode=block');
  return payload;
});

// Routes
fastify.register(require('./routes/health'), { prefix: '/health' });
fastify.register(require('./routes/auth'), { prefix: '/api/auth' });
fastify.register(require('./routes/shop'), { prefix: '/api/shop' });
fastify.register(require('./routes/products'), { prefix: '/api/products' });
fastify.register(require('./routes/cart'), { prefix: '/api/cart' });
fastify.register(require('./routes/orders'), { prefix: '/api/orders' });
fastify.register(require('./routes/payments'), { prefix: '/api/payments' });
fastify.register(require('./routes/webhooks'), { prefix: '/api/webhooks' });
fastify.register(require('./routes/dashboard'), { prefix: '/api/admin/dashboard' });
fastify.register(require('./routes/admin-orders'), { prefix: '/api/admin/orders' });
fastify.register(require('./routes/upload'), { prefix: '/api/upload' });

// Serve HTML pages
fastify.get('/', (req, reply) => reply.sendFile('index.html'));
fastify.get('/product.html', (req, reply) => reply.sendFile('product.html'));
fastify.get('/cart.html', (req, reply) => reply.sendFile('cart.html'));
fastify.get('/checkout.html', (req, reply) => reply.sendFile('checkout.html'));
fastify.get('/order-confirmation.html', (req, reply) => reply.sendFile('order-confirmation.html'));
fastify.get('/track.html', (req, reply) => reply.sendFile('track.html'));

// Admin HTML pages
fastify.get('/admin/login.html', (req, reply) => reply.sendFile('admin/login.html'));
fastify.get('/admin/register.html', (req, reply) => reply.sendFile('admin/register.html'));
fastify.get('/admin/dashboard.html', (req, reply) => reply.sendFile('admin/dashboard.html'));
fastify.get('/admin/orders.html', (req, reply) => reply.sendFile('admin/orders.html'));
fastify.get('/admin/products.html', (req, reply) => reply.sendFile('admin/products.html'));
fastify.get('/admin/product-form.html', (req, reply) => reply.sendFile('admin/product-form.html'));
fastify.get('/admin/settings.html', (req, reply) => reply.sendFile('admin/settings.html'));

// Start Server
const start = async () => {
  try {
    await fastify.listen({ port: config.PORT, host: '0.0.0.0' });
    console.log(`🚀 Server ready at http://localhost:${config.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
