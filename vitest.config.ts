import { defineConfig } from 'vitest/config';
import path from 'path';
import { config } from 'dotenv';

// Load built-in env variables from .env.test or fallback to .env
config({ path: path.resolve(__dirname, process.env.NODE_ENV === 'test' ? '.env.test' : '.env') });

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        globalSetup: ['vitest.setup.ts'],
        env: {
            NODE_ENV: 'test',
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './'),
            '.prisma/client': path.resolve(__dirname, './node_modules/.prisma/client'),
        },
    },
});
