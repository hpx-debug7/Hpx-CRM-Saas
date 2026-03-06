const fs = require('fs');
const path = require('path');

function walk(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
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

const targetDirs = ['app/utils', 'app/constants', 'app/types'];
let count = 0;

for (const d of targetDirs) {
    const files = walk(d);
    for (const file of files) {
        let content = fs.readFileSync(file, 'utf8');
        if (content.includes('@/lib/server/logger')) {
            content = content.replace(/['"]@\/lib\/server\/logger['"]/g, "'@/lib/client/logger'");
            fs.writeFileSync(file, content, 'utf8');
            count++;
        }
    }
}
console.log(`Replaced logger in ${count} files.`);
