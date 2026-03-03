# 🔐 Security Audit: Multi-Tenant Isolation Implementation

**Audit Date:** 2026-03-02
**Auditor:** Senior SaaS Security Architect
**Status:** ⚠️ **CRITICAL ISSUES FOUND** - Not production-ready without fixes

---

## Executive Summary

The multi-tenant isolation implementation has **strong architecture and good defense-in-depth approach**, but contains **3 critical vulnerabilities** that must be fixed before production deployment. The issues are fixable but require immediate attention.

**Current Security Rating: 5/10**
- ✅ Good: Defense-in-depth approach, proper session validation flow
- ❌ Critical: Insecure JWT secret fallback, login broken, privilege escalation risk

**Post-Fix Rating (estimated): 8.5/10**
- Remaining gaps are architectural choices (2FA, rate limiting) rather than bugs

---

## 🔴 CRITICAL VULNERABILITIES

### 1. JWT_SECRET Insecure Fallback to Hardcoded Secret

**Location:** `lib/auth.ts:13`

**Code:**
```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production';
```

**Severity:** 🔴 **CRITICAL**

**Risk:**
- If `JWT_SECRET` environment variable is not set, the system falls back to a hardcoded, publicly known secret
- Attacker can create valid JWTs for ANY user in ANY company
- Silent failure - no warning that system is using insecure default
- All tokens become forgeable

**Attack Example:**
```typescript
// Attacker knows the hardcoded secret
const forgedToken = await new SignJWT({
  userId: 'target-user-id',
  role: 'ADMIN',
  companyId: 'target-company-id'
})
  .setProtectedHeader({ alg: 'HS256' })
  .setExpirationTime('7d')
  .sign(new TextEncoder().encode('your-jwt-secret-change-in-production'));

// Can now impersonate any user
```

**Recommendation:**
```typescript
const JWT_SECRET = process.env.JWT_SECRET;

// THROW error at startup if not configured
if (!JWT_SECRET || JWT_SECRET.trim() === '') {
  throw new Error(
    'FATAL: JWT_SECRET environment variable is not set. ' +
    'Generate with: openssl rand -base64 32'
  );
}
```

**Fix Priority:** 🔴 **FIX BEFORE DEPLOYMENT**

---

### 2. loginAction Uses Broken Composite Key Lookup

**Location:** `app/actions/auth.ts:47-48`

**Code:**
```typescript
const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
});
```

**Severity:** 🔴 **CRITICAL**

**Problem:**
Prisma schema has composite unique:
```prisma
@@unique([companyId, username])
@@unique([companyId, email])
```

This means:
- `username` alone is NOT a unique key
- Must use complete composite key: `username_companyId`
- Current query will either fail or return wrong user

**Database Behavior:**
```sql
-- This query will fail or return ambiguous results:
SELECT * FROM users WHERE username = 'john';
-- Multiple "john" users could exist in different companies!

-- Should be:
SELECT * FROM users WHERE username = 'john' AND companyId = 'company-123';
```

**Impact:**
- Login will fail or give wrong user
- System cannot determine which company user belongs to
- Breaks session creation with companyId

**Recommendation:**
Implement one of three architectures (as documented in `lib/userLookup.ts`):

**Option A: Email-based (Recommended)**
```typescript
export async function loginAction(email: string, password: string) {
  const user = await findUserByEmail(email.toLowerCase());
  if (!user) return { success: false, message: 'Invalid credentials' };

  // User's company is now known
  const isValid = await verifyPassword(password, user.password);
  if (!isValid) return { success: false, message: 'Invalid credentials' };

  await createSession(user.id, user.role, user.companyId, userAgent, ipAddress);
  return { success: true, user: {...} };
}
```

**Option B: Company Selector**
```typescript
export async function loginAction(
  username: string,
  password: string,
  companyId: string  // From form dropdown
) {
  const user = await findUserByUsernameInCompany(username, companyId);
  // ... rest of logic
}
```

**Option C: Subdomain-based**
```typescript
function extractCompanyFromSubdomain(req: NextRequest): string {
  const host = req.headers.get('host') || '';
  const subdomain = host.split('.')[0];
  // company1.example.com → company1
  return subdomain;
}
```

**Fix Priority:** 🔴 **FIX BEFORE DEPLOYMENT** (Blocking)

---

### 3. getValidatedSession Missing Role Verification Against Database

