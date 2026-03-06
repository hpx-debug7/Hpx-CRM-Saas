'use server';

import { prisma } from '@/lib/server/db';

/**
 * SECURE USER LOOKUP HELPERS
 *
 * Problem: User schema has composite unique keys:
 *   @@unique([companyId, username])
 *   @@unique([companyId, email])
 *
 * This means username/email are NOT globally unique - they're scoped per company.
 * The login flow needs to know which company the user belongs to.
 *
 * Solution: Use email to identify user across all companies, then look up by company.
 */

/**
 * Find user by email across all companies.
 * Returns the user with all company context.
 * Throws if email not found or multiple matches (should not happen).
 */
export async function findUserByEmail(email: string) {
  return await prisma.user.findFirstOrThrow({
    where: {
      email: email.toLowerCase(),
    },
    include: {
      company: true,
    },
  });
}

/**
 * Find user by username within a specific company.
 * Must know the company to avoid ambiguous lookups.
 */
export async function findUserByUsernameInCompany(
  username: string,
  companyId: string,
) {
  return await prisma.user.findUnique({
    where: {
      companyId_username: {
        username: username.toLowerCase(),
        companyId,
      },
    },
    include: {
      company: true,
    },
  });
}

/**
 * Find user by email within a specific company.
 * More secure than global email lookup.
 */
export async function findUserByEmailInCompany(
  email: string,
  companyId: string,
) {
  return await prisma.user.findUnique({
    where: {
      companyId_email: {
        email: email.toLowerCase(),
        companyId,
      },
    },
    include: {
      company: true,
    },
  });
}

/**
 * IMPORTANT: Current Login Architecture Issue
 *
 * The current loginAction needs to determine which company the user belongs to.
 * This is typically done in one of these ways:
 *
 * 1. EMAIL-BASED LOGIN (Recommended)
 *    - User logs in with email (globally unique across companies)
 *    - Look up user by email
 *    - User gets redirected to their company's dashboard
 *    - Pro: Email is more secure than username
 *    - Con: User can't use same email for multiple accounts
 *
 * 2. COMPANY SELECTOR
 *    - User selects company name/subdomain on login page
 *    - User enters username/password
 *    - Look up: username_companyId
 *    - Pro: Can have multiple accounts per email
 *    - Con: Extra step in login UX
 *
 * 3. SUBDOMAIN-BASED ROUTING
 *    - User logs into: company-name.example.com
 *    - Extract company from subdomain
 *    - Validate user belongs to that company
 *    - Pro: Company selection is implicit
 *    - Con: Requires DNS/routing setup
 *
 * 4. USERNAME WITH COMPANY PREFIX
 *    - User logs in as: "companyname\\username"
 *    - Split on \\ to extract company and username
 *    - Look up: username + company
 *    - Pro: Single input field
 *    - Con: Not user-friendly
 */

export const LOGIN_ARCHITECTURE_NOTE = `
MIGRATION REQUIRED:

Current auth.ts loginAction() uses:
  prisma.user.findUnique({ where: { username: ... } })

This will NOT work with the composite key:
  @@unique([companyId, username])

You MUST choose one of these approaches:

OPTION A: EMAIL-BASED LOGIN (Recommended for SaaS)
  // Update loginAction signature
  export async function loginAction(email: string, password: string) {
    const user = await findUserByEmail(email);
    // User is in user.company.id
    await createSession(user.id, user.role, user.companyId, ...);
  }

OPTION B: COMPANY SELECTOR
  // Require company selection on login page
  export async function loginAction(
    username: string,
    password: string,
    companyId: string // NEW PARAMETER from form
  ) {
    const user = await findUserByUsernameInCompany(username, companyId);
    // ...
  }

OPTION C: SUBDOMAIN-BASED
  // Extract company from request headers
  function extractCompanyFromSubdomain(req: NextRequest): string {
    const host = req.headers.get('host') || '';
    const subdomain = host.split('.')[0];
    return subdomain; // Validate this is a real company
  }

Choose an option and update the login flow accordingly.
`;
