# Multi-Tenant Isolation Security Implementation

## Overview

This document describes the runtime multi-tenant isolation enforcement for the HPX Eigen CRM SaaS application. The system ensures strict tenant data separation at runtime through JWT validation, session verification, and query scoping.

---

## Architecture

### 1. JWT (JSON Web Token) Structure

**Token Format (HS256):**
```json
{
  "userId": "user_cuid",
  "role": "ADMIN|SALES_MANAGER|SALES_EXECUTIVE|PROCESS_MANAGER|PROCESS_EXECUTIVE",
  "companyId": "company_cuid",
  "iat": 1234567890,
  "exp": 1234567890
}
```

**Key Points:**
- Signed with `JWT_SECRET` (HS256)
- 7-day expiration
- **companyId is embedded in token** - this is critical for tenant isolation
- No server-side token list needed (stateless JWT design)

### 2. Session Verification Flow

```
REST Request
    ↓
[Extract JWT from cookie]
    ↓
[Verify JWT signature with secret]
    ↓
[Extract: userId, role, companyId from JWT]
    ↓
[Lookup session in database by token]
    ↓
[Verify session.userId = JWT.userId]
[Verify session.companyId = JWT.companyId]
[Verify session.isValid = true]
[Verify session.expiresAt > now]
[Verify user.isActive = true]
[Verify user.companyId = JWT.companyId]
    ↓
✓ Session Valid - Grant Access
✗ Any check fails - Reject (401/403)
```

### 3. Query Scoping

**ALL** database queries MUST include `companyId` in the WHERE clause.

**Never do this:**
```typescript
const lead = await prisma.lead.findUnique({
  where: { id: 'lead-123' }
})
// ❌ CRITICAL BUG: Can see another company's lead
```

**Always do this:**
```typescript
const lead = await prisma.lead.findUnique({
  where: { id: 'lead-123', companyId }
})
// ✓ SECURE: Can only see company's own lead
```

**Use the tenantScope helper:**
```typescript
const lead = await tenantScope(companyId).lead.findUnique({
  where: { id: 'lead-123' }
})
// ✓ SECURE: companyId automatically added
```

---

## Implementation Components

### 1. Updated /lib/auth.ts Functions

#### generateSessionToken(userId, role, companyId)
- Generates JWT with userId, role, and **companyId**
- Must be called with user's companyId from database
- **Vulnerability if companyId is guessed or forged externally**

#### verifySessionToken(token)
- Verifies JWT signature using HS256
- Returns `{ userId, role, companyId }` if valid
- Returns `null` if signature invalid or malformed

#### createSession(userId, role, companyId, userAgent?, ipAddress?)
- Generates JWT with companyId
- Stores session record in database with:
  - `token` (unique)
  - `userId`
  - **`companyId`** (enforced)
  - `isValid = true`
  - `expiresAt = now + 7 days`
  - `userAgent` (optional, for security audit)
  - `ipAddress` (optional, for security audit)
- Sets HTTP-only cookie

#### getValidatedSession()
- **STRICT SECURITY FUNCTION** - Use for API routes
- Performs 7-step verification:
  1. Extract token from cookie
  2. Verify JWT signature
  3. Extract and validate companyId from JWT
  4. Lookup session in database
  5. Verify session.userId = JWT.userId
  6. Verify session.companyId = JWT.companyId
  7. Verify user is active and belongs to company
- **Throws Error** if any check fails
- **Does NOT return null** - use try/catch
- Returns `{ userId, role, companyId, sessionId }`

### 2. secureHandler Wrapper (/lib/secureHandler.ts)

**Purpose:** Automatically enforce session validation on all API routes

**Usage:**
```typescript
export const GET = secureHandler(
  async (req, { userId, role, companyId }) => {
    // companyId is guaranteed valid
    // Never trust companyId from request body
    const data = await tenantScope(companyId).lead.findMany({...});
    return NextResponse.json({ data });
  },
  { requiredRoles: ['ADMIN', 'SALES_MANAGER'] }
);
```

**Behavior:**
- ✓ Validates session automatically
- ✓ Returns 401 if unauthorized
- ✓ Returns 403 if missing required role
- ✓ Returns 405 if HTTP method not allowed
- ✓ Injects `{ userId, role, companyId, sessionId }` to handler
- ✓ Catches errors and returns 500

**Never do this:**
```typescript
// ❌ WRONG: Manual session handling + no tenantScope
const session = await getSession();
const companyId = req.body.companyId; // SECURITY HOLE!
```

### 3. tenantScope Helper (/lib/tenantScope.ts)

