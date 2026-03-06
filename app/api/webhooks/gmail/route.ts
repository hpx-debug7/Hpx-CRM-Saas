import { logger } from '@/lib/server/logger';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { runIncrementalSync } from '@/app/lib/email/syncEngine';

export const runtime = 'nodejs';

function decodeBase64(data: string): any | null {
  try {
    const json = Buffer.from(data, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const messageData = payload?.message?.data ? decodeBase64(payload.message.data) : payload;

    const emailAddress = messageData?.emailAddress;
    const historyId = messageData?.historyId;

    if (!emailAddress) {
      return NextResponse.json({ success: true });
    }

    const account = await prisma.emailAccount.findFirst({
      where: { provider: 'gmail', emailAddress },
    });

    if (!account) {
      return NextResponse.json({ success: true });
    }

    const state = await prisma.emailWebhookState.findFirst({
      where: { userId: account.userId, provider: 'gmail' },
    });

    await runIncrementalSync(account, state?.lastHistoryId || historyId);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Gmail webhook error:', error);
    return NextResponse.json({ success: false });
  }
}
