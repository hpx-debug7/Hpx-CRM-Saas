import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '.prisma/client';
import bcrypt from 'bcryptjs';

// Use same path as prisma.config.ts: "file:./dev.db" (relative to project root)
const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 Seeding database...');

    // Create default admin user
    // YOU MUST CHANGE THIS PASSWORD AFTER FIRST LOGIN!
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    const admin = await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
            username: 'admin',
            name: 'Administrator',
            email: 'admin@company.com',
            password: hashedPassword,
            role: 'ADMIN',
            isActive: true,
        },
    });

    console.log(`✅ Created admin user: ${admin.username} (ID: ${admin.id})`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Password: ${adminPassword} (CHANGE THIS IMMEDIATELY!)`);

    // ========================================================================
    // SEED SYSTEM ROLE PRESETS
    // ========================================================================

    const systemPresets = [
        {
            name: 'Default: Admin',
            description: 'Full access to all features. Mirrors the ADMIN base role.',
            permissions: JSON.stringify({
                'pages.salesDashboard': true, 'pages.processDashboard': true, 'pages.addLead': true, 'pages.allLeads': true, 'pages.reports': true, 'pages.email': true,
                'leads.create': true, 'leads.edit': true, 'leads.delete': true, 'leads.viewAll': true, 'leads.assign': true, 'leads.convertToCase': true,
                'cases.viewAll': true, 'cases.edit': true, 'cases.assign': true, 'cases.updateStatus': true, 'cases.uploadDocuments': true, 'cases.verifyDocuments': true,
                'users.manage': true, 'users.resetPasswords': true, 'users.impersonate': true, 'users.viewAuditLogs': true,
            }),
        },
        {
            name: 'Default: Sales Manager',
            description: 'Lead management, assignment, and sales analytics. Mirrors the SALES_MANAGER base role.',
            permissions: JSON.stringify({
                'pages.salesDashboard': true, 'pages.processDashboard': false, 'pages.addLead': true, 'pages.allLeads': true, 'pages.reports': false, 'pages.email': true,
                'leads.create': true, 'leads.edit': true, 'leads.delete': false, 'leads.viewAll': true, 'leads.assign': true, 'leads.convertToCase': true,
                'cases.viewAll': false, 'cases.edit': false, 'cases.assign': false, 'cases.updateStatus': false, 'cases.uploadDocuments': false, 'cases.verifyDocuments': false,
                'users.manage': false, 'users.resetPasswords': false, 'users.impersonate': false, 'users.viewAuditLogs': false,
            }),
        },
        {
            name: 'Default: Sales Executive',
            description: 'Create and manage own leads, convert to cases. Mirrors the SALES_EXECUTIVE base role.',
            permissions: JSON.stringify({
                'pages.salesDashboard': true, 'pages.processDashboard': false, 'pages.addLead': true, 'pages.allLeads': true, 'pages.reports': false, 'pages.email': true,
                'leads.create': true, 'leads.edit': true, 'leads.delete': false, 'leads.viewAll': false, 'leads.assign': false, 'leads.convertToCase': true,
                'cases.viewAll': false, 'cases.edit': false, 'cases.assign': false, 'cases.updateStatus': false, 'cases.uploadDocuments': false, 'cases.verifyDocuments': false,
                'users.manage': false, 'users.resetPasswords': false, 'users.impersonate': false, 'users.viewAuditLogs': false,
            }),
        },
        {
            name: 'Default: Process Manager',
            description: 'Full case management, reports, and case assignment. Mirrors the PROCESS_MANAGER base role.',
            permissions: JSON.stringify({
                'pages.salesDashboard': false, 'pages.processDashboard': true, 'pages.addLead': false, 'pages.allLeads': false, 'pages.reports': true, 'pages.email': true,
                'leads.create': false, 'leads.edit': false, 'leads.delete': false, 'leads.viewAll': false, 'leads.assign': false, 'leads.convertToCase': false,
                'cases.viewAll': true, 'cases.edit': true, 'cases.assign': true, 'cases.updateStatus': true, 'cases.uploadDocuments': true, 'cases.verifyDocuments': true,
                'users.manage': false, 'users.resetPasswords': false, 'users.impersonate': false, 'users.viewAuditLogs': false,
            }),
        },
        {
            name: 'Default: Process Executive',
            description: 'Manage assigned cases, upload/verify documents. Mirrors the PROCESS_EXECUTIVE base role.',
            permissions: JSON.stringify({
                'pages.salesDashboard': false, 'pages.processDashboard': true, 'pages.addLead': false, 'pages.allLeads': false, 'pages.reports': false, 'pages.email': true,
                'leads.create': false, 'leads.edit': false, 'leads.delete': false, 'leads.viewAll': false, 'leads.assign': false, 'leads.convertToCase': false,
                'cases.viewAll': false, 'cases.edit': true, 'cases.assign': false, 'cases.updateStatus': true, 'cases.uploadDocuments': true, 'cases.verifyDocuments': false,
                'users.manage': false, 'users.resetPasswords': false, 'users.impersonate': false, 'users.viewAuditLogs': false,
            }),
        },
    ];

    for (const preset of systemPresets) {
        await prisma.rolePreset.upsert({
            where: { name: preset.name },
            update: {},
            create: {
                name: preset.name,
                description: preset.description,
                permissions: preset.permissions,
                isSystem: true,
            },
        });
        console.log(`✅ Upserted system preset: ${preset.name}`);
    }

    // Log the seeding event
    await prisma.auditLog.create({
        data: {
            actionType: 'SYSTEM_SEED',
            entityType: 'user',
            entityId: admin.id,
            description: 'Database seeded with initial admin user and system role presets',
            performedByName: 'System',
            hash: 'seed-initial',
        },
    });

    console.log('✅ Database seeded successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
