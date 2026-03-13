import type { EmailProvider } from './EmailProvider';
import type { EmailThreadSummary, EmailMessageMeta, SyncResult, ThreadListParams, TokenSet, SendEmailPayload, SendEmailResult } from '../types';
import type { EmailAccount } from '.prisma/client';
import { decryptString } from '../crypto';
import { getEnv } from '@/lib/env';
const env = getEnv();

const GMAIL_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const GMAIL_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

function getClientId(): string {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID is missing. Set it in the server environment.');
  }
  return env.GOOGLE_CLIENT_ID;
}

function getClientSecret(): string {
  if (!env.GOOGLE_CLIENT_SECRET) {
    throw new Error('GOOGLE_CLIENT_SECRET is missing. Set it in the server environment.');
  }
  return env.GOOGLE_CLIENT_SECRET;
}

function getRedirectUri(): string {
  if (env.GOOGLE_REDIRECT_URI) {
    return env.GOOGLE_REDIRECT_URI;
  }
  return `${env.BASE_URL || ''}/api/oauth/google/callback`;
}

function getAccessToken(account: EmailAccount): string {
  return decryptString(account.accessTokenEncrypted);
}

function parseHeader(headers: { name: string; value: string }[], name: string): string | undefined {
  const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return header?.value;
}

async function gmailFetch<T>(account: EmailAccount, url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getAccessToken(account)}`,
    },
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gmail API error: ${res.status} ${errorText}`);
  }
  return res.json() as Promise<T>;
}

async function fetchThread(account: EmailAccount, threadId: string): Promise<{ thread: EmailThreadSummary; messages: EmailMessageMeta[] }> {
  const data = await gmailFetch<any>(account, `${GMAIL_API_BASE}/threads/${threadId}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Bcc&metadataHeaders=Subject&metadataHeaders=Date`);

  const messages: EmailMessageMeta[] = (data.messages || []).map((msg: any) => {
    const headers = msg.payload?.headers || [];
    const labelIds: string[] = msg.labelIds || [];
    return {
      providerMessageId: msg.id,
      from: parseHeader(headers, 'From'),
      to: parseHeader(headers, 'To'),
      cc: parseHeader(headers, 'Cc'),
      bcc: parseHeader(headers, 'Bcc'),
      subject: parseHeader(headers, 'Subject'),
      snippet: msg.snippet,
      sentAt: msg.internalDate ? new Date(Number(msg.internalDate)) : undefined,
      isRead: !labelIds.includes('UNREAD'),
      hasAttachments: Boolean(msg.payload?.parts?.some((p: any) => p.filename)),
    };
  });

  const unreadCount = messages.filter((m) => m.isRead === false).length;
  const lastMessage = messages.reduce<EmailMessageMeta | null>((latest, msg) => {
    if (!msg.sentAt) return latest;
    if (!latest || !latest.sentAt || msg.sentAt > latest.sentAt) return msg;
    return latest;
  }, null);

  const folder = (data.messages?.[0]?.labelIds || []).includes('SENT') ? 'sent' : 'inbox';

  const thread: EmailThreadSummary = {
    providerThreadId: data.id,
    subject: lastMessage?.subject,
    snippet: lastMessage?.snippet || data.snippet,
    lastMessageAt: lastMessage?.sentAt,
    unreadCount,
    hasAttachments: messages.some((m) => m.hasAttachments),
    folder,
  };

  return { thread, messages };
}

export const GmailProvider: EmailProvider = {
  name: 'gmail',

  getAuthUrl(userId: string): string {
    const scope = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: getClientId(),
      redirect_uri: getRedirectUri(),
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope,
      state: userId,
    });

    return `${GMAIL_AUTH_BASE}?${params.toString()}`;
  },

  async exchangeCodeForTokens(code: string): Promise<TokenSet> {
    const body = new URLSearchParams({
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: getRedirectUri(),
      grant_type: 'authorization_code',
    });

    const res = await fetch(GMAIL_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gmail token exchange failed: ${text}`);
    }
    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    };
  },

  async refreshTokens(account: EmailAccount): Promise<TokenSet> {
    if (!account.refreshTokenEncrypted) {
      throw new Error('No refresh token available for Gmail account');
    }
    const refreshToken = decryptString(account.refreshTokenEncrypted);
    const body = new URLSearchParams({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const res = await fetch(GMAIL_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gmail refresh failed: ${text}`);
    }
    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    };
  },

  async initialSync(account: EmailAccount): Promise<SyncResult> {
    return this.listThreads(account, { limit: 50 });
  },

  async syncIncremental(account: EmailAccount, cursor?: string | null): Promise<SyncResult> {
    if (!cursor) {
      return this.listThreads(account, { limit: 25 });
    }

    const history = await gmailFetch<any>(account, `${GMAIL_API_BASE}/history?startHistoryId=${cursor}&historyTypes=messageAdded&historyTypes=labelAdded`);
    const threadIds = new Set<string>();
    for (const item of history.history || []) {
      for (const msg of item.messages || []) {
        if (msg.threadId) threadIds.add(msg.threadId);
      }
    }

    const threads: EmailThreadSummary[] = [];
    const messagesByThread: Record<string, EmailMessageMeta[]> = {};

    for (const threadId of threadIds) {
      const { thread, messages } = await fetchThread(account, threadId);
      threads.push(thread);
      messagesByThread[thread.providerThreadId] = messages;
    }

    return {
      threads,
      messagesByThread,
      cursor: history.historyId || cursor,
    };
  },

  async listThreads(account: EmailAccount, params: ThreadListParams): Promise<SyncResult> {
    const maxResults = params.limit || 50;
    const list = await gmailFetch<any>(account, `${GMAIL_API_BASE}/threads?maxResults=${maxResults}`);

    const threads: EmailThreadSummary[] = [];
    const messagesByThread: Record<string, EmailMessageMeta[]> = {};

    for (const thread of list.threads || []) {
      const data = await fetchThread(account, thread.id);
      threads.push(data.thread);
      messagesByThread[data.thread.providerThreadId] = data.messages;
    }

    return {
      threads,
      messagesByThread,
      cursor: list.historyId,
    };
  },

  async sendEmail(account: EmailAccount, payload: SendEmailPayload): Promise<SendEmailResult> {
    const raw = [
      `To: ${payload.to.join(', ')}`,
      payload.cc && payload.cc.length ? `Cc: ${payload.cc.join(', ')}` : '',
      payload.bcc && payload.bcc.length ? `Bcc: ${payload.bcc.join(', ')}` : '',
      `Subject: ${payload.subject}`,
      '',
      payload.bodyText || '',
    ]
      .filter(Boolean)
      .join('\r\n');

    const encoded = Buffer.from(raw)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await fetch(`${GMAIL_API_BASE}/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getAccessToken(account)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encoded }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gmail send failed: ${text}`);
    }

    const data = await res.json();
    return {
      providerMessageId: data.id,
      providerThreadId: data.threadId,
      sentAt: new Date(),
    };
  },

  async markRead(account: EmailAccount, messageId: string): Promise<void> {
    const res = await fetch(`${GMAIL_API_BASE}/messages/${messageId}/modify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getAccessToken(account)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gmail mark read failed: ${text}`);
    }
  },
};
