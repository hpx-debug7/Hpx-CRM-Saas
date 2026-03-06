import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { requireAuth } from '@/app/actions/auth';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const folder = searchParams.get('folder') || undefined;

    const threads = await prisma.emailThread.findMany({
      where: {
        userId: session.userId,
        ...(folder ? { folder } : {}),
      },
      orderBy: { lastMessageAt: 'desc' },
      include: { threadLeads: { include: { lead: true } } },
      take: 100,
    });

    return NextResponse.json({ success: true, data: threads });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load inbox' },
      { status: 500 }
    );
  }
}
