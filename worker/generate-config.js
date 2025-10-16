#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env file
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
}

// Read template
const templatePath = path.join(__dirname, 'wrangler.toml.template');
let template = fs.readFileSync(templatePath, 'utf8');

// Replace variables
template = template.replace(/\$\{(\w+)\}/g, (match, varName) => {
  return process.env[varName] || match;
});

// Write output
const outputPath = path.join(__dirname, 'wrangler.toml');
fs.writeFileSync(outputPath, template);

console.log('Generated wrangler.toml from template using .env values');
