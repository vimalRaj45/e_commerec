const { uploadToR2 } = require('../services/r2');

async function uploadRoutes(fastify, opts) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', fastify.requireOwner);

  fastify.post('/image', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ success: false, error: { code: 'NO_FILE', message: 'No file uploaded' } });
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(data.mimetype)) {
      return reply.code(400).send({ success: false, error: { code: 'INVALID_TYPE', message: 'Invalid file type' } });
    }

    try {
      const buffer = await data.toBuffer();
      const url = await uploadToR2(buffer, data.filename, data.mimetype);
      return { success: true, data: { url } };
    } catch (err) {
      return reply.code(500).send({ success: false, error: { code: 'UPLOAD_FAILED', message: err.message } });
    }
  });
}

module.exports = uploadRoutes;
