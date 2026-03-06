const fs = require('fs');
const path = require('path');

function walk(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'api' || file === 'actions') continue; // Skip server folders
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            walk(filePath, fileList);
        } else {
            if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
                fileList.push(filePath);
            }
        }
    }
    return fileList;
}

const files = walk('app');
const serverModules = ['env', 'db', 'auth', 'rateLimiter', 'secureHandler', 'tenantScope', 'userLookup', 'logger'];

let found = false;
for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const mod of serverModules) {
        if (content.includes(`@/lib/server/${mod}`) || content.includes(`../lib/server/${mod}`)) {
            console.log(`Leak found in ${file}: importing ${mod}`);
            found = true;
        }
    }
}
if (!found) console.log("No leaks found.");
