import type { EmailProvider } from './EmailProvider';
import type { EmailThreadSummary, EmailMessageMeta, SyncResult, ThreadListParams, TokenSet, SendEmailPayload, SendEmailResult } from '../types';
import type { EmailAccount } from '.prisma/client';
import { decryptString } from '../crypto';
import { getEnv } from '@/lib/server/env';
const env = getEnv();

const OUTLOOK_AUTH_BASE = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const OUTLOOK_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

function getClientId(): string {
  return process.env.MICROSOFT_CLIENT_ID || '';
}

function getClientSecret(): string {
  return process.env.MICROSOFT_CLIENT_SECRET || '';
}

function getRedirectUri(): string {
  return `${process.env.BASE_URL || ''}/api/oauth/microsoft/callback`;
}

function getAccessToken(account: EmailAccount): string {
  return decryptString(account.accessTokenEncrypted);
}

async function graphFetch<T>(account: EmailAccount, url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${getAccessToken(account)}`,
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph API error: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

function groupMessages(messages: any[]): { threads: EmailThreadSummary[]; messagesByThread: Record<string, EmailMessageMeta[]> } {
  const threadsMap = new Map<string, EmailMessageMeta[]>();
  for (const msg of messages) {
    const meta: EmailMessageMeta = {
      providerMessageId: msg.id,
      from: msg.from?.emailAddress?.address,
      to: msg.toRecipients?.map((r: any) => r.emailAddress?.address).filter(Boolean).join(', '),
      cc: msg.ccRecipients?.map((r: any) => r.emailAddress?.address).filter(Boolean).join(', '),
      bcc: msg.bccRecipients?.map((r: any) => r.emailAddress?.address).filter(Boolean).join(', '),
      subject: msg.subject,
      snippet: msg.bodyPreview,
      sentAt: msg.receivedDateTime ? new Date(msg.receivedDateTime) : undefined,
      isRead: msg.isRead,
      hasAttachments: msg.hasAttachments,
    };
    const conversationId = msg.conversationId || msg.id;
    const existing = threadsMap.get(conversationId) || [];
    existing.push(meta);
    threadsMap.set(conversationId, existing);
  }

  const threads: EmailThreadSummary[] = [];
  const messagesByThread: Record<string, EmailMessageMeta[]> = {};

  for (const [conversationId, msgs] of threadsMap.entries()) {
    const lastMessage = msgs.reduce<EmailMessageMeta | null>((latest, msg) => {
      if (!msg.sentAt) return latest;
      if (!latest || !latest.sentAt || msg.sentAt > latest.sentAt) return msg;
      return latest;
    }, null);

    const unreadCount = msgs.filter((m) => m.isRead === false).length;
    threads.push({
      providerThreadId: conversationId,
      subject: lastMessage?.subject,
      snippet: lastMessage?.snippet,
      lastMessageAt: lastMessage?.sentAt,
      unreadCount,
      hasAttachments: msgs.some((m) => m.hasAttachments),
      folder: 'inbox',
    });
    messagesByThread[conversationId] = msgs;
  }

  return { threads, messagesByThread };
}

export const OutlookProvider: EmailProvider = {
  name: 'outlook',

  getAuthUrl(userId: string): string {
    const scope = [
      'offline_access',
      'https://graph.microsoft.com/Mail.ReadBasic',
      'https://graph.microsoft.com/Mail.ReadWrite',
      'https://graph.microsoft.com/Mail.Send',
      'https://graph.microsoft.com/User.Read',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: getClientId(),
      response_type: 'code',
      redirect_uri: getRedirectUri(),
      response_mode: 'query',
      scope,
      state: userId,
    });

    return `${OUTLOOK_AUTH_BASE}?${params.toString()}`;
  },

  async exchangeCodeForTokens(code: string): Promise<TokenSet> {
    const body = new URLSearchParams({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: getRedirectUri(),
      code,
      grant_type: 'authorization_code',
    });

    const res = await fetch(OUTLOOK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Outlook token exchange failed: ${text}`);
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
      throw new Error('No refresh token available for Outlook account');
    }
    const refreshToken = decryptString(account.refreshTokenEncrypted);
    const body = new URLSearchParams({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      refresh_token: refreshToken,
      redirect_uri: getRedirectUri(),
      grant_type: 'refresh_token',
    });

    const res = await fetch(OUTLOOK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Outlook refresh failed: ${text}`);
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
    const url = cursor || `${GRAPH_BASE}/me/messages/delta?$top=50&$select=id,conversationId,subject,bodyPreview,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,isRead,hasAttachments`;
    const data = await graphFetch<any>(account, url);
    const { threads, messagesByThread } = groupMessages(data.value || []);
    const nextCursor = data['@odata.deltaLink'] || data['@odata.nextLink'] || cursor;

    return { threads, messagesByThread, cursor: nextCursor };
  },

  async listThreads(account: EmailAccount, params: ThreadListParams): Promise<SyncResult> {
    const top = params.limit || 50;
    const url = `${GRAPH_BASE}/me/messages?$top=${top}&$select=id,conversationId,subject,bodyPreview,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,isRead,hasAttachments`;
    const data = await graphFetch<any>(account, url);
    const { threads, messagesByThread } = groupMessages(data.value || []);
    return { threads, messagesByThread, cursor: null };
  },

  async sendEmail(account: EmailAccount, payload: SendEmailPayload): Promise<SendEmailResult> {
    const message = {
      subject: payload.subject,
      body: {
        contentType: 'Text',
        content: payload.bodyText || '',
      },
      toRecipients: payload.to.map((address) => ({ emailAddress: { address } })),
      ccRecipients: payload.cc?.map((address) => ({ emailAddress: { address } })) || [],
      bccRecipients: payload.bcc?.map((address) => ({ emailAddress: { address } })) || [],
    };

    await graphFetch(account, `${GRAPH_BASE}/me/sendMail`, {
      method: 'POST',
      body: JSON.stringify({ message, saveToSentItems: true }),
    });

    return {
      providerMessageId: `outlook-${Date.now()}`,
      sentAt: new Date(),
    };
  },

  async markRead(account: EmailAccount, messageId: string): Promise<void> {
    await graphFetch(account, `${GRAPH_BASE}/me/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isRead: true }),
    });
  },
};
