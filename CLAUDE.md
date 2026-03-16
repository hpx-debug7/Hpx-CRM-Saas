# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **Enterprise Lead Management System** (v2.1.0) - a professional CRM solution built as a Next.js application with Electron for desktop deployment. The system supports lead tracking, email integration (Gmail/Outlook), audit logging, and multi-tenant architecture.

## Build & Development Commands

```bash
# Development
npm run dev              # Start Next.js dev server
npm run electron-dev     # Run Electron with Next.js dev server (concurrent)

# Building
npm run build            # Build Next.js (standalone output)
npm run build:prod       # Production build with no lint/mangling
npm run build-electron:win # Build Electron installer for Windows
npm run package:client   # Complete build pipeline with validation (creates installer)
npm run build:installer  # Alias for package:client

# Code Quality
npm run lint             # Run ESLint with auto-fix
npm run lint:check       # Run ESLint without fixes
npm run type-check       # TypeScript type checking (tsc --noEmit)

# Testing
npm test                                    # Run Vitest with Prisma migration reset
npm test -- security.test.ts                # Run single test file
npm test -- --reporter=verbose              # Run with verbose output
npm test -- --run                           # Run once without watch mode

# Database
npm run db:push          # Push Prisma schema to database
npm run db:studio        # Open Prisma Studio
npm run db:seed          # Run database seed script

# Utilities
npm run clean:win        # Clean build artifacts (.next, out, dist)
npm run build:analyze    # Analyze bundle size
npm run verify:build     # Verify build integrity
```

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 15.5.2 with React 19.1.0
- **Database**: PostgreSQL with Prisma 7.2.0 (using pg adapter)
- **Desktop**: Electron 33.4.11 with embedded Node.js server
- **Styling**: Tailwind CSS 4
- **Testing**: Vitest 3.2.4
- **Build Output**: Standalone (for Electron packaging)

### Key Directories

```
app/                     # Next.js App Router
├── api/                 # API routes (auth, leads, email, documents, webhooks)
├── actions/             # Server actions (audit, auth, user, presets)
├── components/          # React components (modals, tables, email)
├── context/             # React contexts (Lead, User, Column, etc.)
├── lib/                 # App-specific libraries
│   ├── email/           # Email providers (Gmail, Outlook), sync engine
│   └── server/          # Server-only modules (documentStorage, syncQueue)
├── types/               # TypeScript definitions (shared.ts is central)
└── utils/               # Utility functions

lib/                     # Shared libraries
├── server/              # Server-only code (db, auth, rateLimiter, logger)
├── client/              # Client-only code (logger, config)
└── shared/              # Isomorphic code (validations)

electron/                # Electron main process
├── main.js              # Entry point, starts embedded Next.js server
└── ipcHandlers.js       # IPC handlers for offline/sync

prisma/                  # Database schema and migrations
├── schema.prisma        # Main schema (Company, User, Lead, Email*, AuditLog)
└── seed.ts              # Seed data

__tests__/               # Vitest tests (security, auth, rate-limiter)
```

### Type System Architecture

**Centralized types in `app/types/shared.ts`** prevent circular dependencies:

```typescript
// ✅ Correct: Import types from shared.ts
import type { Lead, ColumnConfig } from '../types/shared';

// ❌ Incorrect: Don't import types from context files
import { Lead } from '../context/LeadContext'; // Causes circular dependency
```

**Dependency Graph:**
```
shared.ts (types only)
    ↓
LeadContext.tsx (implementation)
    ↓
ColumnContext.tsx (uses useLeads hook)
    ↓
Components & Pages
```

### Database Schema (Prisma)

**Core Models:**
- `Company` - Multi-tenant isolation root
- `User` - Employees with role-based access
- `Lead` - Customer leads with sync support (syncVersion, isDirty, syncStatus)
- `Session` - JWT-based authentication
- `AuditLog` - Comprehensive audit trail with hashing
- `EmailThread/Message/Attachment` - Email integration
- `SyncQueue/ConflictLog/SyncCheckpoint` - Offline/sync support

**Multi-tenant Pattern:** All models have `companyId` with cascading deletes.

**Key Prisma Relations:**
- `Company` → `User` (employees), `Lead`, `EmailThread`, `AuditLog`
- `User` → `Lead` (assignedTo/createdBy), `Session`
- `Lead` → `EmailThreadLead` (many-to-many for email linking)

### Security Architecture

**Authentication:**
- JWT-based with jose library
- Sessions stored in database
- Account lockout after failed attempts
- Password history enforcement

**Authorization:**
- Role-based access (ADMIN, SALES_MANAGER, SALES_EXECUTIVE, PROCESSOR)
- Permission guards via `usePermission` hook
- RoleGuard and PermissionGuard components

**API Security:**
- Rate limiting via `lib/server/rateLimiter.ts`
- CSRF protection
- Input sanitization (DOMPurify)
- Tenant isolation enforced in all API routes

**Audit Logging:**
- Comprehensive audit trail in `app/actions/audit.ts`
- All CRUD operations logged with before/after values
- Cryptographic hashing for tamper detection

### Electron Desktop App

**Architecture:**
- Electron loads embedded Next.js standalone server
- `ELECTRON_RUN_AS_NODE=1` allows Electron's Node.js to run Next.js
- Database copied to userData directory on first run
- IPC handlers for offline status and sync operations

**Build Process:**
1. Next.js builds to `.next/standalone` (standalone output for Electron)
2. electron-builder packages with NSIS installer
3. Output: `dist_v2_1_0/V4U All Rounder Setup 2.1.0.exe`