**Location:** `lib/auth.ts:184-247`

**Code:**
```typescript
export async function getValidatedSession() {
    // Verifies userId and companyId...
    if (dbSession.userId !== jwtUserId) { /* error */ }
    if (dbSession.companyId !== jwtCompanyId) { /* error */ }

    // BUT missing: role verification!

    return {
        userId: dbSession.userId,
        role: dbSession.user.role,  // Using DB role
        companyId: dbSession.companyId,
        sessionId: dbSession.id,
    };
}
```

**Severity:** 🔴 **CRITICAL**

**Vulnerability:**
The function uses `dbSession.user.role` from the database, but doesn't verify it matches the JWT role. This creates a privilege escalation window:

1. User has role "SALES_EXECUTIVE" - JWT is issued with this role
2. Admin upgrades user to "ADMIN" role in database
3. Existing JWT still has old claim: `role: "SALES_EXECUTIVE"`
4. But getValidatedSession returns new role from DB: `role: "ADMIN"`
5. Handler checks session.role and sees "ADMIN" - grants access!

**Attack Timeline:**
```
T0: User A logs in → JWT with role="USER"
T1: Admin promotes User A to role="ADMIN" in database
T2: User A makes API request with old JWT
T3: getValidatedSession returns combined state:
    - JWT says: USER
    - DB says: ADMIN
    - Returns: ADMIN (from DB)
T4: secureHandler approves ADMIN access
T5: Privilege escalation ✓
```

**However, there's also misuse in getSession:**

```typescript
// In getSession() line 164
return {
    userId: session.userId,
    role: session.user.role,        // Uses DB role
    companyId: session.companyId,
    sessionId: session.id,
};
```

Same issue - uses DB role instead of JWT role.

**Recommendation:**

Choose ONE approach:

**Approach A: Use JWT Role (Stateless)**
```typescript
return {
    userId: dbSession.userId,
    role: dbSession.user.role,     // DB role
    companyId: dbSession.companyId,
};
// NO verification - accept role change
// Pro: Role changes take effect immediately
// Con: Window where JWT claims don't match user's current role
```

**Approach B: Verify Role Matches (Strict)**
```typescript
if (dbSession.user.role !== jwtRole) {
    throw new Error('Unauthorized: Role changed since token issued');
}

return {
    userId: dbSession.userId,
    role: jwtRole,  // Use JWT role
    companyId: dbSession.companyId,
};
// Pro: Prevents privilege escalation window
// Con: Users must log out and back in when role changes
```

**Approach C: Use JWT but Validate Permissions Per-Request**
```typescript
return {
    userId: dbSession.userId,
    role: jwtRole,  // Use JWT role
    companyId: dbSession.companyId,
};

// In secureHandler, dynamically check permissions:
const user = await prisma.user.findUnique({ where: { id: userId } });
if (!user.roles.includes(requiredRole)) {
    return 403 Forbidden;
}
```

**Recommended:** Option B (Validate role matches) for strict isolation

```typescript
if (dbSession.user.role !== jwtRole) {
    await invalidateSession();  // Kill the session
    throw new Error('Unauthorized: User role changed');
}
```

**Fix Priority:** 🔴 **FIX BEFORE DEPLOYMENT**

---

## 🟡 HIGH PRIORITY ISSUES

### 4. tenantScope Missing Input Validation

**Location:** `lib/tenantScope.ts:172-192`

**Code:**
```typescript
export function tenantScope(companyId: string) {
    return {
        user: createTenantScope('user', companyId),
        // ... no validation that companyId is valid
    };
}
```

**Issue:**
No validation that `companyId` is a valid, non-empty string. If accidentally passed `undefined` or `null`:

```typescript
tenantScope(undefined).lead.findMany({...});
// where: { ...args.where, companyId: undefined }
// Silently includes undefined in query
// May bypass tenant scoping or cause Prisma errors
```

**Recommendation:**
```typescript
export function tenantScope(companyId: string) {
    // Validate immediately
    if (!companyId || typeof companyId !== 'string' || companyId.trim() === '') {
        throw new Error(
            `Invalid companyId: must be non-empty string. Got: ${companyId}`
        );
    }

    // Optional: validate format (CUID or UUID)
    // if (!/^[a-z0-9]{20,}$/i.test(companyId)) {
    //     throw new Error('Invalid companyId format');
    // }

    return {
        user: createTenantScope('user', companyId),
        // ...
    };
}
```

