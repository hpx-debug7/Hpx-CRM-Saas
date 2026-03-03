import { prisma } from '@/lib/db';
import { encryptString } from './crypto';
import type { EmailProviderName, TokenSet, SendEmailPayload, SendEmailResult } from './types';
import { GmailProvider } from './providers/GmailProvider';
import { OutlookProvider } from './providers/OutlookProvider';
import type { EmailProvider } from './providers/EmailProvider';

export function getProvider(provider: EmailProviderName): EmailProvider {
  switch (provider) {
    case 'gmail':
      return GmailProvider;
    case 'outlook':
      return OutlookProvider;
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

export async function getAccountForUser(userId: string, provider?: EmailProviderName) {
  if (provider) {
    return prisma.emailAccount.findFirst({
      where: { userId, provider, status: 'ACTIVE' },
    });
  }
  return prisma.emailAccount.findFirst({
    where: { userId, status: 'ACTIVE' },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function upsertAccount(params: {
  userId: string;
  provider: EmailProviderName;
  emailAddress: string;
  providerAccountId?: string | null;
  tokens: TokenSet;
}) {
  const accessTokenEncrypted = encryptString(params.tokens.accessToken);
  const refreshTokenEncrypted = params.tokens.refreshToken ? encryptString(params.tokens.refreshToken) : undefined;

  return prisma.emailAccount.upsert({
    where: { userId_provider: { userId: params.userId, provider: params.provider } },
    update: {
      emailAddress: params.emailAddress,
      providerAccountId: params.providerAccountId || undefined,
      accessTokenEncrypted,
      refreshTokenEncrypted,
      tokenExpiresAt: params.tokens.expiresAt || undefined,
      status: 'ACTIVE',
    },
    create: {
      userId: params.userId,
      provider: params.provider,
      emailAddress: params.emailAddress,
      providerAccountId: params.providerAccountId || undefined,
      accessTokenEncrypted,
      refreshTokenEncrypted,
      tokenExpiresAt: params.tokens.expiresAt || undefined,
      status: 'ACTIVE',
    },
  });
}

export async function ensureValidAccessToken(account: { id: string; provider: EmailProviderName; tokenExpiresAt: Date | null; refreshTokenEncrypted: string | null }) {
  if (!account.tokenExpiresAt || account.tokenExpiresAt.getTime() > Date.now() + 2 * 60 * 1000) {
    return;
  }

  const provider = getProvider(account.provider);
  const refreshed = await provider.refreshTokens(account as any);

  await prisma.emailAccount.update({
    where: { id: account.id },
    data: {
      accessTokenEncrypted: encryptString(refreshed.accessToken),
      refreshTokenEncrypted: refreshed.refreshToken ? encryptString(refreshed.refreshToken) : account.refreshTokenEncrypted || undefined,
      tokenExpiresAt: refreshed.expiresAt || undefined,
    },
  });
}

export async function sendEmailForAccount(account: any, payload: SendEmailPayload): Promise<SendEmailResult> {
  const provider = getProvider(account.provider as EmailProviderName);
  return provider.sendEmail(account, payload);
}
