import { NextResponse } from 'next/server';
import { decryptState } from '@/app/lib/email/crypto';
import { OutlookProvider } from '@/app/lib/email/providers/OutlookProvider';
import { upsertAccount } from '@/app/lib/email/emailService';
import { runInitialSync } from '@/app/lib/email/syncEngine';
import { addServerAuditLog } from '@/app/actions/audit';
import { getEnv } from '@/lib/env';
const env = getEnv();

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      return NextResponse.json({ success: false, error: 'Missing code/state' }, { status: 400 });
    }

    const payload = decryptState<{ userId: string; provider: string; ts: number }>(state);
    if (!payload?.userId || payload.provider !== 'outlook') {
      return NextResponse.json({ success: false, error: 'Invalid state' }, { status: 400 });
    }
    if (Date.now() - payload.ts > 10 * 60 * 1000) {
      return NextResponse.json({ success: false, error: 'State expired' }, { status: 400 });
    }

    const tokens = await OutlookProvider.exchangeCodeForTokens(code);

    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    if (!profileRes.ok) {
      const text = await profileRes.text();
      throw new Error(`Failed to fetch Outlook profile: ${text}`);
    }
    const profile = await profileRes.json();
    const emailAddress = (profile.mail || profile.userPrincipalName) as string;
    const providerAccountId = profile.id as string;

    const account = await upsertAccount({
      userId: payload.userId,
      provider: 'outlook',
      emailAddress,
      providerAccountId,
      tokens,
    });

    await addServerAuditLog({
      actionType: 'EMAIL_CONNECT',
      entityType: 'email_account',
      entityId: account.id,
      performedById: payload.userId,
      description: 'Outlook account connected',
      metadata: { emailAddress },
    });

    await runInitialSync(account);

    return NextResponse.redirect(`${env.BASE_URL || ''}/email`);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'OAuth callback failed' },
      { status: 500 }
    );
  }
}