**Purpose:** Automatically scope all Prisma queries to a company

**Usage:**
```typescript
// List all leads in company
const leads = await tenantScope(companyId).lead.findMany({
  where: { status: 'NEW_LEAD' }
});

// Create a new lead (companyId enforced)
const lead = await tenantScope(companyId).lead.create({
  data: { firstName: 'John', lastName: 'Doe' }
});

// Update a lead
const updated = await tenantScope(companyId).lead.update({
  where: { id: 'lead-123' },
  data: { status: 'QUALIFIED' }
});

// Delete a lead
await tenantScope(companyId).lead.delete({
  where: { id: 'lead-123' }
});
```

**Supported Models:**
- user, session, lead, auditLog, savedView, rolePreset
- emailAccount, emailThread, emailMessage, emailAttachment
- emailWebhookState, emailSendAudit, emailThreadLead
- syncQueue, emailQueue, conflictLog, syncCheckpoint

**How it Works:**
- Automatically adds `companyId` to WHERE clauses
- Automatically adds `companyId` to CREATE data
- Prevents accidental data leakage
- Single source of truth for tenant isolation

---

## Security Guarantees

### ✓ What This Implementation Protects Against

1. **JWT Forgery/Tampering**
   - HS256 signature verification prevents attacker from forging tokens
   - Any token modification will fail verification

2. **Token Reuse Across Companies**
   - Session database verification ensures token belongs to user
   - companyId is verified in both JWT AND database
   - User.companyId is verified against session.companyId

3. **Privilege Escalation**
   - Role is verified from JWT (signed)
   - secureHandler enforces requiredRoles
   - User record verified to match session

4. **Account Takeover via Session Theft**
   - Session stored in database with isValid flag
   - Admin can invalidate specific sessions
   - IP/User-Agent logged for forensics

5. **SQL Injection via companyId**
   - tenantScope uses parameterized queries
   - Prisma handles escaping automatically

6. **Cross-Tenant Data Access**
   - ALL queries include companyId filter
   - findUnique includes composite key verification
   - Even if attacker guesses another company's ID, they can't access it

### ⚠️ What This Implementation Does NOT Protect Against

1. **Weak Passwords**
   - Use password strength validation (implemented: min 8 chars, upper, lower, number, special char)

2. **Phishing / Credential Compromise**
   - User must protect their credentials
   - Enable optional: 2FA, IP whitelisting, suspicious activity alerts

3. **XSS on Frontend**
   - Session token is HTTP-only (can't be stolen via JS)
   - But page could still be defaced
   - Implement: CSP headers, input validation, output encoding

4. **Server Compromise**
   - If JWT_SECRET is leaked, all tokens are compromised
   - Rotate JWT_SECRET in emergency
   - Use environment variables, never hardcode

5. **Network Interception (HTTP)**
   - Always use HTTPS in production
   - Cookie has `secure: true` flag in production

---

## Migration Guide: Converting Existing Code

### Before (Insecure)

```typescript
// ❌ WRONG: No JWT verification, no companyId
export async function GET(req: NextRequest) {
  const data = await prisma.lead.findMany({
    where: { assignedTo: userId }
  });
  return NextResponse.json(data);
}
```

### After (Secure)

```typescript
// ✓ CORRECT: secureHandler + tenantScope
export const GET = secureHandler(
  async (req, { userId, companyId }) => {
    const data = await tenantScope(companyId).lead.findMany({
      where: { assignedToId: userId }
    });
    return NextResponse.json(data);
  }
);
```

### Checklist for Each API Route

- [ ] Wrap with `secureHandler`
- [ ] Use `tenantScope(companyId)` for ALL queries
- [ ] Never use companyId from request body
- [ ] Verify referenced entities exist in the company
- [ ] Check requiredRoles if needed
- [ ] Log actions to auditLog with companyId
- [ ] Return 404 if entity doesn't belong to company (don't reveal existence)

---

## Best Practices

### 1. Never Trust User Input for companyId

```typescript
// ❌ WRONG
const companyId = req.body.companyId;

// ❌ ALSO WRONG
const companyId = req.headers['x-company-id'];

// ✓ CORRECT
const { companyId } = await getValidatedSession();
```

### 2. Always Verify Entity Ownership

```typescript
// Before updating a lead, verify it belongs to the company
const lead = await tenantScope(companyId).lead.findUnique({
  where: { id: leadId }
});

if (!lead) {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// Now it's safe to update
```

### 3. Use Composite Keys Where Applicable

Prisma schema has:
```prisma
@@unique([companyId, username])
@@unique([companyId, email])
```

