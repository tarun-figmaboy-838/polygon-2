const fs = require('fs'), vm = require('vm'), assert = require('assert');
let now = 0, id = 0, reduced = false;
const frames = new Map(), updates = [];
const ctx = {
  window: { matchMedia: () => ({ matches: reduced }) },
  React: { createRef: () => ({ current: null }) },
  DCLogic: class { setState(s) { updates.push(s); Object.assign(this.state, s); } },
  performance: { now: () => now },
  requestAnimationFrame: f => { frames.set(++id, f); return id; },
  cancelAnimationFrame: i => frames.delete(i), setTimeout, clearTimeout
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('src/lesson/polygon-data.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('index.html', 'utf8').match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1] + '\nglobalThis.Game=Component;', ctx);
const g = new ctx.Game(); g.P = ctx.window.POLY;
g.stopDrawingSound = g.clearNudge = g.sfx = g.armNudge = () => {}; g.locked = () => false;
g.later = () => {};
// the regular polygons the naming screens morph between (the recall stepper's were the same)
const shape = n => g.P.reg(n, 500, 500, 300, 180 / n);
function frame(time) { now = time; const work = [...frames.values()]; frames.clear(); work.forEach(f => f(time)); }
function hasCorners(outline, corners) {
  corners.forEach(p => assert(outline.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6), 'Every original corner is retained'));
}
// The state the morph carries and its starting geometry are committed together, before any RAF.
updates.length = 0;
g.morphTo(shape(3), shape(4), 520, null, { n: 4 }); assert.equal(g.state.n, 4); hasCorners(g.state.morph, shape(3));
assert(updates[0].n === 4 && updates[0].morph);
frame(200); const visible = g.state.morph.map(p => [...p]);
const previousSpeed = g._morphVelocity.map(p => [...p]);
assert(previousSpeed.some(v => Math.hypot(...v) > 0.01));
const stale = [...frames.values()][0];
// retargeted mid-way: it goes on from where it is drawn, at the speed it had
g.morphTo(shape(4), shape(5), 520, null, { n: 5 }); hasCorners(g.state.morph, visible); assert.equal(frames.size, 1);
visible.forEach((p, i) => {
  const j = g.state.morph.findIndex(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6);
  assert(Math.hypot(g._morphVelocity[j][0] - previousSpeed[i][0], g._morphVelocity[j][1] - previousSpeed[i][1]) < 1e-6, 'Retarget preserves velocity');
});
const current = g.state.morph; stale(); assert.strictEqual(g.state.morph, current);
frame(720); assert.equal(g.state.morph, null); assert.equal(g.state.n, 5);
for (let n = 3; n <= 8; n++) {
  const pts = shape(n);
  assert.equal(pts[0][1], pts[n - 1][1], 'All polygons retain a horizontal top side');
}
// Check exact final silhouettes for every supported pair, including 5 and 7 sides.
for (let from = 3; from <= 8; from++) for (let to = 3; to <= 8; to++) {
  g.morphTo(shape(from), shape(to), 520); hasCorners(g.state.morph, shape(from));
  updates.length = 0; frame(now + 520);
  hasCorners(updates[0].morph, shape(to)); assert.equal(g.state.morph, null);
}
let done = 0; g.morphTo(shape(3), shape(4), 520, () => done++);
g.cancelMorph(); assert.equal(frames.size, 0); assert.equal(done, 0);
g.state.morph = null;
reduced = true; g.morphTo(shape(4), shape(5), 520, () => done++, { n: 5 });
assert.equal(frames.size, 0); assert.equal(g.state.morph, null); assert.equal(done, 1);
reduced = false; g.morphTo(shape(5), shape(6), 520, () => done++);
g.gen = (g.gen || 0) + 1; frame(now + 520); assert.equal(done, 1);
console.log('PASS: atomic start, interrupted morph continuity, stale-frame cancellation, all 36 exact endpoints, reduced motion, and navigation safety.');
const box={x:925,y:230,w:650,h:650}, remapped=g.figureInViewBox('triangle','quad');
g.fig('triangle').pts.forEach((p,i)=>{
  const before=g.mapPt(box,g.fig('triangle').vb,p),after=g.mapPt(box,g.fig('quad').vb,remapped[i]);
  assert(Math.hypot(before[0]-after[0],before[1]-after[1])<1e-6,'Changing SVG coordinates must not jump or resize the starting triangle');
});
console.log('PASS: triangle-to-quadrilateral transition preserves the source position and scale.');

