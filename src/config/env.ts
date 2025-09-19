import dotenv from 'dotenv';

// Load .env if present
dotenv.config();

function required(name: string, value: string | undefined = process.env[name]): string {
  if (!value || value.trim() === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export interface CloudflareConfig {
  accountId: string | undefined;
  apiToken: string | undefined;
  apiKey: string | undefined;
  email: string | undefined;
  kvNamespaceId: string | undefined;
}

export interface R2Config {
  accountId: string | undefined;
  accessKeyId: string | undefined;
  secretAccessKey: string | undefined;
  bucket: string | undefined;
  region: string;
}

export interface Config {
  cf: CloudflareConfig;
  r2: R2Config;
  publicBaseDomain: string;
}

export const config: Config = {
  cf: {
    accountId: process.env.CF_ACCOUNT_ID,
    apiToken: process.env.CF_API_TOKEN,
    // Optional fallback for Global API Key auth
    apiKey: process.env.CF_API_KEY,
    email: process.env.CF_EMAIL,
    kvNamespaceId: process.env.CF_KV_NAMESPACE_ID,
  },
  r2: {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET,
    region: process.env.R2_REGION || 'auto',
  },
  publicBaseDomain: process.env.PUBLIC_BASE_DOMAIN || 'example.com',
};

export function assertControlPlaneEnv(): void {
  // Validate only what the control plane needs
  required('R2_ACCOUNT_ID');
  required('R2_ACCESS_KEY_ID');
  required('R2_SECRET_ACCESS_KEY');
  required('R2_BUCKET');
  required('CF_ACCOUNT_ID');
  required('CF_API_TOKEN');
  required('CF_KV_NAMESPACE_ID');
}