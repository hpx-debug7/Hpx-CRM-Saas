const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

// Files to SKIP (framework config, test infra, electron, scripts, env.ts, logger itself)
const SKIP_FILES = new Set([
    'next.config.ts',
    'vitest.config.ts',
    'vitest.setup.ts',
    'prisma.config.ts',
    'eslint.config.mjs',
]);
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'electron', 'build', '__tests__', 'hpx-eigen-saas', 'src']);
const SKIP_PATTERNS = [/\.test\.ts$/, /\.test\.tsx$/, /\.spec\.ts$/, /EXAMPLE_/, /create-admin\.ts$/];

function walk(dir) {
    let results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results = results.concat(walk(full));
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
            if (SKIP_FILES.has(entry.name)) continue;
            if (SKIP_PATTERNS.some(p => p.test(entry.name))) continue;
            results.push(full);
        }
    }
    return results;
}

const CONSOLE_MAP = {
    'console.log': 'logger.info',
    'console.info': 'logger.info',
    'console.warn': 'logger.warn',
    'console.error': 'logger.error',
    'console.debug': 'logger.debug',
};

const allFiles = walk(ROOT);
const modified = [];

for (const filePath of allFiles) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes('console.')) continue;

    const original = content;

    // Replace console.X( with logger.X(
    // We handle simple single-argument string calls by converting to logger format
    // For complex calls with multiple args or template literals, we wrap data in a meta object
    for (const [consoleCall, loggerCall] of Object.entries(CONSOLE_MAP)) {
        // Pattern: console.log('message', data) or console.error('msg', error)
        // We use a simple regex to replace the function name only
        const escaped = consoleCall.replace('.', '\\.');
        const re = new RegExp(escaped + '\\(', 'g');
        content = content.replace(re, loggerCall + '(');
    }

    if (content === original) continue;

    // Add logger import if not already present
    if (!content.includes("from '@/lib/client/logger'") && !content.includes('from '@/lib/client/logger'') && !content.includes("from '@/src/lib/logger'")) {
        // Find first import or 'use server'/'use client' directive
        const useDirectiveMatch = content.match(/^(['"]use (server|client)['"];?\s*\n)/);
        const importMatch = content.match(/^import\s/m);

        const importLine = "import { logger } from '@/lib/client/logger';\n";

        if (useDirectiveMatch) {
            const insertAfter = useDirectiveMatch[0];
            content = content.replace(insertAfter, insertAfter + '\n' + importLine);
        } else if (importMatch && importMatch.index !== undefined) {
            content = content.slice(0, importMatch.index) + importLine + content.slice(importMatch.index);
        } else {
            content = importLine + '\n' + content;
        }
    }

    fs.writeFileSync(filePath, content, 'utf8');
    const rel = path.relative(ROOT, filePath);
    modified.push(rel);
}

console.log('Modified files:');
modified.forEach(f => console.log('  ' + f));
console.log(`\nTotal: ${modified.length} files`);
