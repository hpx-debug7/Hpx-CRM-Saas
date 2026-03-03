# Quick Reference: Multi-Tenant Isolation

## The Core Rule

**NEVER trust companyId from user input. ALWAYS use companyId from validated session.**

---

## Code Patterns

### ✓ How to Write a Protected API Route

```typescript
'use server';
import { NextRequest, NextResponse } from 'next/server';
import { secureHandler } from '@/lib/secureHandler';
import { tenantScope } from '@/lib/tenantScope';

// GET /api/leads
export const GET = secureHandler(
  async (req, { userId, companyId, role }) => {
    // 1. Use tenantScope for ALL queries
    const leads = await tenantScope(companyId).lead.findMany({
      where: { status: 'NEW_LEAD' }
    });

    return NextResponse.json({ leads });
  },
  { requiredRoles: ['ADMIN'] } // Optional: restrict by role
);

// POST /api/leads
export const POST = secureHandler(
  async (req, { userId, companyId }) => {
    const body = await req.json();

    // 2. Never trust companyId from request
    // const companyId = body.companyId; ❌ WRONG

    // 3. Always create with companyId from session
    const lead = await tenantScope(companyId).lead.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        // companyId is automatically added by tenantScope
      }
    });

    return NextResponse.json({ lead });
  }
);

// DELETE /api/leads/{id}
export const DELETE = secureHandler(
  async (req, { companyId }) => {
    const leadId = new URL(req.url).searchParams.get('id');

    // 4. Verify entity belongs to company before deleting
    const lead = await tenantScope(companyId).lead.findUnique({
      where: { id: leadId }
    });

    if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // 5. Delete using tenantScope (adds companyId)
    await tenantScope(companyId).lead.delete({
      where: { id: leadId }
    });

    return NextResponse.json({ success: true });
  },
  { requiredRoles: ['ADMIN'] }
);
```

---

## ❌ Common Mistakes

### Mistake 1: Forgetting tenantScope
```typescript
// ❌ WRONG: Vulnerable to cross-tenant access
const leads = await prisma.lead.findMany({
  where: { status: 'NEW_LEAD' }
});

// ✓ CORRECT: Scoped to company
const leads = await tenantScope(companyId).lead.findMany({
  where: { status: 'NEW_LEAD' }
});
```

### Mistake 2: Trusting companyId from request
```typescript
// ❌ WRONG: User could request another company's data
const companyId = req.body.companyId;
const data = await tenantScope(companyId).lead.findMany({...});

// ✓ CORRECT: Use companyId from validated session
const { companyId } = await getValidatedSession();
const data = await tenantScope(companyId).lead.findMany({...});
```

### Mistake 3: Not wrapping route with secureHandler
```typescript
// ❌ WRONG: No automatic session validation
export async function GET(req: NextRequest) {
  const leads = await prisma.lead.findMany({...});
  return NextResponse.json(leads);
}

// ✓ CORRECT: secureHandler validates session
export const GET = secureHandler(
  async (req, { companyId }) => {
    const leads = await tenantScope(companyId).lead.findMany({...});
    return NextResponse.json(leads);
  }
);
```

### Mistake 4: Not verifying entity ownership
```typescript
// ❌ WRONG: Attacker could guess another company's lead ID
export const DELETE = secureHandler(
  async (req, { companyId }) => {
    const leadId = req.body.leadId;
    await tenantScope(companyId).lead.delete({
      where: { id: leadId }
    }); // What if lead doesn't exist OR belongs to another company?
  }
);

// ✓ CORRECT: Verify before operating
export const DELETE = secureHandler(
  async (req, { companyId }) => {
    const leadId = req.body.leadId;
    const lead = await tenantScope(companyId).lead.findUnique({
      where: { id: leadId }
    });
    if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await tenantScope(companyId).lead.delete({
      where: { id: leadId }
    });
  }
);
```

---

## Security Checks

### When to Use Which Function

| Need | Function | Usage |
|------|----------|-------|
| Wrap API route | `secureHandler` | `export const GET = secureHandler(...);` |
| Scope queries | `tenantScope` | `tenantScope(companyId).lead.findMany()` |
| Get validated session | `getValidatedSession` | Server actions, direct functions |
| Get session (lenient) | `getSession` | Components that don't throw |
| User lookup by username | `findUserByUsernameInCompany` | Pass companyId explicitly |
| User lookup by email | `findUserByEmail` | Works across companies |

---

## Request/Response Examples

### ✓ GET /api/leads (Success)
```
REQUEST:
  GET /api/leads
  Cookie: session_token=eyJhbGc...

SESSION VALIDATION:
  ✓ Token present
  ✓ JWT signature valid
  ✓ Token in database
  ✓ Not expired
  ✓ User active
  → companyId extracted: "cmp_abc123"

HANDLER EXECUTES:
  leads = await tenantScope("cmp_abc123").lead.findMany()

RESPONSE:
  200 OK
  {
    "leads": [
      { "id": "lead_1", "firstName": "John", "companyId": "cmp_abc123" },
      { "id": "lead_2", "firstName": "Jane", "companyId": "cmp_abc123" }
    ]
  }
```

### ❌ Unauthorized (No Cookie)
```
REQUEST:
  GET /api/leads
  [No Cookie]

SESSION VALIDATION:
  ✗ Token not found

RESPONSE:
  401 Unauthorized
  { "error": "Unauthorized: No session token provided" }
```

