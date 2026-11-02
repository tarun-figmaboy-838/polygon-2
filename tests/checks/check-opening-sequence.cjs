const fs = require('fs'), vm = require('vm'), assert = require('assert');
let jobs = [], now = 0;
const ctx = { window: { matchMedia: () => ({ matches: false }) },
  document: { documentElement: { clientWidth: 1440, clientHeight: 810 } },
  React: { createRef: () => ({ current: null }) },
  DCLogic: class { setState(v, cb) { Object.assign(this.state, typeof v === 'function' ? v(this.state) : v); cb?.(); } },
  setTimeout, clearTimeout };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('src/lesson/polygon-data.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('index.html', 'utf8').match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1] + '\nglobalThis.Game=Component;', ctx);
const g = new ctx.Game(); g.P = ctx.window.POLY; g.svgRefs = {}; g.timers = []; g.state.ready = true;
g.guide = { reset() {}, onInstructionStart() {} }; g.stopDrawingSound = g.sfx = () => {};
g.enterScreen = () => 0;
g.later = (fn, ms = 0) => jobs.push({ fn, at: now + ms, gen: g.gen });
const tick = ms => { const until = now + ms; while (true) {
  jobs.sort((a,b) => a.at-b.at); if (!jobs.length || jobs[0].at > until) break;
  const job = jobs.shift(); now = job.at; if (job.gen === g.gen) job.fn();
} now = until; };
let narration, advanced = 0;
g.narrate = (text, opts) => { narration = opts; };
g.advance = () => advanced++;
const go = ph => { const k = g.steps().findIndex(s => s.sc === 'S1' && s.ph === ph); g.state.k = k; g.runStep(k); tick(0); };
go('closer'); assert(!g.state.zoomed, 'No lean-in before the line is heard');
g.storyVoiceStart(); assert(!g.state.zoomed, 'The first words land first'); tick(300); assert(g.state.zoomed, 'The camera leans in as the line is said');
tick(2000); narration.then(); tick(349); assert.equal(advanced, 0); tick(1); assert.equal(advanced, 1, 'A beat after the line, the lean-in long settled');
go('closer'); narration.then(); assert(g.state.zoomed, 'A line never heard: the lean-in comes with the fallback');
tick(1169); assert.equal(advanced, 1); tick(1); assert.equal(advanced, 2, '...and the beat waits for it to settle');
go('trace'); assert(!g.state.tracing, 'No trace before actual playback');
g.storyVoiceStart(); tick(40); assert(g.state.tracing);
narration.then(); tick(2100); assert.equal(advanced, 2, 'Short audio cannot cut the trace short');
tick(1010); assert.equal(advanced, 3);
go('ask'); assert(g.state.zoomed && !g.state.magicReveal, 'Keep the enlarged figure visible');
const question = {}; g.viewS1(question, g.step()); assert(question.showChoice);
assert.equal(question.cards[0].wrap.transform, 'scale(1.22)');
go('trace'); narration.then(); tick(40); assert(g.state.tracing, 'Fallback still teaches the boundary');
go('closer'); tick(4000); assert.equal(advanced, 3, 'Navigation cancels stale trace completion');
ctx.window.matchMedia = () => ({ matches: true });
narration.then(); const reduced = {}; g.viewS1(reduced, g.step()); assert.equal(reduced.cards[0].wrap.transition, 'none');
console.log('PASS: narration with the lean-in on it → playback-led complete trace → choices; fallback, cancellation and reduced motion.');
