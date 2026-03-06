import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { requireAuth } from '@/app/actions/auth';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await requireAuth();
    const sum = await prisma.emailThread.aggregate({
      where: { userId: session.userId },
      _sum: { unreadCount: true },
    });
    return NextResponse.json({ success: true, data: { unreadCount: sum._sum.unreadCount || 0 } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load unread count' },
      { status: 500 }
    );
  }
}
