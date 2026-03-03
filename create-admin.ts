import 'dotenv/config';
import { prisma } from './lib/db';
import bcrypt from 'bcryptjs';

async function main() {
    try {
        console.log('Creating admin user...');

        // 1. Create a default company if none exists
        let company = await prisma.company.findFirst({
            where: { slug: 'admin-company' }
        });

        if (!company) {
            company = await prisma.company.create({
                data: {
                    name: 'Admin Company',
                    slug: 'admin-company',
                    domain: 'admin.example.com',
                }
            });
            console.log('Created new company:', company.name);
        } else {
            console.log('Using existing company:', company.name);
        }

        // 2. Hash password
        const passwordHash = await bcrypt.hash('Admin@123', 10);

        // 3. Create or update admin user
        const adminEmail = 'admin@example.com';

        let user = await prisma.user.findFirst({
            where: { email: adminEmail }
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    companyId: company.id,
                    username: 'admin',
                    name: 'System Admin',
                    email: adminEmail,
                    password: passwordHash,
                    role: 'ADMIN',
                    isActive: true
                }
            });
            console.log('Created new admin user:', user.email);
        } else {
            user = await prisma.user.update({
                where: { id: user.id },
                data: {
                    password: passwordHash,
                    role: 'ADMIN'
                }
            });
            console.log('Updated existing admin user:', user.email);
        }

        console.log('\n--- ADMIN CREDENTIALS ---');
        console.log('Email:   ', adminEmail);
        console.log('Password:', 'Admin@123');
        console.log('Role:    ', user.role);
        console.log('-------------------------\n');

    } catch (error) {
        console.error('Error creating admin:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
