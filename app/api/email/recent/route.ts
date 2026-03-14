import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { requireAuth } from '@/app/actions/auth';
import { withApiLogging } from "@/lib/apiLogger";

export const runtime = 'nodejs';

export async function GET(req: Request) {
    return withApiLogging(req, async (requestId) => {
      try {
        const session = await requireAuth();
        const { searchParams } = new URL(req.url);
        const limit = Number(searchParams.get('limit') || '5');

        const threads = await prisma.emailThread.findMany({
          where: { userId: session.userId },
          orderBy: { lastMessageAt: 'desc' },
          take: Math.min(limit, 20),
          include: { threadLeads: { include: { lead: true } } },
        });

        return NextResponse.json({ success: true, data: threads });
      } catch (error) {
        return NextResponse.json(
          { success: false, error: error instanceof Error ? error.message : 'Failed to load recent threads' },
          { status: 500 }
        );
      }

    });
}
