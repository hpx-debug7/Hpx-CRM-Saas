import type { EmailProviderName, TokenSet, SyncResult, ThreadListParams, SendEmailPayload, SendEmailResult } from '../types';
import type { EmailAccount } from '.prisma/client';

export interface EmailProvider {
  name: EmailProviderName;
  getAuthUrl: (userId: string) => string;
  exchangeCodeForTokens: (code: string) => Promise<TokenSet>;
  refreshTokens: (account: EmailAccount) => Promise<TokenSet>;
  initialSync: (account: EmailAccount) => Promise<SyncResult>;
  syncIncremental: (account: EmailAccount, cursor?: string | null) => Promise<SyncResult>;
  listThreads: (account: EmailAccount, params: ThreadListParams) => Promise<SyncResult>;
  sendEmail: (account: EmailAccount, payload: SendEmailPayload) => Promise<SendEmailResult>;
  markRead: (account: EmailAccount, messageId: string) => Promise<void>;
}
