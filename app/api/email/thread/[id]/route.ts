import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/app/actions/auth';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth();
    const thread = await prisma.emailThread.findFirst({
      where: { id: params.id, userId: session.userId },
      include: { messages: { orderBy: { sentAt: 'asc' } }, threadLeads: { include: { lead: true } } },
    });

    if (!thread) {
      return NextResponse.json({ success: false, error: 'Thread not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: thread });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load thread' },
      { status: 500 }
    );
  }
}
