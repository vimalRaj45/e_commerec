const bcrypt = require('bcrypt');
const { loginSchema, registerSchema } = require('../schemas/zod');
const config = require('../config');
const axios = require('axios');

async function authRoutes(fastify, opts) {
  // Owner Registration
  fastify.post('/register', async (request, reply) => {
    const { email, password, name } = registerSchema.parse(request.body);

    const existing = await fastify.prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({ 
        success: false, 
        error: { code: 'USER_EXISTS', message: 'User already exists' } 
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await fastify.prisma.user.create({
      data: { email, passwordHash, name, role: 'OWNER' }
    });

    return { success: true, data: { id: user.id, email: user.email } };
  });

  // Customer Registration
  fastify.post('/customer/register', async (request, reply) => {
    const { email, password, name } = registerSchema.parse(request.body);

    const existing = await fastify.prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({ success: false, error: { code: 'USER_EXISTS', message: 'User already exists' } });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await fastify.prisma.user.create({
      data: { email, passwordHash, name, role: 'CUSTOMER' }
    });

    return { success: true, data: { id: user.id, email: user.email } };
  });

  // Owner Login
  fastify.post('/login', {
    config: {
      rateLimit: { max: 5, timeWindow: '15 minutes' }
    }
  }, async (request, reply) => {
    const { email, password } = loginSchema.parse(request.body);

    const user = await fastify.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return reply.code(401).send({ 
        success: false, 
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } 
      });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return reply.code(401).send({ 
        success: false, 
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } 
      });
    }

    const token = fastify.jwt.sign({ 
      id: user.id, 
      email: user.email, 
      role: user.role,
      jti: Math.random().toString(36).substring(7) 
    }, { expiresIn: '24h' });

    const refreshToken = fastify.jwt.sign({ id: user.id }, { expiresIn: '7d' });

    reply.setCookie('refresh_token', refreshToken, {
      path: '/api/auth',
      httpOnly: true,
      sameSite: 'strict',
      secure: config.NODE_ENV === 'production'
    });

    return { success: true, data: { token, user: { id: user.id, email: user.email, role: user.role } } };
  });

  // Google OAuth Redirect
  fastify.get('/google', async (request, reply) => {
    const state = Math.random().toString(36).substring(7);
    await fastify.redis.set(`oauth_state:${state}`, 'active', { ex: 600 });

    const params = new URLSearchParams({
      client_id: config.GOOGLE_CLIENT_ID,
      redirect_uri: config.GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      state: state,
      access_type: 'offline',
      prompt: 'consent'
    });

    reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  // Google OAuth Callback
  fastify.get('/google/callback', async (request, reply) => {
    const { code, state } = request.query;
    
    const savedState = await fastify.redis.get(`oauth_state:${state}`);
    if (!savedState) {
      return reply.code(400).send({ success: false, error: { code: 'INVALID_STATE', message: 'Invalid state' } });
    }
    await fastify.redis.del(`oauth_state:${state}`);

    // Exchange code for token
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: config.GOOGLE_CLIENT_ID,
      client_secret: config.GOOGLE_CLIENT_SECRET,
      redirect_uri: config.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code'
    });

    const { access_token } = tokenResponse.data;
    const profileResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const profile = profileResponse.data;

    // Upsert User
    const user = await fastify.prisma.user.upsert({
      where: { email: profile.email },
      update: { googleId: profile.id, name: profile.name },
      create: { 
        email: profile.email, 
        googleId: profile.id, 
        name: profile.name,
        role: 'OWNER'
      }
    });

    const token = fastify.jwt.sign({ 
      id: user.id, 
      email: user.email, 
      role: user.role,
      jti: Math.random().toString(36).substring(7)
    }, { expiresIn: '15m' });

    // Set cookie and redirect to dashboard
    reply.setCookie('refresh_token', token, { path: '/', httpOnly: true });
    reply.redirect('/admin/dashboard.html?token=' + token);
  });

  // Get Me
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    return { success: true, data: { user: request.user } };
  });

  // Logout
  fastify.post('/logout', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const jti = request.user.jti;
    if (jti) {
      await fastify.redis.set(`blocklist:${jti}`, '1', { ex: 900 }); // 15 mins
    }
    reply.clearCookie('refresh_token');
    return { success: true };
  });
}

module.exports = authRoutes;
