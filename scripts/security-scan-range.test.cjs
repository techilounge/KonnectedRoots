const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scanScope } = require('./security-scan-range.cjs');
const base = 'a'.repeat(40), head = 'b'.repeat(40), zero = '0'.repeat(40);
test('PR scan excludes base commit and old history, includes every new commit', () => {
  assert.deepEqual(scanScope('pull_request', {pull_request:{base:{sha:base},head:{sha:head}}}),
    {mode:'git',log_opts:`--diff-merges=first-parent ${base}..${head}`});
});
test('push scan excludes before commit without first-parent traversal filtering', () => {
  assert.equal(scanScope('push',{before:base,after:head}).log_opts,`--diff-merges=first-parent ${base}..${head}`);
});
test('first feature-branch push excludes shared default history', () => {
  const result = scanScope('push',{before:zero,after:head,ref:'refs/heads/security/p0-closure',repository:{default_branch:'master'}},(ref,tip)=>{
    assert.equal(ref,'refs/remotes/origin/master');assert.equal(tip,head);return base;
  });
  assert.equal(result.log_opts,`--diff-merges=first-parent ${base}..${head}`);
});
test('full-history scan requires an explicit manual choice', () => {
  assert.equal(scanScope('workflow_dispatch',{}).mode,'dir');
  assert.equal(scanScope('workflow_dispatch',{inputs:{full_history:'false'}}).mode,'dir');
  assert.equal(scanScope('workflow_dispatch',{inputs:{full_history:'true'}}).log_opts,'--all --diff-merges=first-parent');
});
test('initial default push scans its new history and malformed SHAs fail closed', () => {
  assert.equal(scanScope('push',{before:zero,after:head,ref:'refs/heads/master',repository:{default_branch:'master'}}).log_opts,`--diff-merges=first-parent ${head}`);
  assert.throws(()=>scanScope('push',{before:'--all',after:head}),/Invalid commit SHA/);
});
