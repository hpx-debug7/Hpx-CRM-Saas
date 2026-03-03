# 🔧 Security Audit Fixes - Implementation Guide

**Critical Issues to Fix: 3**
**High Priority Issues: 4**
**Estimated Time: 2-4 hours**

---

## CRITICAL FIX #1: Remove JWT_SECRET Insecure Fallback

**File:** `lib/auth.ts`
**Lines:** 13
**Risk:** Allows forging tokens with hardcoded secret

### Current Code (VULNERABLE)
```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production';
```

### Fixed Code
```typescript
// At module level, immediately throw if not configured
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.trim() === '') {
    throw new Error(
        'FATAL: JWT_SECRET environment variable is not set. ' +
        'This is required for session security. ' +
        'Generate with: openssl rand -base64 32'
    );
}
```

### Testing
```typescript
// Before deploying, verify:
// 1. Remove JWT_SECRET from .env.local
// 2. Start app
// 3. Should immediately crash with error message
// 4. Add JWT_SECRET back
// 5. App should work normally
```

### Deployment Notes
- Must set `JWT_SECRET` in all environments (dev, staging, prod)
- Generate unique secret per environment: `openssl rand -base64 32`
- Never commit to git
- Rotate after suspected compromise

**Time to Fix: 5 minutes**

---

## CRITICAL FIX #2: Implement Login Architecture

**File:** `app/actions/auth.ts`
**Lines:** 40-115 (loginAction function)
**Risk:** Login fails due to broken composite key lookup

### Problem Analysis

Current code tries:
```typescript
const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
});
```

But Prisma schema requires:
```prisma
@@unique([companyId, username])
@@unique([companyId, email])
```

Result: Query fails or returns wrong user.

### Solution Options

You must choose ONE approach:

---

#### OPTION A: Email-Based Login (RECOMMENDED)

**Best for:** SaaS where email is more unique than username

**Implementation:**

```typescript
export async function loginAction(email: string, password: string): Promise<AuthResult> {
    try {
        const headersList = await headers();
        const userAgent = headersList.get('user-agent') || undefined;
        const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || undefined;

        // ✅ Find user by email (globally unique)
        const user = await prisma.user.findFirstOrThrow({
            where: {
                email: email.toLowerCase(),
                isActive: true,
            },
            include: { company: true },
        }).catch(() => null);

        if (!user) {
            await addServerAuditLog({
                actionType: 'USER_LOGIN_FAILED',
                entityType: 'user',
                description: `Failed login attempt for email "${email}" - User not found`,
                ipAddress,
                userAgent,
                metadata: { reason: 'user_not_found', attemptedEmail: email },
            });
            return { success: false, message: 'Invalid email or password' };
        }

        // ... rest of checks (isActive, locked, etc) ...

        // ✅ Now we know the company!
        await createSession(user.id, user.role, user.companyId, userAgent, ipAddress);

        return {
            success: true,
            message: 'Login successful',
            user: {
                userId: user.id,
                username: user.username,
                name: user.name,
                email: user.email,
                role: user.role,
                // ...
            },
        };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, message: 'An error occurred during login' };
    }
}
```

**Frontend Changes:**
```html
<!-- Change login form from -->
<input name="username" placeholder="Username" />
<!-- to -->
<input name="email" type="email" placeholder="Email address" />
```

**Pros:**
- ✅ Simple (email is globally unique)
- ✅ Matches modern SaaS UX
- ✅ Easier password reset flow
- ✅ No additional form fields needed

**Cons:**
- ❌ Can't have multiple accounts per email

---

#### OPTION B: Company Selector

**Best for:** Complex businesses with multiple subsidiaries per email

**Implementation:**

```typescript
export async function loginAction(
    username: string,
    password: string,
    companyId: string  // NEW: from form
): Promise<AuthResult> {
    try {
        const headersList = await headers();
        const userAgent = headersList.get('user-agent') || undefined;
        const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || undefined;

        // ✅ Validate companyId
        const company = await prisma.company.findUnique({
            where: { id: companyId },
        });

        if (!company || !company.isActive) {
            return { success: false, message: 'Company not found or inactive' };
        }

        // ✅ Look up user by composite key: (username, companyId)
        const user = await prisma.user.findUnique({
            where: {
                username_companyId: {
                    username: username.toLowerCase(),
                    companyId: companyId,
                },
            },
        });

        if (!user) {
            await addServerAuditLog({
                actionType: 'USER_LOGIN_FAILED',
                entityType: 'user',
                description: `Failed login for user "${username}" in company "${company.name}"`,
                ipAddress,
                userAgent,
                metadata: { reason: 'user_not_found', companyId },
            });
            return { success: false, message: 'Invalid username or password' };
        }

        // ... rest of login flow ...

        await createSession(user.id, user.role, user.companyId, userAgent, ipAddress);

        return { success: true, ... };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, message: 'An error occurred during login' };
    }
}
```

