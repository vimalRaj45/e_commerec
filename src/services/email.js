const nodemailer = require('nodemailer');
const config = require('../config');

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: config.BREVO_USER,
    pass: config.BREVO_PASS,
  },
});

async function sendEmail({ to, subject, html, orderId, fastify }) {
  const mailOptions = {
    from: `"${config.BREVO_SENDER_NAME}" <${config.SENDER_EMAIL}>`,
    to,
    subject,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    if (fastify && fastify.prisma) {
      await fastify.prisma.notificationLog.create({
        data: {
          orderId,
          type: 'EMAIL',
          status: 'SENT',
        },
      });
    }
    return info;
  } catch (error) {
    console.error('Email sending failed:', error);
    if (fastify && fastify.prisma) {
      await fastify.prisma.notificationLog.create({
        data: {
          orderId,
          type: 'EMAIL',
          status: 'FAILED',
          error: error.message,
        },
      });
    }
    throw error;
  }
}

// Async send wrapper (doesn't await the actual sending for the response)
function sendEmailAsync(options) {
  sendEmail(options).catch(err => console.error('Background email failed:', err));
}

module.exports = { sendEmail, sendEmailAsync };
