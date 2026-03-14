import { NextResponse } from 'next/server';
import { ApiError, InternalServerError } from './errors';
import { logger } from './logger';

export function handleError(
  error: unknown,
  context?: Record<string, any>
): NextResponse {
  let apiError: ApiError;

  if (error instanceof ApiError) {
    apiError = error;
  } else {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    apiError = new InternalServerError(message);
    if (error instanceof Error && error.stack) {
      apiError.stack = error.stack;
    }
  }

  logger.error('API Request Error', {
    ...context,
    status: apiError.statusCode,
    code: apiError.code,
    message: apiError.message,
    stack: apiError.stack,
  });

  const isDevelopment = process.env.NODE_ENV === 'development';

  const errorResponse: any = {
    error: {
      code: apiError.code,
      message: apiError.message,
    },
  };

  if (isDevelopment && apiError.stack) {
    errorResponse.error.stack = apiError.stack;
  }

  return NextResponse.json(errorResponse, { status: apiError.statusCode });
}
