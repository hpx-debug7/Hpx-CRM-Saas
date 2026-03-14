import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { requireAuth } from '@/app/actions/auth';
import { withApiLogging } from "@/lib/apiLogger";
import { logger } from "@/lib/logger";

export const runtime = 'nodejs';

export async function GET(req: Request) {
    return withApiLogging(req, async (requestId) => {
      try {
        const session = await requireAuth();

        if (!session || !session.userId) {
          logger.warn("Unauthorized access to unread-count", { route: "/api/email/unread-count" });
          return NextResponse.json(
            { success: false, error: "Unauthorized" },
            { status: 401 }
          );
        }

        const sum = await prisma.emailThread.aggregate({
          where: { userId: session.userId },
          _sum: { unreadCount: true },
        });
        
        const unreadCount = sum?._sum?.unreadCount ?? 0;
        
        return NextResponse.json({ success: true, data: { unreadCount } });
      } catch (error) {
        logger.error("Failed to load unread count", {
          error: error instanceof Error ? error.message : String(error),
          route: "/api/email/unread-count"
        });
        return NextResponse.json(
          { success: false, error: 'Failed to load unread count' },
          { status: 500 }
        );
      }

    });
}
