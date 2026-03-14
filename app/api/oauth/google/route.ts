import { logger } from '@/lib/server/logger';
import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { withApiLogging } from "@/lib/apiLogger";

const env = getEnv();

const OAUTH_BASE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

export async function GET(req: Request) {
    return withApiLogging(req, async (requestId) => {
      try {
        if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_REDIRECT_URI) {
          return NextResponse.json(
            { error: 'Missing required Google OAuth environment variables (GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI)' },
            { status: 500 }
          );
        }

        const params = new URLSearchParams({
          client_id: env.GOOGLE_CLIENT_ID,
          redirect_uri: env.GOOGLE_REDIRECT_URI,
          response_type: 'code',
          scope:
            'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
          access_type: 'offline',
          prompt: 'consent',
        });

        const oauthUrl = `${OAUTH_BASE_URL}?${params.toString()}`;
        logger.info(`Google OAuth URL: ${oauthUrl}`);

        return NextResponse.redirect(oauthUrl);
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? `Failed to start Google OAuth: ${error.message}`
                : 'Failed to start Google OAuth.',
          },
          { status: 500 }
        );
      }

    });
}
