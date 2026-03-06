export default function setup() {
    (process.env as any).NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-for-vitest-only-do-not-use-in-prod';
    process.env.EMAIL_ENCRYPTION_KEY = 'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcw==';
    console.log('\n⏳ Test Environment Initialized. Migrations are now handled by package.json scripts.');
}
