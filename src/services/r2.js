const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const config = require('../config');
const { v4: uuidv4 } = require('uuid');

const s3 = new S3Client({
  region: 'auto',
  endpoint: config.R2_ENDPOINT,
  credentials: {
    accessKeyId: config.R2_ACCESS_KEY_ID,
    secretAccessKey: config.R2_SECRET_ACCESS_KEY,
  },
});

async function uploadToR2(buffer, filename, mimeType) {
  const extension = filename.split('.').pop();
  const key = `${uuidv4()}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: config.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  });

  await s3.send(command);
  return `${config.R2_PUBLIC_URL}/${key}`;
}

module.exports = { uploadToR2 };
