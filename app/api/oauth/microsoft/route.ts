import { NextResponse } from 'next/server';
import { requireAuth } from '@/app/actions/auth';
import { encryptState } from '@/app/lib/email/crypto';
import { OutlookProvider } from '@/app/lib/email/providers/OutlookProvider';
import { withApiLogging } from "@/lib/apiLogger";

export const runtime = 'nodejs';

export async function GET(req: Request) {
    return withApiLogging(req, async (requestId) => {
      try {
        const session = await requireAuth();
        const state = encryptState({
          userId: session.userId,
          provider: 'outlook',
          ts: Date.now(),
        });
        const url = OutlookProvider.getAuthUrl(state);
        return NextResponse.redirect(url);
      } catch (error) {
        return NextResponse.json(
          { success: false, error: error instanceof Error ? error.message : 'Failed to start OAuth' },
          { status: 500 }
        );
      }

    });
}