**Fix Priority:** 🟡 **HIGH - Add validation**

---

### 5. verifySessionToken Missing Role Validation

**Location:** `lib/auth.ts:77-89`

**Code:**
```typescript
export async function verifySessionToken(token: string) {
    try {
        const secret = new TextEncoder().encode(JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);

        return {
            userId: payload.userId as string,
            role: payload.role as string,
            companyId: payload.companyId as string,
        };
    } catch {
        return null;
    }
}
```

**Issue:**
Doesn't validate that `role` claim exists. If JWT is missing role:

```json
// Attacker creates JWT without role:
{ "userId": "...", "companyId": "..." }

// Function returns:
{ userId: "...", role: undefined, companyId: "..." }

// Undefined role might bypass role checks
```

**Recommendation:**
```typescript
export async function verifySessionToken(token: string): Promise<...> {
    try {
        const secret = new TextEncoder().encode(JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);

        // Validate all required claims present
        if (!payload.userId || typeof payload.userId !== 'string') {
            return null;
        }
        if (!payload.role || typeof payload.role !== 'string') {
            return null;
        }
        if (!payload.companyId || typeof payload.companyId !== 'string') {
            return null;
        }

        return {
            userId: payload.userId,
            role: payload.role,
            companyId: payload.companyId,
        };
    } catch {
        return null;
    }
}
```

**Fix Priority:** 🟡 **HIGH - Add validation**

---

### 6. Inconsistent Role Handling Between getSession and getValidatedSession

**Location:**
- `lib/auth.ts:164` (getSession uses DB role)
- `lib/auth.ts:244` (getValidatedSession uses JWT role)

**Code Comparison:**

getSession():
```typescript
// Line 157-167
return {
    userId: session.userId,
    role: session.user.role,      // ← FROM DATABASE
    companyId: session.companyId,
    sessionId: session.id,
};
```

getValidatedSession():
```typescript
// Line 242-247
return {
    userId: dbSession.userId,
    role: dbSession.user.role,    // ← FROM DATABASE (but should verify JWT)
    companyId: dbSession.companyId,
    sessionId: dbSession.id,
};
```

**Issue:**
Both use DB role, but getValidatedSession claims to verify it against JWT role (line 178) - but doesn't actually verify! Comment is misleading.

**Recommendation:**
Either:
1. Both use DB role + add verification as per Issue #3
2. Both use JWT role (remove DB role dependency)
3. Add explicit comment explaining why DB role is trusted over JWT role

**Fix Priority:** 🟡 **MEDIUM - Add clarity**

---

### 7. tenantScope.upsert Doesn't Enforce companyId on Update

**Location:** `lib/tenantScope.ts:124-136`

**Code:**
```typescript
upsert: (args: any) => {
    return baseModel.upsert({
        ...args,
        where: {
            ...args.where,
            companyId,  // ← Set on where
        },
        create: {
            ...args.create,
            companyId,  // ← Set on create
        },
        update: args.update,  // ← NOT setting companyId here
    });
},
```

**Issue:**
If record exists and update is executed, `companyId` is not enforced. However, the `where` clause already includes `companyId`, so it's partially mitigated.

**Low Risk** because:
- Can only update records matched by `where {id, companyId}`
- Can't accidentally update records from other companies

**Still, inconsistent.** Could be problematic if someone later allows updating companyId:

```typescript
const updated = await tenantScope(companyId).lead.upsert({
    where: { id: 'lead-123' },
    create: { ... },
    update: { companyId: 'OTHER-COMPANY-ID' }  // This would work!
});
```

**Recommendation:**
```typescript
upsert: (args: any) => {
    return baseModel.upsert({
        ...args,
        where: {
            ...args.where,
            companyId,
        },
        create: {
            ...args.create,
            companyId,
        },
        update: {
            ...args.update,
            // Note: Explicitly prevent companyId changes
            companyId: baseModel.fields.companyId  // Can't change after creation
        },
    });
},
```

Or simpler:
```typescript
update: {
    ...args.update,
    // Strip companyId if user tries to pass it
    // (Dangerous - should never allow changing tenant)
}
```

**Fix Priority:** 🟡 **MEDIUM - Add safeguard**

---

## 🟢 MEDIUM PRIORITY ISSUES

