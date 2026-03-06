import { prisma } from '@/lib/server/db';

export interface EmailQueueItem {
  id: string;
  userId: string;
  to: string;
  subject: string;
  body: string;
  cc: string | null;
  bcc: string | null;
  linkedLeadId: string | null;
  fromAccountId: string | null;
  attachments: string[];
  createdAt: Date;
  syncedAt: Date | null;
  status: 'DRAFT' | 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED';
  error: string | null;
  retryCount: number;
}

export interface EmailQueueStats {
  totalDrafts: number;
  totalQueued: number;
  totalSending: number;
  totalSent: number;
  totalFailed: number;
  averageRetries: number;
}

/**
 * Email Queue Service
 * Manages drafting and queueing of emails for offline-first support
 */
export class EmailQueueService {
  /**
   * Create a draft email
   */
  static async draft(
    companyId: string,
    userId: string,
    to: string,
    subject: string,
    body: string,
    options?: {
      cc?: string;
      bcc?: string;
      linkedLeadId?: string;
      fromAccountId?: string;
      attachments?: string[];
    }
  ): Promise<EmailQueueItem> {
    const email = await prisma.emailQueue.create({
      data: {
        companyId,
        userId,
        to,
        subject,
        body,
        cc: options?.cc || null,
        bcc: options?.bcc || null,
        linkedLeadId: options?.linkedLeadId || null,
        fromAccountId: options?.fromAccountId || null,
        attachments: options?.attachments
          ? JSON.stringify(options.attachments)
          : null,
        status: 'DRAFT',
      },
    });

    return this.mapEmailItem(email);
  }

  /**
   * Get all drafts for a user
   */
  static async getDrafts(userId: string): Promise<EmailQueueItem[]> {
    const emails = await prisma.emailQueue.findMany({
      where: {
        userId,
        status: 'DRAFT',
      },
      orderBy: { createdAt: 'desc' },
    });

    return emails.map((email) => this.mapEmailItem(email));
  }