**Build Configuration:**
- `output: 'standalone'` in `next.config.ts` for embedded Node.js server
- `serverExternalPackages`: `['better-sqlite3']` for native bindings
- Webpack splits chunks for framer-motion, gsap, react-vendor
- Bundle analysis: `npm run build:analyze` (opens http://localhost:8888)

### Email Integration

**Providers:**
- Gmail (OAuth 2.0)
- Outlook/Microsoft (OAuth 2.0)

**Features:**
- Two-way sync via `app/lib/email/syncEngine.ts`
- Webhook support for real-time updates
- Lead linking from emails
- Encrypted token storage

### Sync & Offline Architecture

**Sync Queue:** `app/lib/server/syncQueue.ts`
- Batches sync operations for offline support
- Conflict resolution with server-wins/client-wins strategies
- Sync checkpoints for resuming interrupted syncs

**Offline Context:** `app/context/OfflineContext.tsx`
- Tracks online/offline status
- Queues mutations when offline
- Auto-syncs when connection restored

### Environment Configuration

**Required Variables (see `lib/env.ts`):**
```bash
DATABASE_URL="postgresql://..."
JWT_SECRET="min-32-characters"
EMAIL_ENCRYPTION_KEY="min-32-characters"
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
```

**Optional Variables:**
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` - Redis rate limiting
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Gmail OAuth
- `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` - Outlook OAuth
- `SENTRY_DSN` - Error monitoring

**Test Environment:**
- Safe defaults provided in `getEnv()` for CI/test
- Separate `.env.test` file support
- Vitest global setup configures test env automatically

## ESLint Configuration

**Key Rules:**
- `@typescript-eslint/no-unused-vars`: Warns on unused imports
- `react-hooks/exhaustive-deps`: Warns on missing dependencies
- `no-restricted-imports`: Blocks server modules in client components

**Inline Styles:** Allowed for react-window virtual scrolling (configured in `eslint.config.mjs`).

**Server/Client Import Rules:**
- Server modules (`@/lib/server/*`) cannot be imported in client components
- Override available for files in `app/api/**`, `app/actions/**`, `lib/server/**`

## Testing

**Framework:** Vitest with Node environment

**Test Files:**
- `__tests__/security.test.ts` - Security validation
- `__tests__/auth-validation.test.ts` - Auth flows
- `__tests__/rate-limiter.test.ts` - Rate limiting
- `__tests__/account-lockout.test.ts` - Account security
- `app/utils/__tests__/*.test.ts` - Utility functions

**Running Tests:**
```bash
npm test                                    # Resets Prisma migrations and runs Vitest
npm test -- security.test.ts                # Run specific test file
npm test -- --reporter=verbose              # Run with verbose output
npm test -- --run                          # Run once without watch mode
```

**Test Setup:**
- Global setup in `vitest.setup.ts` sets test environment variables
- `server-only` module mocked in `__tests__/mocks/server-only.js`
- Prisma migrations reset before each test run
- Test env vars auto-configured in `lib/env.ts` (safe defaults for CI)

## Server/Client Boundaries

**Critical Pattern:** Files in `app/lib/server/` and `lib/server/` are server-only.

```typescript
// ✅ Server component or server action - can import server modules
import { prisma } from '@/lib/server/db';
import { tenantScope } from '@/lib/server/tenantScope';

// ❌ Client component - will fail build if importing server modules
'use client';
import { prisma } from '@/lib/server/db'; // ESLint error!
```

**ESLint blocks imports** of server modules into client components via `no-restricted-imports` rule.

**Server Actions:** Use `'use server'` directive in files under `app/actions/`.

## Important Implementation Notes

**Virtual Scrolling:**
- Tables use `react-window` for >100 leads
- Inline styles required for positioning (ESLint override in place)

**Bundle Optimization:**
- Code splitting for modals (lazy loaded)
- Vendor chunks: framer-motion, gsap, react-vendor
- Tree-shaking enabled for heavy libraries

**Debug Logging:**
- `console.log` only in development (stripped in production)
- Use `logger` from `@/lib/client/logger` (client) or `@/lib/server/logger` (server)
- Server logger includes structured logging with request context

**Rate Limiting:**
- Global rate limiter in `lib/server/rateLimiter.ts` with Redis (Upstash) backing
- Applied automatically via `withApiLogging` wrapper on all API routes
- Login-specific limiter: 5 requests per 10 minutes (`loginRateLimiter`)
- Fail-open policy: allows requests if Redis is unavailable

**Default Credentials (Development):**
- Admin Password: `admin123`
- Export Password: `admin123`

## Common Tasks

**Add a new API route:**
1. Create `app/api/<route>/route.ts`
2. Use `withApiLogging` wrapper for logging, error handling, and automatic rate limiting
3. Enforce tenant isolation with `prisma.lead.findMany({ where: { companyId } })`

**API Route Pattern:**
```typescript
import { withApiLogging } from "@/lib/apiLogger";
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  return withApiLogging(req, async (requestId) => {
    // Handler logic here
    return NextResponse.json({ success: true, data });
  });
}
```

**Add a new component:**
1. Create in `app/components/`
2. Import types from `app/types/shared.ts`
3. Use existing hooks from `app/context/` for data access

**Database changes:**
1. Update `prisma/schema.prisma`
2. Run `npm run db:push`
3. Update mappers in `app/lib/leadMapper.ts` if needed

**Data Mapping Pattern:**
The `app/lib/leadMapper.ts` provides bidirectional conversion between:
- `Lead` (app types from `shared.ts`)
- `DbLead` (Prisma database schema)

Use `toDbLead()` when saving to database and `fromDbLead()` when loading from database. The mapper handles JSON serialization of custom fields via `customFields` column.

**Build for client delivery:**
```bash
npm run package:client
# Output in delivery/ directory with installer and documentation
```
