import { NextResponse } from 'next/server';
import { requireAuth } from '@/app/actions/auth';
import { prisma } from '@/lib/server/db';
import { withApiLogging } from "@/lib/apiLogger";

export const runtime = 'nodejs';

function normalizeStickyValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true';
  return true;
}

async function ensureStickyColumnExists(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE users ADD COLUMN stickyLeadTableHeader INTEGER NOT NULL DEFAULT 1'
  );
}

export async function GET(req: Request) {
    return withApiLogging(req, async (requestId) => {
      try {
        const session = await requireAuth();

        // Primary path: typed Prisma client
        try {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { stickyLeadTableHeader: true },
          });

          if (!user) {
            return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
          }

          return NextResponse.json({
            success: true,
            preferences: {
              stickyLeadTableHeader: user.stickyLeadTableHeader,
            },
          });
        } catch {
          // Fallback path: raw SQL for environments where Prisma client isn't regenerated yet
          let rows: Array<{ stickyLeadTableHeader: unknown }> = [];
          try {
            rows = await prisma.$queryRawUnsafe<Array<{ stickyLeadTableHeader: unknown }>>(
              'SELECT stickyLeadTableHeader FROM users WHERE id = ? LIMIT 1',
              session.userId
            );
          } catch (error) {
            const message = error instanceof Error ? error.message.toLowerCase() : '';
            if (message.includes('no such column') && message.includes('stickyleadtableheader')) {
              await ensureStickyColumnExists();
              rows = await prisma.$queryRawUnsafe<Array<{ stickyLeadTableHeader: unknown }>>(
                'SELECT stickyLeadTableHeader FROM users WHERE id = ? LIMIT 1',
                session.userId
              );
            } else {
              throw error;
            }
          }

          if (!rows || rows.length === 0) {
            return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
          }

          return NextResponse.json({
            success: true,
            preferences: {
              stickyLeadTableHeader: normalizeStickyValue(rows[0]?.stickyLeadTableHeader),
            },
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load preferences';
        const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
        return NextResponse.json(
          { success: false, error: message },
          { status }
        );
      }

    });
}

export async function PATCH(req: Request) {
    return withApiLogging(req, async (requestId) => {
      try {
        const session = await requireAuth();
        const body = await req.json();
        const value = body?.stickyLeadTableHeader;

        if (typeof value !== 'boolean') {
          return NextResponse.json(
            { success: false, error: 'stickyLeadTableHeader must be a boolean' },
            { status: 400 }
          );
        }

        // Primary path: typed Prisma client
        try {
          const updated = await prisma.user.update({
            where: { id: session.userId },
            data: { stickyLeadTableHeader: value },
            select: { stickyLeadTableHeader: true },
          });

          return NextResponse.json({
            success: true,
            preferences: {
              stickyLeadTableHeader: updated.stickyLeadTableHeader,
            },
          });
        } catch {
          // Fallback path: raw SQL for environments where Prisma client isn't regenerated yet
          const numericValue = value ? 1 : 0;
          let result = 0;
          try {
            result = await prisma.$executeRawUnsafe(
              'UPDATE users SET stickyLeadTableHeader = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
              numericValue,
              session.userId
            );
          } catch (error) {
            const message = error instanceof Error ? error.message.toLowerCase() : '';
            if (message.includes('no such column') && message.includes('stickyleadtableheader')) {
              await ensureStickyColumnExists();
              result = await prisma.$executeRawUnsafe(
                'UPDATE users SET stickyLeadTableHeader = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
                numericValue,
                session.userId
              );
            } else {
              throw error;
            }
          }

          if (!result) {
            return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
          }

          return NextResponse.json({
            success: true,
            preferences: {
              stickyLeadTableHeader: value,
            },
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save preferences';
        const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
        return NextResponse.json(
          { success: false, error: message },
          { status }
        );
      }

    });
}
