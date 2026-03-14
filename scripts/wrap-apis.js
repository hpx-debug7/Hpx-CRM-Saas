const { Project, SyntaxKind } = require('ts-morph');
const path = require('path');

const project = new Project();
project.addSourceFilesAtPaths('app/api/**/route.ts');

const sourceFiles = project.getSourceFiles();

for (const sourceFile of sourceFiles) {
  // Skip if already has withApiLogging
  let hasImport = false;
  for (const imp of sourceFile.getImportDeclarations()) {
    if (imp.getModuleSpecifierValue() === '@/lib/apiLogger') {
      hasImport = true;
    }
  }

  if (hasImport) {
    console.log(`Skipping ${sourceFile.getFilePath()} (already has import)`);
    continue;
  }

  // Add import
  sourceFile.addImportDeclaration({
    namedImports: ['withApiLogging'],
    moduleSpecifier: '@/lib/apiLogger'
  });

  // Find all exported async functions GET, POST, PUT, DELETE, PATCH
  const functions = sourceFile.getFunctions().filter(f => f.isExported() && f.isAsync());
  let modified = false;

  for (const func of functions) {
    const name = func.getName();
    if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(name)) continue;

    // Get parameters
    const params = func.getParameters();
    let reqParamName = 'req';
    
    // If no Request parameter, add it
    if (params.length === 0) {
      func.addParameter({ name: 'req', type: 'Request' });
    } else {
      reqParamName = params[0].getName();
      // If it's a destructuring parameter (rare for Request, but just in case)
      if (reqParamName.startsWith('{')) reqParamName = reqParamName; // Might fail, but typically it's req or request
    }

    // Get body text
    const body = func.getBody();
    if (!body) continue;

    const bodyText = body.getText();
    // bodyText includes `{ ... }`
    const innerText = bodyText.substring(1, bodyText.length - 1);
    
    func.setBodyText(`return withApiLogging(${reqParamName}, async (requestId) => {${innerText}\n});`);
    modified = true;
  }

  // Also check arrow functions if any `export const POST = async (req: Request) => {}`
  const varDecls = sourceFile.getVariableDeclarations();
  for (const varDecl of varDecls) {
    if (!varDecl.isExported()) continue;
    const name = varDecl.getName();
    if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(name)) continue;

    const init = varDecl.getInitializer();
    if (init && (init.getKind() === SyntaxKind.ArrowFunction || init.getKind() === SyntaxKind.FunctionExpression)) {
      const params = init.getParameters();
      let reqParamName = 'req';
      if (params.length === 0) {
        init.addParameter({ name: 'req', type: 'Request' });
      } else {
        reqParamName = params[0].getName();
      }

      const body = init.getBody();
      if (!body) continue;

      if (body.getKind() === SyntaxKind.Block) {
        const bodyText = body.getText();
        const innerText = bodyText.substring(1, bodyText.length - 1);
        const newBodyText = `{ return withApiLogging(${reqParamName}, async (requestId) => {${innerText}\n}); }`;
        init.replaceWithText(`async (${init.getParameters().map(p => p.getText()).join(', ')}) => ${newBodyText}`);
      } else {
        // expression body
        const innerText = body.getText();
        const newBodyText = `{ return withApiLogging(${reqParamName}, async (requestId) => { return ${innerText}; }); }`;
        init.replaceWithText(`async (${init.getParameters().map(p => p.getText()).join(', ')}) => ${newBodyText}`);
      }
      modified = true;
    }
  }

  if (modified) {
    console.log(`Modified ${sourceFile.getFilePath()}`);
  }
}

project.saveSync();
console.log('Done!');
