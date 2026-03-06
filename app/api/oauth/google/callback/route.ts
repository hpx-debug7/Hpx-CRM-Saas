import { logger } from '@/lib/server/logger';
import { NextResponse } from 'next/server';
import { GmailProvider } from '@/app/lib/email/providers/GmailProvider';
import { upsertAccount } from '@/app/lib/email/emailService';
import { runInitialSync } from '@/app/lib/email/syncEngine';
import { addServerAuditLog } from '@/app/actions/audit';
import { requireAuth } from '@/app/actions/auth';
import { getEnv } from '@/lib/server/env';
const env = getEnv();

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.json(
        { success: false, error: `Google OAuth error: ${error}` },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Missing authorization code' },
        { status: 400 }
      );
    }

    const tokens = await GmailProvider.exchangeCodeForTokens(code);

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    if (!profileRes.ok) {
      const text = await profileRes.text();
      throw new Error(`Failed to fetch Gmail profile: ${text}`);
    }
    const profile = await profileRes.json();
    const emailAddress = (profile.email || profile.name) as string;
    const providerAccountId = profile.id as string;

    const account = await upsertAccount({
      userId: session.userId,
      provider: 'gmail',
      emailAddress,
      providerAccountId,
      tokens,
    });

    await addServerAuditLog({
      actionType: 'EMAIL_CONNECT',
      entityType: 'email_account',
      entityId: account.id,
      performedById: session.userId,
      description: 'Gmail account connected',
      metadata: { emailAddress },
    });

    await runInitialSync(account);

    return NextResponse.redirect(`${process.env.BASE_URL || ''}/email`);
  } catch (error) {
    logger.error('[GMAIL OAUTH CALLBACK] error', error instanceof Error ? error.stack : error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'OAuth callback failed' },
      { status: 500 }
    );
  }
}
