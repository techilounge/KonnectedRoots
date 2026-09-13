const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.resolve(__dirname, '../../src/app/tree/[treeId]/page.tsx'), 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['handleAddPerson', 'handleConfirmDelete', 'handleMergeDuplicates'];
const declarations = new Map();
function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && names.includes(node.name.text)) {
    declarations.set(node.name.text, `const ${node.getText(ast)};`);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
for (const name of names) if (!declarations.has(name)) throw Error(`Missing actual tree handler ${name}`);

// Execute the actual page handlers, not a copy of their mutations. The Rules suite
// supplies the real browser Firestore SDK; root tests inject faulting batches.
function treeHandlers(overrides) {
  const noop = () => {};
  const scope = {
    user: {uid: 'synthetic-owner'}, readOnly: false, treeId: 'synthetic-tree',
    resolvedTreeId: 'synthetic-tree', people: [], selectedPerson: null, personToDelete: null,
    pushCommand: noop, toast: noop, setSelectedPerson: noop, handleCloseDeleteDialog: noop,
    saveLayoutSnapshot: async () => 'synthetic-snapshot', detectDuplicates: () => ({matches: []}),
    setDuplicateResult: noop, console: {error: noop, warn: noop}, ...overrides,
  };
  const code = ts.transpileModule([...declarations.values()].join('\n') + `\nreturn {${names.join(',')}};`, {
    compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None},
  }).outputText;
  return new Function(...Object.keys(scope), code)(...Object.values(scope));
}
module.exports = {treeHandlers, source, ast};