### 8. Race Condition in Session Activity Updates

**Location:** `lib/auth.ts:147-160`

**Code:**
```typescript
const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
});

if (!session || !session.isValid || session.expiresAt < new Date()) {
    return null;
}

// RACE: Session could be invalidated here by another request
await prisma.session.update({
    where: { id: session.id },
    data: { lastActivityAt: new Date() },
});
```

**Race Condition:**
1. Request A fetches session → valid
2. Request B invalidates session via logout
3. Request A updates lastActivityAt on now-invalid session
4. Result: Invalid session has recent activity timestamp

**Impact:**
- Low risk - only affects audit field `lastActivityAt`
- Could cause confusion in activity logs
- Won't cause security breach

**Mitigation:**
Either ignore (acceptable) or use:
```typescript
await prisma.session.updateMany({
    where: {
        id: session.id,
        isValid: true  // Only update if still valid
    },
    data: { lastActivityAt: new Date() },
});
```

**Fix Priority:** 🟢 **LOW - Nice to have**

---

### 9. getValidatedSession Could Clone Session/Role Check

**Location:** `lib/auth.ts:218-225`

**Code:**
```typescript
// Verify userId match
if (dbSession.userId !== jwtUserId) {
    throw new Error('Unauthorized: User ID mismatch');
}

// Verify companyId match
if (dbSession.companyId !== jwtCompanyId) {
    throw new Error('Unauthorized: Company ID mismatch');
}
```

**Minor Issue:**
Theoretically, if someone has session token in database but the JWT payload was modified locally (not against verified signature), this could catch it. But:

1. JWT is already verified on line 193
2. These checks are defensive depth, which is good
3. No actual vulnerability here

**Assessment:** ✅ **This is actually good security practice** (defense-in-depth)

**Fix Priority:** 🟢 **NO ACTION NEEDED**

---

## 💚 SECURITY STRENGTHS

### ✅ Good Implementation Practices

1. **Proper JWT Signature Verification**
   - Uses `jwtVerify` from jose library with HS256
   - Signature verified before any claim extraction
   - ✅ Correct approach

2. **Session Database Validation**
   - Checks session exists, is valid, not expired
   - Adds accountability - sessions can be revoked
   - ✅ Prevents stolen token abuse

3. **Defense-in-Depth Approach**
   - Multiple layers: JWT signature, session DB, claims validation, user active check
   - Each layer can fail independently
   - ✅ Strong architecture

4. **secureHandler Wrapper**
   - Automatic enforcement across all routes
   - Consistent error handling
   - Role-based access control built-in
   - ✅ Good security by default

5. **tenantScope Query Helper**
   - Automatic companyId injection
   - Prevents accidental data leakage
   - Covers all CRUD operations
   - ✅ Strong defense at query level

6. **HTTP-Only Cookies**
   - Token stored in HTTP-only cookie
   - Protects against XSS token theft
   - Proper sameSite=lax configuration
   - ✅ Correct implementation

7. **Composite Key Awareness**
   - Documentation acknowledges composite unique constraints
   - Provides helper functions for proper lookups
   - ✅ Good documentation

8. **Session Revocation**
   - Sessions in database can be marked invalid
   - Logout immediately invalidates token
   - ✅ Prevents token reuse after logout

---

## 📋 Vulnerability Matrix

| Issue | Severity | Type | Fixable | Blocking |
|-------|----------|------|---------|----------|
| JWT_SECRET fallback | 🔴 CRITICAL | Configuration | Yes | Yes |
| loginAction composite key | 🔴 CRITICAL | Arch | Yes | Yes |
| Role verification missing | 🔴 CRITICAL | Logic | Yes | Yes |
| tenantScope validation | 🟡 HIGH | Input | Yes | No |
| verifySessionToken validation | 🟡 HIGH | Logic | Yes | No |
| Role inconsistency | 🟡 MEDIUM | Design | Yes | No |
| upsert safeguard | 🟡 MEDIUM | Edge case | Yes | No |
| Activity race condition | 🟢 LOW | Timing | Yes | No |

---

## 🔧 Fix Checklist

### Priority 1: Blocking Issues (Must fix before deployment)

- [ ] **Remove JWT_SECRET fallback**
  - Throw error if not set
  - Lines: lib/auth.ts:13

