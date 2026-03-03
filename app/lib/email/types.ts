export type EmailProviderName = 'gmail' | 'outlook';

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface EmailThreadSummary {
  providerThreadId: string;
  subject?: string;
  snippet?: string;
  lastMessageAt?: Date;
  unreadCount?: number;
  hasAttachments?: boolean;
  folder?: string;
}

export interface EmailMessageMeta {
  providerMessageId: string;
  from?: string;
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  snippet?: string;
  sentAt?: Date;
  isRead?: boolean;
  hasAttachments?: boolean;
  attachmentsMeta?: string;
}

export interface SyncResult {
  threads: EmailThreadSummary[];
  messagesByThread: Record<string, EmailMessageMeta[]>;
  cursor?: string;
}

export interface ThreadListParams {
  limit?: number;
  cursor?: string;
  folder?: string;
}

export interface SendEmailPayload {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyText?: string;
}

export interface SendEmailResult {
  providerMessageId: string;
  providerThreadId?: string;
  sentAt: Date;
}
