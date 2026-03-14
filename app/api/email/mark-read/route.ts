import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { requireAuth } from '@/app/actions/auth';
import { getAccountForUser } from '@/app/lib/email/emailService';
import { getProvider } from '@/app/lib/email/emailService';
import { addServerAuditLog } from '@/app/actions/audit';
import { publishEmailEvent } from '@/app/lib/email/wsPublisher';
import { withApiLogging } from "@/lib/apiLogger";

export const runtime = 'nodejs';

export async function POST(req: Request) {
    return withApiLogging(req, async (requestId) => {
      try {
        const session = await requireAuth();
        const body = await req.json();
        const provider = body.provider as 'gmail' | 'outlook' | undefined;
        const messageId = body.messageId as string | undefined;

        if (!messageId) {
          return NextResponse.json({ success: false, error: 'messageId is required' }, { status: 400 });
        }

        const account = await getAccountForUser(session.userId, provider);
        if (!account) {
          return NextResponse.json({ success: false, error: 'No active email account found' }, { status: 400 });
        }

        const providerImpl = getProvider(account.provider as any);
        await providerImpl.markRead(account, messageId);

        const msg = await prisma.emailMessage.findFirst({
          where: { userId: session.userId, provider: account.provider, providerMessageId: messageId },
        });

        if (msg) {
          await prisma.emailMessage.update({
            where: { id: msg.id },
            data: { isRead: true },
          });
          await prisma.emailThread.update({
            where: { id: msg.threadId },
            data: { unreadCount: { decrement: 1 } },
          });
        }

        const sum = await prisma.emailThread.aggregate({
          where: { userId: session.userId },
          _sum: { unreadCount: true },
        });

        await addServerAuditLog({
          actionType: 'EMAIL_MARK_READ',
          entityType: 'email',
          performedById: session.userId,
          description: `Email marked read via ${account.provider}`,
          metadata: { messageId },
        });

        await publishEmailEvent(session.userId, 'email:read', {
          messageId,
          threadId: msg?.threadId,
          unreadCount: sum._sum.unreadCount || 0,
          timestamp: new Date().toISOString(),
        });

        return NextResponse.json({ success: true });
      } catch (error) {
        return NextResponse.json(
          { success: false, error: error instanceof Error ? error.message : 'Failed to mark read' },
          { status: 500 }
        );
      }

    });
}
