import { prisma } from '../lib/db';
import { runIncrementalSync } from '../app/lib/email/syncEngine';

async function main() {
  const accounts = await prisma.emailAccount.findMany({
    where: { status: 'ACTIVE' },
  });

  for (const account of accounts) {
    const state = await prisma.emailWebhookState.findFirst({
      where: { userId: account.userId, provider: account.provider },
    });
    await runIncrementalSync(account, account.provider === 'gmail' ? state?.lastHistoryId : state?.lastDeltaToken);
  }
}

main()
  .catch((err) => {
    console.error('Email sync cron failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
