import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { Lead } from '@/app/types/shared';
import { fromDbLead, toDbLead } from '@/app/lib/leadMapper';
import { env } from '@/lib/env';

const BATCH_SIZE = 200;

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

export async function GET() {
  try {
    const dbLeads = await prisma.lead.findMany({
      orderBy: { updatedAt: 'desc' }
    });
    const leads = dbLeads.map((l) => fromDbLead(l));
    return NextResponse.json({ success: true, leads });
  } catch (error) {
    console.error('[GET /api/leads] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load leads',
        stack: env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const leads: Lead[] = Array.isArray(body?.leads) ? body.leads : [];

    if (leads.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    let savedCount = 0;
    const errors: string[] = [];
    const batches = chunk(leads, BATCH_SIZE);

    for (const batch of batches) {
      const operations = batch.map((lead) => {
        const mapped = toDbLead(lead);
        // Separate the id from the rest—Prisma does not allow updating the PK
        const { id, ...data } = mapped;
        // Strip relational FK fields that may reference non-existent users to
        // avoid foreign-key constraint violations (the full lead data is still
        // persisted inside the customFields JSON column).
        const safeData = { ...data, assignedToId: null, createdById: null };
        return prisma.lead.upsert({
          where: { id },
          create: { id, ...safeData },
          update: safeData
        });
      });

      try {
        await prisma.$transaction(operations);
        savedCount += batch.length;
      } catch (txError) {
        // If batched transaction fails, fall back to saving leads one-by-one
        // so a single bad record doesn't block the rest.
        for (const lead of batch) {
          try {
            const mapped = toDbLead(lead);
            const { id, ...data } = mapped;
            const safeData = { ...data, assignedToId: null, createdById: null };
            await prisma.lead.upsert({
              where: { id },
              create: { id, ...safeData },
              update: safeData
            });
            savedCount++;
          } catch (singleErr) {
            errors.push(
              `Lead ${lead.id}: ${singleErr instanceof Error ? singleErr.message : 'unknown error'}`
            );
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      count: savedCount,
      ...(errors.length > 0 && { partialErrors: errors })
    });
  } catch (error) {
    console.error('[POST /api/leads] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to save leads' },
      { status: 500 }
    );
  }
}