- [ ] **Implement login architecture**
  - Choose email-based, company selector, or subdomain-based
  - Update: app/actions/auth.ts:40-49
  - Reference: lib/userLookup.ts

- [ ] **Add role verification to getValidatedSession**
  - Verify JWT role matches DB user role
  - Throw error if mismatch
  - Lines: lib/auth.ts:227-234 (expand)

### Priority 2: Security Hardening (Should fix before production)

- [ ] **Add input validation to tenantScope**
  - Validate companyId is non-empty string
  - Lines: lib/tenantScope.ts:172

- [ ] **Add role claim validation to verifySessionToken**
  - Validate role exists and is string
  - Lines: lib/auth.ts:77-89

- [ ] **Document role strategy**
  - Explain choice of JWT role vs DB role
  - Add comments to both getSession and getValidatedSession

- [ ] **Add safeguard to upsert**
  - Prevent companyId changes on update
  - Lines: lib/tenantScope.ts:124-136

### Priority 3: Nice-to-have (Optional improvements)

- [ ] Add comments clarifying role handling
- [ ] Optimize session activity updates to prevent race condition
- [ ] Add integration tests for privilege escalation scenarios
- [ ] Add monitoring alerts for role/company mismatches

---

## 📊 Post-Fix Security Assessment

After implementing Priority 1 + Priority 2 fixes:

**Estimated Security Rating: 8.5/10**

### Remaining Gaps (not vulnerabilities)

✅ Fixed: JWT secret, login, role verification, validation

❌ Not included (architectural choices):
- 2FA/MFA (not implemented)
- Rate limiting (not implemented)
- IP whitelisting (not implemented)
- Audit logging completeness (not implemented)
- Session expiration refresh (not implemented)

These are optional hardening measures, not security bugs.

---

## 🚀 Deployment Readiness

| Requirement | Status | Notes |
|------------|--------|-------|
| Code review | ⚠️ **NOT READY** | Critical issues found |
| Security audit | ⚠️ **NOT READY** | See recommendations above |
| Integration tests | ❌ **NOT DONE** | Need tenant isolation tests |
| Penetration testing | ❌ **NOT DONE** | Recommend after fixes |
| Staging deployment | ❌ **NOT READY** | Fix issues first |
| Production deployment | ❌ **NOT READY** | Multiple critical issues |

**Recommendation:** Do NOT deploy to production until Priority 1 issues are fixed.

---

## 🎯 Recommended Action Plan

### Phase 1: Critical Fixes (2-4 hours)
1. Remove JWT_SECRET insecure fallback
2. Implement one login architecture (email-based recommended)
3. Add role verification to getValidatedSession
4. Test login and session flow

### Phase 2: Security Hardening (1-2 hours)
1. Add input validation to tenantScope
2. Add role claim validation to verifySessionToken
3. Add safeguard to upsert
4. Document role strategy

### Phase 3: Testing (2-3 hours)
1. Write integration tests for all 3 critical issues
2. Test cross-tenant access attempts
3. Test privilege escalation scenarios
4. Load test for race conditions

### Phase 4: Deployment (1 hour per environment)
1. Deploy to staging first
2. Run full security test suite
3. Monitor for errors
4. Deploy to production

**Total Time:** ~10-12 hours for fixes + testing

---

## 📞 Questions for the Team

1. **Login Architecture:** Have you decided between email-based, company selector, or subdomain-based login?
2. **Role Changes:** Should role changes take effect immediately (even for active sessions) or require logout?
3. **Monitoring:** Do you have alerting for "Company ID mismatch" and "User ID mismatch" errors?
4. **Audit Logging:** Are you logging all failed authentication attempts to database?

---

## Summary

**The implementation has EXCELLENT architecture but CRITICAL flaws in execution.**

| | Status |
|---|--------|
| **Concept & Design** | ✅ Excellent |
| **Code Quality** | ⚠️ Good, but has bugs |
| **Security Approach** | ✅ Excellent (defense-in-depth) |
| **Implementation** | ❌ Incomplete (3 critical issues) |
| **Documentation** | ✅ Comprehensive |
| **Deployment Ready** | ❌ NO - Fix issues first |

**All issues are fixable within 2-4 hours.** After fixes, this will be enterprise-grade multi-tenant isolation.

---

**Final Recommendation: DO NOT DEPLOY until Priority 1 issues are complete.**

Once fixed, you'll have a solid multi-tenant isolation system.
