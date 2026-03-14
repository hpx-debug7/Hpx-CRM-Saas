import { NextResponse } from 'next/server';
import { withApiLogging } from '@/lib/apiLogger';

export async function GET(req: Request) {
  return withApiLogging(req, async (requestId) => {
    return NextResponse.json({
      status: "ok",
      service: "hpx-crm-saas",
      timestamp: new Date().toISOString()
    }, { status: 200 });
  });
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