**Frontend Changes:**
```html
<!-- Add company selector -->
<select name="companyId" required>
    <option value="">Select your company...</option>
    <option value="cmp_abc123">Acme Corp</option>
    <option value="cmp_xyz789">TechCorp Inc</option>
</select>

<input name="username" placeholder="Username" />
<input name="password" type="password" placeholder="Password" />
```

**Pros:**
- ✅ Allows multiple accounts per email
- ✅ Transparent company selection

**Cons:**
- ❌ Extra form field
- ❌ More confusing for users

---

#### OPTION C: Subdomain-Based

**Best for:** Multi-brand SaaS (different subdomains per company)

**Implementation:**

```typescript
// In middleware or at route level
function extractCompanyFromSubdomain(host: string): string | null {
    const subdomain = host.split('.')[0];
    // company1.example.com → company1
    // acme.crm.example.com → acme

    if (!subdomain || subdomain === 'www') return null;
    return subdomain;
}

export async function loginAction(username: string, password: string): Promise<AuthResult> {
    try {
        const headersList = await headers();
        const host = headersList.get('host') || '';
        const userAgent = headersList.get('user-agent') || undefined;
        const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || undefined;

        // ✅ Extract company from subdomain
        const companySlug = extractCompanyFromSubdomain(host);
        if (!companySlug) {
            return { success: false, message: 'Invalid access URL' };
        }

        // ✅ Look up company by slug
        const company = await prisma.company.findUnique({
            where: { slug: companySlug },
        });

        if (!company || !company.isActive) {
            return { success: false, message: 'Company not found' };
        }

        // ✅ Look up user in this company
        const user = await prisma.user.findUnique({
            where: {
                username_companyId: {
                    username: username.toLowerCase(),
                    companyId: company.id,
                },
            },
        });

        if (!user) {
            return { success: false, message: 'Invalid username or password' };
        }

        // ... rest of login ...

        await createSession(user.id, user.role, company.id, userAgent, ipAddress);

        return { success: true, ... };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, message: 'An error occurred during login' };
    }
}
```

**Setup Required:**
```
DNS:
acme.crm.example.com → same IP
techcorp.crm.example.com → same IP

Next.js Middleware:
Rewrite both domains to same handler
```

**Pros:**
- ✅ Company selection is implicit
- ✅ No extra form fields
- ✅ Clear URL structure

**Cons:**
- ❌ Requires DNS/subdomain setup
- ❌ More complex infrastructure

---

### Decision Guide: Which Option?

| Factor | Email | Selector | Subdomain |
|--------|-------|----------|-----------|
| Implementation ease | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| User complexity | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Multi-account per email | ❌ | ✅ | ✅ |
| Infrastructure | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Security | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

**Recommendation:** Email-based (Option A) unless you have a specific reason for multi-account support.

**Time to Fix: 30-45 minutes**

---

## CRITICAL FIX #3: Add Role Verification to getValidatedSession

**File:** `lib/auth.ts`
**Lines:** 227-234
**Risk:** Privilege escalation if user's role changes between token issue and request

### Current Code (VULNERABLE)
```typescript
// STEP 7: Verify user is still active and belongs to correct company
if (!dbSession.user || !dbSession.user.isActive) {
    throw new Error('Unauthorized: User is inactive');
}

if (dbSession.user.companyId !== jwtCompanyId) {
    throw new Error('Unauthorized: User does not belong to this company');
}

// Missing: role verification!
// JWT has old role, DB has new role
// Could allow privilege escalation
```

### Fixed Code - Option 1: Strict (Recommended)

