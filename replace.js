const fs = require('fs');
const path = require('path');

const files = [
    "vitest.setup.ts",
    "vitest.config.ts",
    "prisma.config.ts",
    "prisma/seed.ts",
    "next.config.ts",
    "app/utils/storageErrorLogger.ts",
    "app/utils/productionLogger.ts",
    "app/utils/errorRecovery.ts",
    "app/utils/debugLogger.ts",
    "app/upcoming/page.tsx",
    "app/follow-up-mandate/page.tsx",
    "app/hooks/usePerformance.ts",
    "app/due-today/page.tsx",
    "app/dashboard/page.tsx",
    "app/context/LeadContext.tsx",
    "app/context/ColumnContext.tsx",
    "app/components/StorageDebugPanel.tsx",
    "app/components/LeadTable.tsx",
    "app/components/email/EmailHeaderInbox.tsx",
    "app/components/ErrorBoundary.tsx",
    "app/constants/__tests__/districtTalukaData.test.ts",
    "app/constants/districtTalukaData.ts",
    "app/all-leads/page.tsx",
    "app/add-lead/page.tsx"
];

const replacedFiles = [];

for (const f of files) {
    const fullPath = path.join(__dirname, f);
    if (!fs.existsSync(fullPath)) {
        console.log("Missing:", f);
        continue;
    }
    let content = fs.readFileSync(fullPath, 'utf8');
    let original = content;

    if (content.includes('process.env')) {
        if (!content.includes('import { env }')) {
            const imports = [...content.matchAll(/^import.*from.*/gm)];
            if (imports.length > 0) {
                const lastImport = imports[imports.length - 1];
                const insertPos = lastImport.index + lastImport[0].length;
                content = content.slice(0, insertPos) + '\nimport { env } from '@/lib/server/env';' + content.slice(insertPos);
            } else {
                content = `import { env } from '@/lib/server/env';\n` + content;
            }
        }

        content = content.replace(/process\.env\.([A-Za-z0-9_]+)\s*(?:\|\||\?\?)\s*(?:'[^']*'|"[^"]*"|`[^`]*`|\d+|true|false)/g, 'env.$1');
        content = content.replace(/process\.env\.([A-Za-z0-9_]+)/g, 'env.$1');
        content = content.replace(/process\.env/g, 'env');

        if (content !== original) {
            fs.writeFileSync(fullPath, content, 'utf8');
            replacedFiles.push(f);
        }
    }
}

fs.writeFileSync('replaced.txt', replacedFiles.join('\n'));
console.log("Done. Replaced files:");
console.log(replacedFiles.join('\n'));
