import { prisma } from '@/lib/db';
import { addServerAuditLog } from '@/app/actions/audit';
import type { EmailProviderName, SyncResult } from './types';
import { getProvider, ensureValidAccessToken } from './emailService';
import { collectParticipantEmails, linkThreadToLeads } from './leadLinker';
import { publishEmailEvent } from './wsPublisher';

async function upsertThread(accountId: string, userId: string, provider: EmailProviderName, thread: any) {
  return prisma.emailThread.upsert({
    where: {
      userId_provider_providerThreadId: {
        userId,
        provider,
        providerThreadId: thread.providerThreadId,
      },
    },
    update: {
      subject: thread.subject,
      snippet: thread.snippet,
      lastMessageAt: thread.lastMessageAt || undefined,
      unreadCount: thread.unreadCount ?? 0,
      hasAttachments: thread.hasAttachments ?? false,
      folder: thread.folder || undefined,
      updatedAt: new Date(),
    },
    create: {
      userId,
      provider,
      providerThreadId: thread.providerThreadId,
      subject: thread.subject,
      snippet: thread.snippet,
      lastMessageAt: thread.lastMessageAt || undefined,
      unreadCount: thread.unreadCount ?? 0,
      hasAttachments: thread.hasAttachments ?? false,
      folder: thread.folder || undefined,
    },
  });
}

async function upsertMessage(userId: string, provider: EmailProviderName, threadId: string, message: any) {
  const existing = await prisma.emailMessage.findUnique({
    where: { userId_provider_providerMessageId: { userId, provider, providerMessageId: message.providerMessageId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.emailMessage.update({
      where: { id: existing.id },
      data: {
        threadId,
        from: message.from,
        to: message.to,
        cc: message.cc,
        bcc: message.bcc,
        subject: message.subject,
        snippet: message.snippet,
        sentAt: message.sentAt || undefined,
        isRead: message.isRead ?? false,
        hasAttachments: message.hasAttachments ?? false,
        attachmentsMeta: message.attachmentsMeta,
      },
    });
    return { id: existing.id, isNew: false };
  }

  const created = await prisma.emailMessage.create({
    data: {
      userId,
      provider,
      threadId,
      providerMessageId: message.providerMessageId,
      from: message.from,
      to: message.to,
      cc: message.cc,
      bcc: message.bcc,
      subject: message.subject,
      snippet: message.snippet,
      sentAt: message.sentAt || undefined,
      isRead: message.isRead ?? false,
      hasAttachments: message.hasAttachments ?? false,
      attachmentsMeta: message.attachmentsMeta,
    },
  });

  return { id: created.id, isNew: true };
}

async function persistSyncResult(account: any, result: SyncResult) {
  const newMessages: { messageId: string; threadId: string }[] = [];
  for (const threadSummary of result.threads) {
    const thread = await upsertThread(account.id, account.userId, account.provider, threadSummary);
    const messages = result.messagesByThread[threadSummary.providerThreadId] || [];

    for (const message of messages) {
      const res = await upsertMessage(account.userId, account.provider, thread.id, message);
      if (res.isNew) {
        newMessages.push({ messageId: message.providerMessageId, threadId: thread.id });
      }
    }

    const participantEmails = collectParticipantEmails(
      messages.map((m) => ({ from: m.from, to: m.to, cc: m.cc }))
    );
    await linkThreadToLeads(thread.id, participantEmails);
  }

  if (result.cursor) {
    await prisma.emailWebhookState.upsert({
      where: { userId_provider: { userId: account.userId, provider: account.provider } },
      update: {
        lastHistoryId: account.provider === 'gmail' ? result.cursor : undefined,
        lastDeltaToken: account.provider === 'outlook' ? result.cursor : undefined,
      },
      create: {
        userId: account.userId,
        provider: account.provider,
        lastHistoryId: account.provider === 'gmail' ? result.cursor : undefined,
        lastDeltaToken: account.provider === 'outlook' ? result.cursor : undefined,
      },
    });
  }

  if (newMessages.length > 0) {
    const unreadCount = await prisma.emailThread.aggregate({
      where: { userId: account.userId },
      _sum: { unreadCount: true },
    });

    const totalUnread = unreadCount._sum.unreadCount || 0;
    for (const msg of newMessages) {
      await publishEmailEvent(account.userId, 'email:new', {
        messageId: msg.messageId,
        threadId: msg.threadId,
        unreadCount: totalUnread,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export async function runInitialSync(account: any) {
  await ensureValidAccessToken(account);
  const provider = getProvider(account.provider);

  await addServerAuditLog({
    actionType: 'EMAIL_SYNC_STARTED',
    entityType: 'email_account',
    entityId: account.id,
    performedById: account.userId,
    description: `Initial email sync started for provider ${account.provider}`,
  });

  const result = await provider.initialSync(account);
  await persistSyncResult(account, result);

  await addServerAuditLog({
    actionType: 'EMAIL_SYNC_COMPLETED',
    entityType: 'email_account',
    entityId: account.id,
    performedById: account.userId,
    description: `Initial email sync completed for provider ${account.provider}`,
  });
}

export async function runIncrementalSync(account: any, cursor?: string | null) {
  await ensureValidAccessToken(account);
  const provider = getProvider(account.provider);
  const result = await provider.syncIncremental(account, cursor);
  await persistSyncResult(account, result);
}
