import { PrismaClient, Prisma } from '@prisma/client';
export { Prisma };
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { getEnv } from '@/lib/env';
const env = getEnv();

// Singleton pattern for PrismaClient to avoid multiple instances in development
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

// Use pg adapter for Prisma 7
const connectionString = env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        adapter,
        log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

if (env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

export function scopedPrisma(companyId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const a = args as any;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const db = prisma as any;

          // ─── Single-record: findUnique → findFirst ─────────────────────────
          // findUnique requires a unique-constraint where clause; we can't safely
          // add companyId to a unique index. Convert to findFirst instead.
          if (operation === "findUnique") {
            return db[model].findFirst({
              ...a,
              where: {
                ...(a.where ?? {}),
                companyId,
              },
            });
          }

          // ─── Single-record: findFirst ──────────────────────────────────────
          if (operation === "findFirst") {
            a.where = {
              ...(a.where ?? {}),
              companyId,
            };
            return query(a);
          }

          // ─── Single-record: update → updateMany + findFirst ───────────────
          // updateMany enforces companyId in WHERE; findFirst restores the
          // single-object return type callers expect from a normal update().
          if (operation === "update") {
            const scopedWhere = { ...(a.where ?? {}), companyId };

            const result = await db[model].updateMany({
              where: scopedWhere,
              data: a.data,
            });

            if (result.count === 0) {
              throw new Error("Record not found or access denied");
            }

            return db[model].findFirst({ where: scopedWhere });
          }

          // ─── Single-record: delete → deleteMany ───────────────────────────
          if (operation === "delete") {
            return db[model].deleteMany({
              where: {
                ...(a.where ?? {}),
                companyId,
              },
            });
          }

          // ─── upsert ───────────────────────────────────────────────────────
          if (operation === "upsert") {
            return db[model].upsert({
              ...a,
              where: {
                ...(a.where ?? {}),
                companyId,
              },
              update: a.update,
              create: {
                ...(a.create ?? {}),
                companyId,
              },
            });
          }

          // ─── Bulk reads / aggregates ───────────────────────────────────────
          const operationsWithWhere = [
            "findMany",
            "updateMany",
            "deleteMany",
            "count",
            "aggregate",
          ];

          if (operationsWithWhere.includes(operation)) {
            a.where = {
              ...(a.where ?? {}),
              companyId,
            };
          }

          // ─── Creates ──────────────────────────────────────────────────────
          const operationsWithData = ["create", "createMany"];

          if (operationsWithData.includes(operation)) {
            if (Array.isArray(a.data)) {
              a.data = a.data.map((item: any) => ({
                ...item,
                companyId,
              }));
            } else {
              a.data = {
                ...a.data,
                companyId,
              };
            }
          }

          return query(a);
        },
      },
    },
  });
}

export default prisma;
