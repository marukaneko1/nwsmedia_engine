import dotenv from 'dotenv';

dotenv.config();

export const env = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/nwscrm',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  API_URL: process.env.API_URL || 'http://localhost:3000',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || '',
  FROM_EMAIL: process.env.FROM_EMAIL || 'noreply@nwsmedia.com',
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_API_KEY_SID: process.env.TWILIO_API_KEY_SID || '',
  TWILIO_API_KEY_SECRET: process.env.TWILIO_API_KEY_SECRET || '',
  TWILIO_TWIML_APP_SID: process.env.TWILIO_TWIML_APP_SID || '',
  TWILIO_CALLER_ID: process.env.TWILIO_CALLER_ID || '',
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
  S3_BUCKET: process.env.S3_BUCKET || 'nws-crm-files',
  S3_REGION: process.env.S3_REGION || 'us-east-1',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN || '',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'dev-encryption-key-change-me-32b!',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
};
