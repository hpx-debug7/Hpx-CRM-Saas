import { prisma } from '@/lib/server/db';

function normalizeEmail(raw: string): string | null {
  const match = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : null;
}

function extractEmails(value?: string): string[] {
  if (!value) return [];
  const parts = value.split(',').map((v) => v.trim());
  const emails: string[] = [];
  for (const part of parts) {
    const normalized = normalizeEmail(part);
    if (normalized) emails.push(normalized);
  }
  return emails;
}

export function collectParticipantEmails(messages: { from?: string | null; to?: string | null; cc?: string | null }[]): string[] {
  const set = new Set<string>();
  for (const msg of messages) {
    extractEmails(msg.from || undefined).forEach((e) => set.add(e));
    extractEmails(msg.to || undefined).forEach((e) => set.add(e));
    extractEmails(msg.cc || undefined).forEach((e) => set.add(e));
  }
  return Array.from(set);
}

export async function linkThreadToLeads(threadId: string, participantEmails: string[]): Promise<void> {
  if (participantEmails.length === 0) return;

  const leads = await prisma.lead.findMany({
    where: {
      email: { in: participantEmails },
    },
    select: { id: true, companyId: true },
  });

  if (leads.length === 0) return;

  if (leads.length === 1) {
    await prisma.emailThread.update({
      where: { id: threadId },
      data: { leadId: leads[0].id },
    });
  } else {
    await prisma.emailThread.update({
      where: { id: threadId },
      data: { leadId: null },
    });
  }

  for (const lead of leads) {
    await prisma.emailThreadLead.upsert({
      where: {
        companyId_threadId_leadId: {
          companyId: lead.companyId,
          threadId,
          leadId: lead.id,
        },
      },
      update: {},
      create: { companyId: lead.companyId, threadId, leadId: lead.id },
    });
  }
}
