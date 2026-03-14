import { logger } from '@/lib/server/logger';
import { NextResponse } from 'next/server';
import { prisma, Prisma } from '@/lib/server/db';
import type { Lead } from '@/app/types/shared';
import { fromDbLead, toDbLead } from '@/app/lib/leadMapper';
import { getEnv } from '@/lib/env';
import { withApiLogging } from "@/lib/apiLogger";

const env = getEnv();

const BATCH_SIZE = 200;

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

export async function GET(req: Request) {
    return withApiLogging(req, async (requestId) => {
      try {
        const dbLeads = await prisma.lead.findMany({
          orderBy: { updatedAt: 'desc' }
        });
        const leads = dbLeads.map((l) => fromDbLead(l));
        return NextResponse.json({ success: true, leads });
      } catch (error) {
        logger.error('[GET /api/leads] Error:', error);
        return NextResponse.json(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to load leads',
            stack: env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
          },
          { status: 500 }
        );
      }

    });
}

export async function POST(req: Request) {
    return withApiLogging(req, async (requestId) => {
      try {
        const body = await req.json();
        const leads: Lead[] = Array.isArray(body?.leads) ? body.leads : [];
        const companyId: string = body?.companyId || 'default';

        if (leads.length === 0) {
          return NextResponse.json({ success: true, count: 0 });
        }

        let savedCount = 0;
        const errors: string[] = [];
        const batches = chunk(leads, BATCH_SIZE);

        for (const batch of batches) {
          const operations = batch.map((lead) => {
            const mapped = toDbLead(lead);
            const { id, assignedToId: _a, createdById: _c, ...rest } = mapped;
            const createData = { id, companyId, ...rest } as Prisma.LeadUncheckedCreateInput;
            const updateData = rest as Prisma.LeadUncheckedUpdateInput;
            return prisma.lead.upsert({
              where: { id },
              create: createData,
              update: updateData
            });
          });

          try {
            await prisma.$transaction(operations);
            savedCount += batch.length;
          } catch (txError) {
            for (const lead of batch) {
              try {
                const mapped = toDbLead(lead);
                const { id, assignedToId: _a, createdById: _c, ...rest } = mapped;
                const createData = { id, companyId, ...rest } as Prisma.LeadUncheckedCreateInput;
                const updateData = rest as Prisma.LeadUncheckedUpdateInput;
                await prisma.lead.upsert({
                  where: { id },
                  create: createData,
                  update: updateData
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
        logger.error('[POST /api/leads] Fatal error:', error);
        return NextResponse.json(
          { success: false, error: error instanceof Error ? error.message : 'Failed to save leads' },
          { status: 500 }
        );
      }

    });
}
