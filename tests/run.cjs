#!/usr/bin/env node
/* Runs the QA suite in order and prints one summary.
     npm test                 lesson smoke + story on every screen + user flows + the runner hand-off
                              + the story into Part 2
     npm test -- --quick      lesson smoke + story on desktop only
   Add ENGINE=webkit to run it all in Safari's engine. */
const { spawnSync } = require('child_process');
const path = require('path');

const quick = process.argv.includes('--quick');
const suites = [
  ['Lesson smoke', 'lesson.test.cjs', {}],
  ['Story, every screen', 'story.test.cjs', quick ? { DEVICES: 'desktop' } : {}],
  ['User flows', 'flows.test.cjs', {}],
  ['The Frozen Pass hand-off', 'runner.test.cjs', {}],
  ['Help Momo and the ending', 'bridge.test.cjs', {}],
  ['Swiftee loading', 'swiftee.test.cjs', {}],
  ['The recap', 'recap.test.cjs', {}],
  ['The opening and the return', 'opening.test.cjs', {}],
  ['The languages (?lan=)', 'i18n.test.cjs', {}],
].filter(s => !(quick && /^(flows|runner|bridge|swiftee|recap|opening|i18n)\.test\.cjs$/.test(s[1])));

const summary = [];
for (const [name, file, env] of suites) {
  console.log(`\n=== ${name}`);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit', env: Object.assign({}, process.env, env) });
  summary.push(`${r.status === 0 ? 'PASS' : 'FAIL'}  ${name} (${Math.round((Date.now() - t0) / 1000)}s)`);
}
console.log('\n' + summary.join('\n'));
process.exit(summary.some(s => s.startsWith('FAIL')) ? 1 : 0);
