import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { runIncrementalSync } from '@/app/lib/email/syncEngine';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('validationToken');
  if (token) {
    return new NextResponse(token, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
  return NextResponse.json({ success: true });
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    if (payload?.validationToken) {
      return new NextResponse(payload.validationToken, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const accounts = await prisma.emailAccount.findMany({
      where: { provider: 'outlook', status: 'ACTIVE' },
    });

    for (const account of accounts) {
      const state = await prisma.emailWebhookState.findFirst({
        where: { userId: account.userId, provider: 'outlook' },
      });
      await runIncrementalSync(account, state?.lastDeltaToken || undefined);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Outlook webhook error:', error);
    return NextResponse.json({ success: false });
  }
}
