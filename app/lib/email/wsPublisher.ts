import { env } from '@/lib/env';

const WS_PUBLISH_URL = env.WS_PUBLISH_URL;
const WS_PUBLISH_SECRET = env.WS_PUBLISH_SECRET;

export async function publishEmailEvent(
  userId: string,
  event: 'email:new' | 'email:read' | 'email:sent' | 'email:connected',
  data: Record<string, unknown>
): Promise<void> {
  if (!WS_PUBLISH_SECRET) {
    console.warn('WS_PUBLISH_SECRET is not set; skipping WS publish');
    return;
  }

  const payload = {
    channel: `user:${userId}`,
    event,
    data,
  };

  try {
    await fetch(WS_PUBLISH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WS_PUBLISH_SECRET}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('Failed to publish WS event:', error);
  }
}
