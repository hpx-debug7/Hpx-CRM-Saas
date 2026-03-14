import { logger } from './logger';
import { handleError } from './apiErrorHandler';

function classifyPerformance(duration: number): 'fast' | 'normal' | 'slow' {
  if (duration > 1000) return 'slow';
  if (duration > 200) return 'normal';
  return 'fast';
}

export async function withApiLogging(
  req: Request,
  handler: (requestId: string) => Promise<Response>
): Promise<Response> {
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
  const method = req.method;

  let path = req.url;
  try {
    // If the url is absolute, this will succeed
    const url = new URL(req.url);
    path = url.pathname;
  } catch (e) {
    // Fallback if URL parsing fails (e.g. relative URL string)
    if (req.url.startsWith('/')) {
      path = req.url.split('?')[0];
    }
  }

  const startHrTime = process.hrtime.bigint();

  try {
    const response = await handler(requestId);
    const endHrTime = process.hrtime.bigint();
    const duration = Math.round(Number(endHrTime - startHrTime) / 1_000_000);

    const performance = classifyPerformance(duration);

    let finalResponse = response;
    try {
      if (!response.headers.has('x-request-id')) {
        response.headers.set('x-request-id', requestId);
      }
      response.headers.set('x-response-time', `${duration}ms`);
    } catch (headerError) {
      // Headers might be immutable, clone the response
      const newHeaders = new Headers(response.headers);
      newHeaders.set('x-request-id', requestId);
      newHeaders.set('x-response-time', `${duration}ms`);
      finalResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    }

    if (performance === 'slow') {
      logger.warn('Slow API Request', {
        requestId,
        method,
        path,
        status: finalResponse.status,
        duration,
        performance,
      });
    } else {
      logger.info('API Request', {
        requestId,
        method,
        path,
        status: finalResponse.status,
        duration,
        performance,
      });
    }

    return finalResponse;
  } catch (error: unknown) {
    const endHrTime = process.hrtime.bigint();
    const duration = Math.round(Number(endHrTime - startHrTime) / 1_000_000);

    const performance = classifyPerformance(duration);

    return handleError(error, {
      requestId,
      method,
      path,
      duration,
      performance,
    });
  }
}