  /**
   * Get all pending emails (QUEUED, SENDING, or FAILED with retries left)
   */
  static async getPending(limit: number = 50): Promise<EmailQueueItem[]> {
    const emails = await prisma.emailQueue.findMany({
      where: {
        syncedAt: null,
        status: { in: ['QUEUED', 'SENDING', 'FAILED'] },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      take: limit,
    });

    return emails.map((email) => this.mapEmailItem(email));
  }

  /**
   * Get pending emails by status
   */
  static async getPendingByStatus(
    status: 'DRAFT' | 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED',
    limit: number = 50
  ): Promise<EmailQueueItem[]> {
    const emails = await prisma.emailQueue.findMany({
      where: { status },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return emails.map((email) => this.mapEmailItem(email));
  }

  /**
   * Queue a draft email for sending
   */
  static async queue(emailId: string): Promise<void> {
    await prisma.emailQueue.update({
      where: { id: emailId },
      data: {
        status: 'QUEUED',
      },
    });
  }

  /**
   * Queue multiple drafts
   */
  static async queueBatch(emailIds: string[]): Promise<number> {
    const result = await prisma.emailQueue.updateMany({
      where: { id: { in: emailIds } },
      data: { status: 'QUEUED' },
    });

    return result.count;
  }

  /**
   * Mark email as sending
   */
  static async markSending(emailId: string): Promise<void> {
    await prisma.emailQueue.update({
      where: { id: emailId },
      data: {
        status: 'SENDING',
      },
    });
  }

  /**
   * Mark email as sent
   */
  static async markSent(emailId: string): Promise<void> {
    await prisma.emailQueue.update({
      where: { id: emailId },
      data: {
        status: 'SENT',
        syncedAt: new Date(),
      },
    });
  }

  /**
   * Mark multiple emails as sent
   */
  static async markSentBatch(emailIds: string[]): Promise<number> {
    const result = await prisma.emailQueue.updateMany({
      where: { id: { in: emailIds } },
      data: {
        status: 'SENT',
        syncedAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Mark email as failed
   */
  static async markFailed(
    emailId: string,
    error: string,
    retryable: boolean = true
  ): Promise<void> {
    await prisma.emailQueue.update({
      where: { id: emailId },
      data: {
        status: retryable ? 'FAILED' : 'FAILED',
        error,
        retryCount: { increment: 1 },
      },
    });
  }

  /**
   * Mark multiple emails as failed
   */
  static async markFailedBatch(
    emailIds: string[],
    error: string
  ): Promise<number> {
    const result = await prisma.emailQueue.updateMany({
      where: { id: { in: emailIds } },
      data: {
        status: 'FAILED',
        error,
        retryCount: { increment: 1 },
      },
    });

    return result.count;
  }

  /**
   * Retry a failed email
   */
  static async retry(emailId: string): Promise<void> {
    await prisma.emailQueue.update({
      where: { id: emailId },
      data: {
        status: 'QUEUED',
        error: null,
      },
    });
  }

  /**
   * Retry multiple failed emails
   */
  static async retryBatch(emailIds: string[]): Promise<number> {
    const result = await prisma.emailQueue.updateMany({
      where: { id: { in: emailIds } },
      data: {
        status: 'QUEUED',
        error: null,
      },
    });

    return result.count;
  }

  /**
   * Update draft content
   */
  static async updateDraft(
    emailId: string,
    updates: {
      to?: string;
      cc?: string;
      bcc?: string;
      subject?: string;
      body?: string;
      attachments?: string[];
    }
  ): Promise<void> {
    const data: any = {};

    if (updates.to) data.to = updates.to;
    if (updates.cc) data.cc = updates.cc;
    if (updates.bcc) data.bcc = updates.bcc;
    if (updates.subject) data.subject = updates.subject;
    if (updates.body) data.body = updates.body;
    if (updates.attachments)
      data.attachments = JSON.stringify(updates.attachments);

    await prisma.emailQueue.update({
      where: { id: emailId },
      data,
    });
  }

  /**
   * Delete a draft email
   */
  static async delete(emailId: string): Promise<void> {
    await prisma.emailQueue.delete({
      where: { id: emailId },
    });
  }

  /**
   * Delete multiple emails
   */
  static async deleteBatch(emailIds: string[]): Promise<number> {
    const result = await prisma.emailQueue.deleteMany({
      where: { id: { in: emailIds } },
    });

    return result.count;
  }

  /**
   * Delete a draft email (convenience method)
   */
  static async deleteDraft(emailId: string): Promise<void> {
    await prisma.emailQueue.delete({
      where: { id: emailId },
    });
  }

  /**
   * Clear old sent emails (older than specified days)
   */
  static async clearOldSent(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await prisma.emailQueue.deleteMany({
      where: {
        status: 'SENT',
        syncedAt: { lt: cutoffDate },
      },
    });

    return result.count;
  }

  /**
   * Get queue statistics
   */
  static async getStats(): Promise<EmailQueueStats> {
    const [drafts, queued, sending, sent, failed, allItems] =
      await Promise.all([
        prisma.emailQueue.count({ where: { status: 'DRAFT' } }),
        prisma.emailQueue.count({ where: { status: 'QUEUED' } }),
        prisma.emailQueue.count({ where: { status: 'SENDING' } }),
        prisma.emailQueue.count({ where: { status: 'SENT' } }),
        prisma.emailQueue.count({ where: { status: 'FAILED' } }),
        prisma.emailQueue.findMany(),
      ]);

    const averageRetries =
      allItems.length > 0
        ? allItems.reduce((sum, item) => sum + item.retryCount, 0) /
        allItems.length
        : 0;

    return {
      totalDrafts: drafts,
      totalQueued: queued,
      totalSending: sending,
      totalSent: sent,
      totalFailed: failed,
      averageRetries: Math.round(averageRetries * 100) / 100,
    };
  }

  /**
   * Get email by ID
   */
  static async getById(emailId: string): Promise<EmailQueueItem | null> {
    const email = await prisma.emailQueue.findUnique({
      where: { id: emailId },
    });

    return email ? this.mapEmailItem(email) : null;
  }

  /**
   * Get all emails for a user
   */
  static async getAllForUser(userId: string): Promise<EmailQueueItem[]> {
    const emails = await prisma.emailQueue.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return emails.map((email) => this.mapEmailItem(email));
  }

  /**
   * Get failed emails with retry count < max
   */
  static async getRetryableFailed(maxRetries: number = 10): Promise<EmailQueueItem[]> {
    const emails = await prisma.emailQueue.findMany({
      where: {
        status: 'FAILED',
        retryCount: { lt: maxRetries },
      },
      orderBy: { retryCount: 'asc' },
    });

    return emails.map((email) => this.mapEmailItem(email));
  }

  /**
   * Clear all sent emails (useful for cleanup)
   */
  static async clearAllSent(): Promise<number> {
    const result = await prisma.emailQueue.deleteMany({
      where: { status: 'SENT' },
    });

    return result.count;
  }

  /**
   * Map database model to interface
   */
  private static mapEmailItem(email: any): EmailQueueItem {
    return {
      id: email.id,
      userId: email.userId,
      to: email.to,
      subject: email.subject,
      body: email.body,
      cc: email.cc,
      bcc: email.bcc,
      linkedLeadId: email.linkedLeadId,
      fromAccountId: email.fromAccountId,
      attachments: email.attachments ? JSON.parse(email.attachments) : [],
      createdAt: email.createdAt,
      syncedAt: email.syncedAt,
      status: email.status,
      error: email.error,
      retryCount: email.retryCount,
    };
  }
}
