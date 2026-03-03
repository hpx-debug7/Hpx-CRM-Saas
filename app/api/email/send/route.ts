import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/app/actions/auth';
import { getAccountForUser, sendEmailForAccount } from '@/app/lib/email/emailService';
import { addServerAuditLog } from '@/app/actions/audit';
import { publishEmailEvent } from '@/app/lib/email/wsPublisher';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const provider = body.provider as 'gmail' | 'outlook' | undefined;

    const account = await getAccountForUser(session.userId, provider);
    if (!account) {
      return NextResponse.json({ success: false, error: 'No active email account found' }, { status: 400 });
    }

    const payload = {
      to: body.to || [],
      cc: body.cc || [],
      bcc: body.bcc || [],
      subject: body.subject || '',
      bodyText: body.bodyText || '',
    };

    const result = await sendEmailForAccount(account, payload);

    await prisma.emailSendAudit.create({
      data: {
        userId: session.userId,
        provider: account.provider,
        to: payload.to.join(', '),
        subject: payload.subject,
        sentAt: result.sentAt,
        messageId: result.providerMessageId,
      },
    });

    await addServerAuditLog({
      actionType: 'EMAIL_SENT',
      entityType: 'email',
      performedById: session.userId,
      description: `Email sent via ${account.provider}`,
      metadata: { to: payload.to, subject: payload.subject },
    });

    await publishEmailEvent(session.userId, 'email:sent', {
      messageId: result.providerMessageId,
      threadId: result.providerThreadId,
      unreadCount: null,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    );
  }
}