### ❌ Tampered JWT
```
REQUEST:
  GET /api/leads
  Cookie: session_token=eyJhbGc...TAMPERED

SESSION VALIDATION:
  ✓ Token present
  ✗ JWT signature verification FAILED

RESPONSE:
  401 Unauthorized
  { "error": "Unauthorized: Invalid or malformed token" }
```

### ❌ CompanyId Mismatch (Attack Detected)
```
REQUEST:
  GET /api/leads
  Cookie: session_token=eyJhbGc...[for cmp_xyz]

SESSION VALIDATION:
  ✓ Token present
  ✓ JWT signature valid
  ✓ Token in database
  ✗ Database session.companyId (cmp_abc123) != JWT.companyId (cmp_xyz)

RESPONSE:
  401 Unauthorized
  { "error": "Unauthorized: Company ID mismatch" }
  [SECURITY ALERT LOGGED]
```

---

## Database Queries: Before & After

### Find User by Username
```typescript
// ❌ BEFORE: Wrong - doesn't use composite key
const user = await prisma.user.findUnique({
  where: { username: 'john' }
});

// ✓ AFTER: Right - uses composite key
const user = await findUserByUsernameInCompany('john', companyId);
// Actually: prisma.user.findUnique({
//   where: { username_companyId: { username: 'john', companyId } }
// });
```

### Find & Delete Lead
```typescript
// ❌ BEFORE: Vulnerable - no companyId check
const lead = await prisma.lead.findUnique({
  where: { id: 'lead_123' }
});
await prisma.lead.delete({
  where: { id: 'lead_123' }
});

// ✓ AFTER: Secure - verified with companyId
const lead = await tenantScope(companyId).lead.findUnique({
  where: { id: 'lead_123' }
});
if (!lead) throw new Error('Not found');
await tenantScope(companyId).lead.delete({
  where: { id: 'lead_123' }
});
```

### List Items with Filters
```typescript
// ❌ BEFORE: Vulnerable - missing where clause
const leads = await prisma.lead.findMany({
  where: { status: 'NEW' }
});

// ✓ AFTER: Secure - tenantScope adds companyId
const leads = await tenantScope(companyId).lead.findMany({
  where: { status: 'NEW' }
});
```

---

## Testing Checklist

- [ ] Create user A in company A
- [ ] Create user B in company B
- [ ] User A logs in
- [ ] User A creates Lead X
- [ ] User B logs in
- [ ] Try to fetch Lead X as User B
  - **Expected:** 404 (not found)
  - **Actual:** ???
  - **If 200:** 🚨 BUG - tenant isolation broken!

---

## Error Messages & What They Mean

| Error | Meaning | Action |
|-------|---------|--------|
| `401 No session token provided` | Not logged in | User clicks login |
| `401 Invalid or malformed token` | JWT tampered or corrupted | Log in again |
| `401 Session not found` | Session deleted from database | Log in again |
| `401 Session invalidated` | Admin/logout invalidated it | Log in again |
| `401 Session expired` | 7 days have passed | Log in again |
| `401 User ID mismatch` | Database corruption or attack | SECURITY ALERT |
| `401 Company ID mismatch` | Trying to use another company | SECURITY ALERT |
| `401 User is inactive` | Admin deactivated account | Contact admin |
| `403 Insufficient permissions` | Needs higher role | Contact admin |
| `404 Not found` | Entity doesn't exist OR belongs to another company | Don't reveal which |
| `405 Method not allowed` | Using wrong HTTP method | Use correct method |

---

## Environment Variables

```bash
# Required in .env.local
JWT_SECRET=your-secret-here

# Auto-set by Next.js
NODE_ENV=production  # Controls secure cookie flag
```

Generate JWT_SECRET:
```bash
openssl rand -base64 32
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `lib/auth.ts` | JWT generation, verification, session management |
| `lib/secureHandler.ts` | API route wrapper |
| `lib/tenantScope.ts` | Query scoping helper |
| `lib/userLookup.ts` | Secure user lookup functions |
| `MULTI_TENANT_ISOLATION_GUIDE.md` | Detailed security guide |
| `EXAMPLE_SECURE_API_ROUTE.ts` | Full working example |
| `IMPLEMENTATION_SUMMARY.md` | What was implemented |

---

## Key Functions Quick Reference

### In secureHandler
```typescript
export const GET = secureHandler(
  async (req, { userId, role, companyId, sessionId }) => {
    // Your code here
    return NextResponse.json({...});
  },
  { requiredRoles: ['ADMIN'] }
);
```

### In server actions
```typescript
const session = await getValidatedSession();
// Returns: { userId, role, companyId, sessionId }
// Throws: Error if validation fails
```

### In server actions (lenient)
```typescript
const session = await getSession();
// Returns: { userId, role, companyId, sessionId } | null
// Doesn't throw
```

### Query scoping
```typescript
await tenantScope(companyId).lead.findMany({...});
await tenantScope(companyId).lead.create({...});
await tenantScope(companyId).lead.update({...});
await tenantScope(companyId).lead.delete({...});
```

---

## One-Line Summary

**Every request → secureHandler validates session → tenantScope scopes queries → companyId enforced at every level = no data leakage**
