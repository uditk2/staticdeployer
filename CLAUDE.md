# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start the control plane API server on localhost:3000 (uses tsx for TypeScript)
- `npm run build` - Compile TypeScript to JavaScript in dist/ directory
- `npm run start` - Start production server from compiled JavaScript
- `npm run typecheck` - Run TypeScript type checking without emitting files
- `npm run worker:dev` - Start Cloudflare Worker development server
- `npm run worker:deploy` - Deploy Worker to Cloudflare
- `npm run test:flow` - Run end-to-end test script

## Architecture Overview

This is a static site deployment system built on Cloudflare infrastructure with two main components:

### Control Plane (Node.js API)
- **Location**: `src/server/index.ts`
- **Purpose**: Receives ZIP uploads, extracts files, uploads to R2, manages host mappings in KV
- **Key endpoints**:
  - `POST /publish` - Upload site archive and create host mapping
  - `POST /mapping` - Update host mapping without upload
  - `GET /debug` - Debug host mappings and file existence

### Cloudflare Worker
- **Location**: `worker/src/index.ts`
- **Purpose**: Serves static content from R2 based on host mappings stored in KV
- **Flow**: Request → KV lookup (`host:domain`) → R2 fetch (`sites/{tenant}/{version}/{path}`)

## Key Services

- **R2 Service** (`src/services/r2.ts`): S3-compatible uploads to Cloudflare R2 with typed interfaces
- **KV Service** (`src/services/kv.ts`): Host-to-site mapping storage using Cloudflare KV with HostMapping type
- **Environment** (`src/config/env.ts`): Configuration and validation for CF/R2 credentials with typed config

## Configuration

- Copy `.env.example` to `.env` and configure Cloudflare credentials
- Required: `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `CF_KV_NAMESPACE_ID`, R2 credentials
- Worker bindings: `HOSTMAP` (KV namespace), `SITES_BUCKET` (R2 bucket)

## Storage Pattern

- **R2 structure**: `sites/{tenant}/{version}/{file_path}`
- **KV structure**: `host:{domain}` → `{tenant, version, root}`
- **Cache strategy**: HTML (60s), assets (1 year immutable)

## TypeScript Notes

- **tsconfig.json**: Main TypeScript configuration for src/ directory
- **worker/tsconfig.json**: Separate config for Cloudflare Worker with @cloudflare/workers-types
- **Development**: Use `npm run dev` (tsx) for hot-reload TypeScript development
- **Production**: Compile with `npm run build` then `npm run start`
- **Type checking**: Run `npm run typecheck` to verify types without compilation

## Worker Deployment

Edit `worker/wrangler.toml` with your account ID and resource bindings before deploying. Wrangler handles TypeScript compilation automatically.