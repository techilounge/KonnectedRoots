const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const {test} = require('node:test');
const assert = require('node:assert/strict');

function load(file) {
  const cache = new Map();
  function read(name) {
    const target = path.resolve(name);
    if (cache.has(target)) return cache.get(target).exports;
    const module = {exports:{}}; cache.set(target, module);
    const code = ts.transpileModule(fs.readFileSync(target, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
    new Function('require','module','exports',code)((request) => {
      if (request === './constants') return read(path.join(path.dirname(target), 'constants.ts'));
      if (request === './types') return read(path.join(path.dirname(target), 'types.ts'));
      return require(request);
    }, module, module.exports);
    return module.exports;
  }
  return read(path.resolve(file));
}

const plan = load('src/lib/billing/plan.ts');

test('only active and trialing states grant paid access', () => {
  assert.equal(plan.grantsPaidAccess('active', Date.now() + 60_000), true);
  assert.equal(plan.grantsPaidAccess('trialing', Date.now() + 60_000), true);
  for (const status of ['past_due','unpaid','incomplete','incomplete_expired','paused','canceled','none']) {
    assert.equal(plan.grantsPaidAccess(status, Date.now() + 60_000), false, status);
  }
});

test('cancel-at-period-end remains paid until the period expires', () => {
  const end = 2_000;
  assert.equal(plan.grantsPaidAccess('active', end, 1_999), true);
  assert.equal(plan.grantsPaidAccess('active', end, 2_000), false);
});

test('stale paid plan fields resolve to Free', () => {
  assert.equal(plan.effectivePlan({plan:'pro', status:'canceled', currentPeriodEnd:0}), 'free');
  assert.equal(plan.effectivePlan({plan:'family', status:'past_due', currentPeriodEnd:Date.now() + 1_000}), 'free');
  assert.equal(plan.effectivePlan({plan:'pro', status:'active', currentPeriodEnd:0}), 'free');
  assert.equal(plan.effectivePlan({plan:'pro', status:'active', currentPeriodEnd:Date.now() + 1_000}), 'pro');
});
