const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = {exports: {}};
new Function('exports', 'module', ts.transpileModule(fs.readFileSync('src/lib/tree-export.ts', 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS},
}).outputText)(mod.exports, mod);
const {treeExportFrame} = mod.exports;

test('export frame includes negative coordinates and distant nodes with border padding', () => {
  const frame = treeExportFrame({x: -1400, y: -800, width: 6200, height: 3400});
  assert.ok(frame.x < -1400 && frame.y < -800);
  assert.ok(frame.x + frame.width > 4800);
  assert.ok(frame.y + frame.height > 2600);
});

test('large wide and tall trees stay within raster memory and dimension limits', () => {
  for (const [width, height] of [[100000, 300], [300, 100000], [50000, 50000]]) {
    const frame = treeExportFrame({x: 0, y: 0, width, height});
    assert.ok(frame.width * frame.scale <= 16384);
    assert.ok(frame.height * frame.scale <= 16384);
    assert.ok(frame.width * frame.height * frame.scale ** 2 <= 16000001);
    assert.ok(frame.scale > 0);
  }
});
