#!/usr/bin/env node
/* Runs the QA suite in order and prints one summary.
     npm test                 lesson smoke + story on every screen + user flows
     npm test -- --quick      lesson smoke + story on desktop only
   Add ENGINE=webkit to run it all in Safari's engine. */
const { spawnSync } = require('child_process');
const path = require('path');

const quick = process.argv.includes('--quick');
const suites = [
  ['Lesson smoke', 'lesson.test.cjs', {}],
  ['Story, every screen', 'story.test.cjs', quick ? { DEVICES: 'desktop' } : {}],
  ['User flows', 'flows.test.cjs', {}]
].filter(s => !(quick && s[1] === 'flows.test.cjs'));

const summary = [];
for (const [name, file, env] of suites) {
  console.log(`\n=== ${name}`);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit', env: Object.assign({}, process.env, env) });
  summary.push(`${r.status === 0 ? 'PASS' : 'FAIL'}  ${name} (${Math.round((Date.now() - t0) / 1000)}s)`);
}
console.log('\n' + summary.join('\n'));
process.exit(summary.some(s => s.startsWith('FAIL')) ? 1 : 0);
