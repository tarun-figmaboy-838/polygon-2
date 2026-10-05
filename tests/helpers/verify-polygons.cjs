/* The runner's fourteen polygons checked against what each one is meant to be. This was
   verify() in game/js/polygons.js; it runs here, in the tests, because the game never called
   it: the shapes are constants, so this is a fact about the source rather than about a
   session. It exists because a coordinate typo does not look like a bug — it looks like a
   hexagon with five visible sides, and it would quietly change what a level teaches.

     const { verifyPolygons } = require('./helpers/verify-polygons.cjs');
     (await verifyPolygons()) -> [] when every shape is what its row below says */
const fs = require('fs');
const path = require('path');

/* ---- classification, kept apart from the coordinates ---- */
const polygonMetadata = {
  regularTriangle:         { sides: 3, regular: true,  convex: true },
  regularQuadrilateral:    { sides: 4, regular: true,  convex: true },
  regularPentagon:         { sides: 5, regular: true,  convex: true },
  regularHexagon:          { sides: 6, regular: true,  convex: true },
  regularHeptagon:         { sides: 7, regular: true,  convex: true },
  regularOctagon:          { sides: 8, regular: true,  convex: true },
  irregularPentagon:       { sides: 5, regular: false, convex: true },
  irregularConvexPentagon: { sides: 5, regular: false, convex: true },
  irregularHexagon:        { sides: 6, regular: false, convex: true },
  irregularConvexHexagon:  { sides: 6, regular: false, convex: true },
  irregularConvexOctagon:  { sides: 8, regular: false, convex: true },
  concavePentagon:         { sides: 5, regular: false, convex: false },
  concaveHexagon:          { sides: 6, regular: false, convex: false },
  concaveHeptagon:         { sides: 7, regular: false, convex: false }
};

/** Cross product of the turn at vertex i. Its sign says which way the corner turns. */
function turn(p, i) {
  const n = p.length;
  const a = p[(i - 1 + n) % n], b = p[i], c = p[(i + 1) % n];
  return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
}

/** Do segments p1-p2 and p3-p4 cross, other than at a shared endpoint? */
function segmentsCross(p1, p2, p3, p4) {
  const d = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

/* Checks every definition against what its metadata claims. */
function verify(polygonDefinitions) {
  const problems = [];

  for (const name of Object.keys(polygonDefinitions)) {
    if (!polygonMetadata[name]) problems.push(`${name}: geometry with no metadata`);
  }
  for (const name of Object.keys(polygonMetadata)) {
    if (!polygonDefinitions[name]) problems.push(`${name}: metadata with no geometry`);
  }

  // no two registry entries may hold the same shape
  const seen = new Map();
  for (const [name, def] of Object.entries(polygonDefinitions)) {
    const key = def.points.map(p => p.x.toFixed(4) + ',' + p.y.toFixed(4)).join(' ');
    if (seen.has(key)) problems.push(`${name}: identical geometry to ${seen.get(key)} — one geometry, one definition`);
    else seen.set(key, name);
  }

  for (const [name, def] of Object.entries(polygonDefinitions)) {
    const meta = polygonMetadata[name];
    if (!meta) continue;
    const p = def.points;

    if (p.length !== meta.sides) {
      problems.push(`${name}: ${p.length} vertices, expected ${meta.sides}`);
      continue;
    }

    const turns = p.map((_, i) => turn(p, i));

    // a corner that barely turns reads as no corner at all: two sides look like one
    const flat = turns.filter(t => Math.abs(t) < 0.02).length;
    if (flat) problems.push(`${name}: ${flat} near-collinear vertex/vertices, so a side would visually merge`);

    const pos = turns.filter(t => t > 0).length, neg = turns.filter(t => t < 0).length;
    if (meta.convex && pos && neg) problems.push(`${name}: metadata says convex but corners turn both ways`);
    if (!meta.convex && !(pos && neg)) problems.push(`${name}: metadata says concave but every corner turns the same way`);

    // self-crossing would stop it being the polygon it claims to be
    for (let i = 0; i < p.length; i++) {
      for (let j = i + 2; j < p.length; j++) {
        if (i === 0 && j === p.length - 1) continue;          // adjacent, wrapping
        if (segmentsCross(p[i], p[(i + 1) % p.length], p[j], p[(j + 1) % p.length])) {
          problems.push(`${name}: sides ${i} and ${j} cross`);
        }
      }
    }

    // no side so short it reads as a nicked corner rather than as a side
    const lens = p.map((q, i) => {
      const r = p[(i + 1) % p.length];
      return Math.hypot(r.x - q.x, r.y - q.y);
    });
    const longest = Math.max(...lens);
    lens.forEach((l, i) => {
      if (l < longest * 0.16) {
        problems.push(`${name}: side ${i} is ${(l / longest * 100) | 0}% of the longest — too short to count`);
      }
    });

    // a regular shape's sides really are equal; an irregular one's really are not
    const spread = (Math.max(...lens) - Math.min(...lens)) / Math.max(...lens);
    if (meta.regular && spread > 0.02) problems.push(`${name}: metadata says regular but its sides differ by ${(spread * 100) | 0}%`);
    if (!meta.regular && spread < 0.08) problems.push(`${name}: metadata says irregular but its sides are within ${(spread * 100) | 0}% — it will read as regular`);
  }

  return problems;
}

/** polygons.js is an ES module the game loads in the browser; Node reads it the same way. */
async function verifyPolygons() {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'game', 'js', 'polygons.js'), 'utf8');
  const mod = await import('data:text/javascript,' + encodeURIComponent(src));
  return verify(mod.polygonDefinitions);
}

module.exports = { verifyPolygons };
