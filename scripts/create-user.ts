import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

// ── Load .env.local then .env before anything reads process.env ──────────────
// This runs synchronously before main() so DATABASE_URL is available in time.
for (const file of ['.env.local', '.env']) {
    try {
        const lines = readFileSync(resolve(process.cwd(), file), 'utf-8').split(/\r?\n/);
        for (const line of lines) {
            const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
            if (m && !(m[1] in process.env)) {
                // Strip surrounding quotes if present
                process.env[m[1]] = m[2].replace(/^(['"])([\s\S]*)\1$/, '$2');
            }
        }
    } catch {
        // file not found — skip silently
    }
}

// ── Script entry point ────────────────────────────────────────────────────────
async function main(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error(
            'DATABASE_URL is not set. Ensure .env.local or .env exists and contains DATABASE_URL.',
        );
    }

    // Build a standalone PrismaClient with the pg adapter (required for Prisma 7+)
    // We do NOT use lib/server/db.ts here because it validates all env vars at
    // module level via lib/env.ts, which would crash before main() even runs.
    const pool = new Pool({ connectionString: databaseUrl });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter } as any);

    try {
        // ── Step A: Ensure a company exists ─────────────────────────────────
        const company = await prisma.company.upsert({
            where: { slug: 'test-company' },
            update: {},
            create: {
                name: 'Test Company',
                slug: 'test-company',
            },
        });

        console.log(`✔  Company ready: "${company.name}" (${company.id})`);

        // ── Step B: Hash password ────────────────────────────────────────────
        const plainPassword = 'admin123';
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        // ── Step C: Create / update user ─────────────────────────────────────
        const user = await prisma.user.upsert({
            where: {
                companyId_email: {
                    companyId: company.id,
                    email: 'hp@test.com',
                },
            },
            update: {
                password: hashedPassword,
                role: 'ADMIN',
                isActive: true,
            },
            create: {
                companyId: company.id,
                username: 'hp',
                name: 'HP Admin',
                email: 'hp@test.com',
                password: hashedPassword,
                role: 'ADMIN',
                isActive: true,
            },
        });

        // ── Confirmation ─────────────────────────────────────────────────────
        console.log('\n✅  User created successfully:');
        console.log('   Username :', user.username);
        console.log('   Email    :', user.email);
        console.log('   Password :', plainPassword);
        console.log('   Role     :', user.role);
        console.log('   Company  :', company.id);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

main()
    .catch((err: unknown) => {
        console.error('\n❌  Script failed:', err instanceof Error ? err.message : err);
        process.exit(1);
    });