So user lookups should be:
```typescript
// ❌ WRONG
const user = await prisma.user.findUnique({
  where: { username: 'john' }
});

// ✓ CORRECT
const user = await prisma.user.findUnique({
  where: { username_companyId: { username: 'john', companyId } }
});
```

### 4. Log Security-Relevant Actions

```typescript
await tenantScope(companyId).auditLog.create({
  data: {
    actionType: 'LEAD_CREATED',
    entityId: leadId,
    performedById: userId,
    description: 'Lead created',
    // companyId automatically added
  }
});
```

### 5. Test Your Isolation

```typescript
// Test: User A should NOT see User B's data
// 1. Create company A and user A
// 2. Create company B and user B
// 3. User A logs in, creates Lead X in company A
// 4. User B logs in, tries to access Lead X
// Expected: 404 (not found)
// ❌ Actual: 200 (data leaked) → BUG!
```

---

## Session Lifecycle

### Creation (Login)
```
User submits login
  └─> getSession() not found
  └─> Verify password
  └─> createSession(userId, role, companyId)
      ├─> generateSessionToken(userId, role, companyId)
      ├─> save to database (prisma.session.create)
      └─> set HTTP-only cookie
```

### Usage (API Request)
```
Request received
  └─> secureHandler
      └─> getValidatedSession()
          ├─> Extract token from cookie
          ├─> Verify JWT signature
          ├─> Lookup session in database
          ├─> Verify all claims
          └─> Return validated context
      └─> Call handler with { userId, role, companyId }
```

### Refresh (Activity Update)
```
Every request
  └─> getValidatedSession()
      └─> Update session.lastActivityAt = now
      └─> (Optional: Refresh token if expiring soon)
```

### Invalidation (Logout)
```
User clicks logout
  └─> invalidateSession()
      ├─> Update session.isValid = false
      └─> Delete cookie
  └─> Next request
      └─> getValidatedSession()
          └─> session.isValid check fails
          └─> Return 401
```

### Expiration (Time-based)
```
7 days after creation
  └─> Session automatically expires
  └─> getValidatedSession() checks expiresAt
  └─> Returns 401 (expired)
  └─> User must log in again
```

---

## Environment Variables

Required in `.env.local`:
```bash
JWT_SECRET=your-very-secure-random-secret-min-32-chars-long
NODE_ENV=production  # Controls secure cookie flag
```

**Security Notes:**
- Generate JWT_SECRET with: `openssl rand -base64 32`
- Never commit to git
- Rotate after suspected compromise
- Same value must be used to decrypt old tokens

---

## Monitoring & Alerts

Implement monitoring for:

1. **Unauthorized Access Attempts**
   ```
   Alert on: 401 errors > 10/hour per user
   ```

2. **Cross-Tenant Access Attempts**
   ```
   Alert on: "Company ID mismatch" errors
   Alert on: "User does not belong to this company" errors
   ```

3. **Session Tampering**
   ```
   Alert on: "User ID mismatch" errors
   Alert on: "Invalid or malformed token" errors
   ```

4. **Rapid Session Rotation**
   ```
   Alert on: Multiple session creations from different IPs < 1 hour
   ```

---

## Testing Checklist

- [ ] Unit test: generateSessionToken includes companyId
- [ ] Unit test: verifySessionToken extracts companyId
- [ ] Unit test: getValidatedSession throws on mismatch
- [ ] Integration test: User A cannot see User B's lead
- [ ] Integration test: JW signature tampering is rejected
- [ ] Integration test: Expired tokens are rejected
- [ ] Integration test: tenantScope prevents data leakage
- [ ] Load test: secureHandler doesn't create bottlenecks
- [ ] Security test: Request body companyId is ignored

---

## Troubleshooting

### Error: "Unauthorized: No session token provided"
- Cookie not being sent (check httpOnly, sameSite, secure flags)
- User not logged in
- Session expired

### Error: "Unauthorized: Company ID mismatch"
- Session in database has different companyId than JWT
- Possible token reuse attack OR database corruption
- Check audit logs

### Error: "User does not belong to this company"
- User was deleted or moved to different company
- Try logging in again

### Get 404 instead of 401 when accessing wrong company's data
- ✓ CORRECT BEHAVIOR - Don't reveal that entity exists
- Attacker doesn't know if they guessed wrong ID or if owner doesn't have access

---

## References

- Prisma: https://www.prisma.io/docs/orm/reference/prisma-client-reference
- JWT Best Practices: https://tools.ietf.org/html/rfc8949
- OWASP: https://owasp.org/www-project-web-security-testing-guide/
