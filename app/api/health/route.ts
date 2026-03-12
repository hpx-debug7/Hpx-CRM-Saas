import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';

/**
 * Production-safe health monitoring endpoint.
 * Verifies application and database operational status.
 */
export async function GET() {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const service = "HPX Eigen SaaS CRM";

  try {
    // Verify database connectivity using a lightweight query
    await prisma.$queryRaw`SELECT 1`;

    const responseTime = `${Date.now() - startTime}ms`;

    return NextResponse.json(
      {
        status: "ok",
        service,
        database: "connected",
        responseTime,
        timestamp,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json(
      {
        status: "error",
        service,
        database: "disconnected",
        message: "Database connection failed",
        timestamp,
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  }
}

/**
 * Ensure the endpoint is runtime-evaluated and not statically optimized or cached.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;
