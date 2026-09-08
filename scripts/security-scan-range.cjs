const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

function scanScope(eventName, event, mergeBase) {
  const sha = value => {
    if (!/^[a-f0-9]{40}$/.test(value || '')) throw new Error('Invalid commit SHA');
    return value;
  };
  const range = (base, head) => ({ mode: 'git', log_opts: `--diff-merges=first-parent ${sha(base)}..${sha(head)}` });
  if (eventName === 'workflow_dispatch') {
    return event.inputs?.full_history === true || event.inputs?.full_history === 'true'
      ? { mode: 'git', log_opts: '--all --diff-merges=first-parent' }
      : { mode: 'dir', log_opts: '' };
  }
  if (eventName === 'pull_request') return range(event.pull_request.base.sha, event.pull_request.head.sha);
  if (eventName !== 'push') throw new Error('Unsupported event');
  const head = sha(event.after);
  if (!/^0{40}$/.test(head) && event.before && !/^0{40}$/.test(event.before)) return range(event.before, head);
  if (/^0{40}$/.test(head)) throw new Error('Deleted refs must not be scanned');
  const defaultBranch = event.repository.default_branch;
  if (event.ref === `refs/heads/${defaultBranch}`) {
    // First push of the default branch: every commit is newly introduced.
    return { mode: 'git', log_opts: `--diff-merges=first-parent ${head}` };
  }
  // New feature branch: exclude shared default-branch ancestry, including revoked
  // incident material. Scan all commits unique to the new branch, not just HEAD.
  if (!defaultBranch || !/^[A-Za-z0-9_./-]+$/.test(defaultBranch)) throw new Error('Invalid default branch');
  return range(mergeBase(`refs/remotes/origin/${defaultBranch}`, head), head);
}

module.exports = { scanScope };
if (require.main === module) {
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const result = scanScope(process.env.GITHUB_EVENT_NAME, event,
    (base, head) => execFileSync('git', ['merge-base', base, head], { encoding: 'utf8' }).trim());
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `mode=${result.mode}\nlog_opts=${result.log_opts}\n`);
}
