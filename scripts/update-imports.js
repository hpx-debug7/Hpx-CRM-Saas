const fs = require('fs');
const path = require('path');

const DIRS_TO_SCAN = ['app', 'lib', '__tests__', 'scripts', '.'];

function walk(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'node_modules' || file === '.next' || file === 'dist' || file === 'build') continue;
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            walk(filePath, fileList);
        } else {
            if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
                fileList.push(filePath);
            }
        }
    }
    return fileList;
}

let files = [];
for (const d of DIRS_TO_SCAN) {
    if (d === '.') {
        const rootFiles = fs.readdirSync(d).filter(f => fs.statSync(f).isFile() && (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.jsx')));
        rootFiles.forEach(f => files.push(f));
    } else {
        files = walk(d, files);
    }
}

// Remove duplicates
files = [...new Set(files)];

// Mapping rules
const serverModules = ['env', 'db', 'auth', 'rateLimiter', 'secureHandler', 'tenantScope', 'userLookup'];
const sharedModules = ['validations/auth'];

let updatedCount = 0;

for (const file of files) {
    if (file === 'scripts\\update-imports.js' || file === 'scripts/update-imports.js') continue;

    let content = fs.readFileSync(file, 'utf8');
    let originalContent = content;

    // Check if it's a client component
    const isClient = content.includes('"use client"') || content.includes("'use client'");

    // Replace logger
    if (isClient) {
        content = content.replace(/['"]@\/lib\/logger['"]/g, "'@/lib/client/logger'");
    } else {
        content = content.replace(/['"]@\/lib\/logger['"]/g, "'@/lib/server/logger'");
    }

    // Replace server modules
    for (const mod of serverModules) {
        const regex = new RegExp(`['"]@\\/lib\\/${mod}['"]`, 'g');
        content = content.replace(regex, `'@/lib/server/${mod}'`);
    }

    // Replace shared modules
    for (const mod of sharedModules) {
        const regex = new RegExp(`['"]@\\/lib\\/${mod}['"]`, 'g');
        content = content.replace(regex, `'@/lib/shared/${mod}'`);
    }

    if (content !== originalContent) {
        fs.writeFileSync(file, content, 'utf8');
        updatedCount++;
    }
}

console.log(`Updated imports in ${updatedCount} files.`);
