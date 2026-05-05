const { ZodError } = require('zod');

function errorHandler(error, request, reply) {
  request.log.error(error);

  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        field: error.errors[0]?.path.join('.') || 'unknown',
        details: error.errors
      }
    });
  }

  if (error.statusCode) {
    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code || 'API_ERROR',
        message: error.message
      }
    });
  }

  reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred'
    }
  });
}

module.exports = errorHandler;
