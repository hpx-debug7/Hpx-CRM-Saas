# 📋 Vitest Migration - Quick Reference

## Problem
```
❌ Cannot find package '@jest/globals'
```

## Solution Applied

### Change 1: Update Test Framework Import
```typescript
// Jest (Old)
import { describe, test, expect, beforeAll, afterEach } from '@jest/globals';

// Vitest (New)
import { describe, test, expect, beforeAll, afterEach } from 'vitest';
```

### Change 2: Reorganize Imports
```typescript
// Before: SignJWT import was at the bottom of the file
// After: Moved to top with other imports

import { describe, test, expect, beforeAll, afterEach } from 'vitest';
import { SignJWT } from 'jose';  // ← Moved here
import { prisma } from '@/lib/db';
import { loginAction } from '@/app/actions/auth';
import { getValidatedSession, generateSessionToken, verifySessionToken } from '@/lib/auth';
import { tenantScope } from '@/lib/tenantScope';
import { cookies } from 'next/headers';
```

## File Updated
✅ `__tests__/security.test.ts` (Lines 8-14)

## Changes Made
| Item | Count |
|------|-------|
| Lines Modified | 3 |
| Duplicates Removed | 1 |
| API Changes | 0 |
| Logic Changes | 0 |
| Breaking Changes | 0 |

## Verification

Run tests with Vitest:
```bash
npm test -- __tests__/security.test.ts
```

## Jest → Vitest Import Equivalents

| Jest | Vitest |
|------|--------|
| `@jest/globals` | `vitest` |
| `jest.fn()` | `vi.fn()` (if needed) |
| `jest.mock()` | `vi.mock()` (if needed) |
| `jest.spyOn()` | `vi.spyOn()` (if needed) |

**Note:** Our test file doesn't use jest.fn/mock/spyOn, so only the import was needed.

## Status
✅ **COMPLETE** - Test file is now Vitest-compatible and ready to run.