```typescript
// Get role from JWT
const { userId: jwtUserId, role: jwtRole, companyId: jwtCompanyId } = decoded;

// Validate session from database
const dbSession = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
});

if (!dbSession) {
    throw new Error('Unauthorized: Session not found in database');
}

if (!dbSession.isValid) {
    throw new Error('Unauthorized: Session has been invalidated');
}

if (dbSession.expiresAt < new Date()) {
    throw new Error('Unauthorized: Session has expired');
}

// CRITICAL: Verify JWT claims match database session
if (dbSession.userId !== jwtUserId) {
    throw new Error('Unauthorized: User ID mismatch');
}

if (dbSession.companyId !== jwtCompanyId) {
    throw new Error('Unauthorized: Company ID mismatch');
}

// ✅ NEW: Verify user role hasn't changed
if (dbSession.user.role !== jwtRole) {
    // Role was changed - user must log in again
    // This ensures privilege changes take effect immediately
    await invalidateSession();  // Kill the session
    throw new Error('Unauthorized: User role changed - please log in again');
}

// Verify user is still active and belongs to correct company
if (!dbSession.user || !dbSession.user.isActive) {
    throw new Error('Unauthorized: User is inactive');
}

if (dbSession.user.companyId !== jwtCompanyId) {
    throw new Error('Unauthorized: User does not belong to this company');
}
```

### Fixed Code - Option 2: Lenient (Alternative)

If you want role changes to take effect immediately WITHOUT invalidating session:

```typescript
// Don't compare to JWT role
// Just return current role from database

if (!dbSession.user || !dbSession.user.isActive) {
    throw new Error('Unauthorized: User is inactive');
}

if (dbSession.user.companyId !== jwtCompanyId) {
    throw new Error('Unauthorized: User does not belong to this company');
}

// Use DB role, not JWT role
// This allows privilege changes to take effect immediately
return {
    userId: dbSession.userId,
    role: dbSession.user.role,  // Current role from DB
    companyId: dbSession.companyId,
    sessionId: dbSession.id,
};
```

### Recommendation

**Use Option 1 (Strict)** unless you have a specific requirement for immediate role changes.

Rationale:
- Prevents privilege escalation window
- Forces users to re-authenticate after privilege changes
- More secure for high-sensitivity operations
- Standard practice in secure systems

### Testing for Privilege Escalation Attack

```typescript
describe('Privilege Escalation Prevention', () => {
    test('User role change invalidates existing session', async () => {
        // 1. Create user with role="USER"
        const user = await prisma.user.create({
            data: {
                companyId: company.id,
                username: 'john',
                role: 'USER'  // ✅ Regular user
            }
        });

        // 2. User logs in
        const loginResult = await loginAction('john', 'password123');
        const sessionToken = getCookieFromResponse(loginResult);

        // 3. Admin promotes user to ADMIN
        await prisma.user.update({
            where: { id: user.id },
            data: { role: 'ADMIN' }  // Role changed
        });

        // 4. Existing session tries to access endpoint
        const response = await fetch('/api/admin/sensitive', {
            headers: { Cookie: `session_token=${sessionToken}` }
        });

        // Expected: 401 (Unauthorized: User role changed)
        expect(response.status).toBe(401);
        // User MUST log in again with new ADMIN role

        // 5. User logs in again
        const newLoginResult = await loginAction('john', 'password123');
        const newSessionToken = getCookieFromResponse(newLoginResult);

        // 6. Now access succeeds with new ADMIN role
        const accessResponse = await fetch('/api/admin/sensitive', {
            headers: { Cookie: `session_token=${newSessionToken}` }
        });

        expect(accessResponse.status).toBe(200);  // ✅ Now authorized
    });
});
```

**Time to Fix: 15-20 minutes**

---

## HIGH PRIORITY FIX #4: Validate companyId in tenantScope

**File:** `lib/tenantScope.ts`
**Lines:** 172
**Risk:** Bypassed tenant scoping if companyId is undefined

### Current Code (WEAK)
```typescript
export function tenantScope(companyId: string) {
    return {
        user: createTenantScope('user', companyId),
        // ... no validation
    };
}
```

### Fixed Code
```typescript
export function tenantScope(companyId: string) {
    // Validate companyId immediately
    if (!companyId) {
        throw new Error(
            `Invalid companyId: received: ${companyId} (${typeof companyId}). ` +
            `Must be non-empty string.`
        );
    }

    if (typeof companyId !== 'string') {
        throw new Error(
            `Invalid companyId type: expected string, got ${typeof companyId}`
        );
    }

    if (companyId.trim() === '') {
        throw new Error('Invalid companyId: empty string is not allowed');
    }

    // Optional: validate CUID format (if using CUIDs)
    // CUIDs are 20-24 lowercase alphanumeric characters starting with 'c'
    // if (!/^[a-z0-9]{20,24}$/i.test(companyId)) {
    //     throw new Error(`Invalid companyId format: ${companyId}`);
    // }

    return {
        user: createTenantScope('user', companyId),
        session: createTenantScope('session', companyId),
        // ... rest
    };
}
```

