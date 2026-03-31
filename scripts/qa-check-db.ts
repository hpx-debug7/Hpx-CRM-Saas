import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

for (const f of ['.env.local', '.env']) {
    try {
        for (const line of readFileSync(resolve(process.cwd(), f), 'utf-8').split(/\r?\n/)) {
            const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
            if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])([\s\S]*)\1$/, '$2');
        }
    } catch {}
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) } as any);

async function main() {
    const user = await prisma.user.findFirst({
        where: { username: 'hp' },
        select: { id: true, companyId: true, role: true },
    });
    console.log('USER:', JSON.stringify(user));

    const invites = await (prisma as any).invitation.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
    });
    console.log('INVITE_COUNT:', invites.length);

    for (const i of invites) {
        const tokenOk    = typeof i.token === 'string' && i.token.length >= 64;
        const expiresOk  = new Date(i.expiresAt) > new Date();
        const companyMatch  = user ? i.companyId === user.companyId : false;
        const inviterMatch  = user ? i.invitedById === user.id      : false;
        console.log('INVITE:', JSON.stringify({
            email: i.email, status: i.status, role: i.role,
            tokenLen: i.token?.length, tokenOk,
            expiresOk, companyMatch, inviterMatch,
            companyId: i.companyId, invitedById: i.invitedById,
        }));
    }
}

main()
    .catch(e => { console.error('ERR:', e.message); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); await pool.end(); });