### Testing
```typescript
describe('tenantScope validation', () => {
    test('throws on undefined companyId', () => {
        expect(() => {
            tenantScope(undefined as any);
        }).toThrow('Invalid companyId');
    });

    test('throws on null companyId', () => {
        expect(() => {
            tenantScope(null as any);
        }).toThrow('Invalid companyId');
    });

    test('throws on empty string', () => {
        expect(() => {
            tenantScope('');
        }).toThrow('Invalid companyId');
    });

    test('accepts valid companyId', () => {
        expect(() => {
            const scoped = tenantScope('valid-company-id');
            expect(scoped.user).toBeDefined();
        }).not.toThrow();
    });
});
```

**Time to Fix: 10 minutes**

---

## HIGH PRIORITY FIX #5: Validate Role Claim in verifySessionToken

**File:** `lib/auth.ts`
**Lines:** 77-89
**Risk:** Missing role claim not validated

### Current Code (WEAK)
```typescript
export async function verifySessionToken(token: string) {
    try {
        const secret = new TextEncoder().encode(JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);

        return {
            userId: payload.userId as string,
            role: payload.role as string,  // ← Could be undefined!
            companyId: payload.companyId as string,
        };
    } catch {
        return null;
    }
}
```

### Fixed Code
```typescript
export async function verifySessionToken(
    token: string
): Promise<{ userId: string; role: string; companyId: string } | null> {
    try {
        const secret = new TextEncoder().encode(JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);

        // Validate all required claims are present
        const userId = payload.userId;
        const role = payload.role;
        const companyId = payload.companyId;

        // Check presence and type
        if (!userId || typeof userId !== 'string') {
            return null;  // Invalid userId
        }

        if (!role || typeof role !== 'string') {
            return null;  // Invalid role ✅
        }

        if (!companyId || typeof companyId !== 'string') {
            return null;  // Invalid companyId
        }

        return {
            userId,
            role,
            companyId,
        };
    } catch {
        return null;
    }
}
```

**Time to Fix: 10 minutes**

---

## Summary of All Fixes

| Fix | File | Time | Priority |
|-----|------|------|----------|
| 1. Remove JWT_SECRET fallback | lib/auth.ts:13 | 5 min | 🔴 CRITICAL |
| 2. Implement login architecture | app/actions/auth.ts | 30-45 min | 🔴 CRITICAL |
| 3. Add role verification | lib/auth.ts:227-234 | 15-20 min | 🔴 CRITICAL |
| 4. Validate companyId | lib/tenantScope.ts:172 | 10 min | 🟡 HIGH |
| 5. Validate role claim | lib/auth.ts:77-89 | 10 min | 🟡 HIGH |
| 6. Document role strategy | lib/auth.ts | 5 min | 🟡 HIGH |
| 7. Add safeguard to upsert | lib/tenantScope.ts:124-136 | 10 min | 🟡 MEDIUM |

**Total Time: 1.5 - 2.5 hours**

---

## Verification Checklist

After implementing all fixes:

- [ ] App starts without JWT_SECRET error
- [ ] Login works with chosen architecture
- [ ] Session contains correct companyId
- [ ] getValidatedSession verifies role
- [ ] tenantScope validates companyId
- [ ] verifySessionToken validates role claim
- [ ] Cross-tenant access returns 404
- [ ] Role change invalidates session (if using Option 1)
- [ ] All tests pass
- [ ] No TypeScript errors

---

## Deployment Steps

1. **Implement all Priority 1 fixes**
2. **Test locally:**
   - Login works
   - Create session
   - Access protected route
   - Try cross-tenant access (fails)
3. **Run test suite:**
   - Unit tests for auth functions
   - Integration tests for routes
   - Privilege escalation tests
4. **Deploy to staging:**
   - Test end-to-end
   - Monitor logs
   - Verify no errors
5. **Code review:**
   - Security review
   - Role handling review
   - CommentReview
6. **Deploy to production:**
   - Set JWT_SECRET in production
   - Monitor for auth errors
   - Alert on unusual activity

---

**After all fixes are implemented, you'll have enterprise-grade multi-tenant isolation.**
