/* POLYGON GEOMETRY — one geometry, one definition.
 *
 * Fourteen canonical shapes, each defined exactly once as a list of vertices in a
 * normalised box from -1 to 1, y pointing down as it does in SVG. Nothing is generated
 * at render time: the player has to count sides, so a shape that changed between two
 * viewings would be changing the question.
 *
 * Names in the source data are DESCRIPTIONS, not identities. "Regular convex pentagon"
 * is a regular pentagon — a regular pentagon is convex by definition — and "Octagon"
 * and "Quadrilateral" are the regular ones, because no irregular variant of either was
 * specified. Those three names normalise onto existing geometries through CANONICAL
 * below rather than becoming coordinate arrays of their own. A duplicated array is not
 * just waste: two copies drift, and then the same polygon looks different in two levels.
 *
 * Regularity and concavity never change what a polygon IS. A regular pentagon, an
 * irregular pentagon and a concave pentagon are all pentagons, because all three have
 * five sides — the whole lesson of the later levels. So the side count has to be
 * unmistakable in every one of them, which tests/helpers/verify-polygons.cjs checks.
 *
 * Loaded as a CLASSIC script, not a module: browsers refuse ES module imports over
 * file://, and the game has to open by double-clicking its HTML file. Same file, same
 * job — it publishes onto one namespace instead of exporting.
 */

/** A regular n-gon. Odd side counts get a vertex at the top (a triangle points up, a
    pentagon points up); even ones get a flat top edge, which is how a square, a hexagon
    and an octagon are normally drawn. */
function regular(n) {
  const start = (n % 2 === 1 ? -90 : -90 - 180 / n) * Math.PI / 180;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = start + (i * 2 * Math.PI) / n;
    pts.push({ x: +Math.cos(a).toFixed(6), y: +Math.sin(a).toFixed(6) });
  }
  return pts;
}

/* ---- the registry: coordinates and nothing else ---- */
export const polygonDefinitions = {
  regularTriangle:      { points: regular(3) },
  regularQuadrilateral: { points: regular(4) },
  regularPentagon:      { points: regular(5) },
  regularHexagon:       { points: regular(6) },
  regularHeptagon:      { points: regular(7) },
  regularOctagon:       { points: regular(8) },

  /* Five sides, none of them matching, every corner still turning the same way.
     Deliberately not a squashed regular pentagon: it has to look plainly different from
     one while still counting five. */
  irregularConvexPentagon: { points: [
    { x: -0.12, y: -1.00 },
    { x:  0.86, y: -0.52 },
    { x:  0.98, y:  0.46 },
    { x: -0.30, y:  0.96 },
    { x: -0.98, y: -0.06 }
  ] },

  /* Five sides, uneven. A wrong answer in Level 7, where it has to be countable as five
     so the learner rules it out on side count rather than on how neat it looks. */
  irregularPentagon: { points: [
    { x:  0.06, y: -0.98 },
    { x:  1.00, y: -0.10 },
    { x:  0.46, y:  0.94 },
    { x: -0.62, y:  0.82 },
    { x: -0.94, y: -0.44 }
  ] },

  /* Six sides, unequal, convex. This is Level 4's answer, and that level exists to show
     a hexagon need not be regular — so the six sides must count at a glance. */
  irregularConvexHexagon: { points: [
    { x: -0.34, y: -0.98 },
    { x:  0.52, y: -0.86 },
    { x:  1.00, y: -0.06 },
    { x:  0.66, y:  0.90 },
    { x: -0.46, y:  0.98 },
    { x: -0.98, y:  0.18 }
  ] },

  /* Six sides, uneven. A wrong answer in Level 6, and it must not be mistakable for a
     pentagon — so no two of its sides come near enough to parallel to merge visually. */
  irregularHexagon: { points: [
    { x: -0.10, y: -1.00 },
    { x:  0.78, y: -0.64 },
    { x:  0.98, y:  0.22 },
    { x:  0.28, y:  0.96 },
    { x: -0.60, y:  0.74 },
    { x: -0.96, y: -0.20 }
  ] },

  /* Eight sides, unequal, convex. A wrong answer in Level 5, where its job is to read
     clearly as an octagon rather than the heptagon being asked for. */
  irregularConvexOctagon: { points: [
    { x: -0.30, y: -0.98 },
    { x:  0.44, y: -0.90 },
    { x:  0.94, y: -0.44 },
    { x:  1.00, y:  0.24 },
    { x:  0.58, y:  0.88 },
    { x: -0.22, y:  1.00 },
    { x: -0.84, y:  0.62 },
    { x: -1.00, y: -0.28 }
  ] },

  /* Five sides with one corner folded inward. The indentation is deep enough to be
     obvious and shallow enough that no two sides cross: a self-crossing outline stops
     being a pentagon at all. */
  concavePentagon: { points: [
    { x:  0.00, y: -1.00 },
    { x:  0.94, y: -0.40 },
    { x:  0.60, y:  0.94 },
    { x:  0.02, y:  0.16 },
    { x: -0.92, y:  0.44 }
  ] },

  /* Six sides, one clear inward corner — notched into the TOP edge. The notch used to be
     on the right, which made this and the concave heptagon two left-pointing arrows that
     were genuinely hard to tell apart, and Level 7 puts them in the same column with one
     correct and one not. The difficulty there is meant to be counting sides. */
  concaveHexagon: { points: [
    { x: -0.90, y: -0.66 },
    { x:  0.02, y: -0.02 },
    { x:  0.92, y: -0.70 },
    { x:  1.00, y:  0.44 },
    { x:  0.06, y:  0.98 },
    { x: -0.98, y:  0.40 }
  ] },

  /* Seven sides, one clear inward corner. Level 5's answer, and the level only works if
     this reads as seven rather than six or eight — so the notch sits between two long
     sides where it cannot swallow a vertex. */
  concaveHeptagon: { points: [
    { x: -0.20, y: -1.00 },
    { x:  0.62, y: -0.80 },
    { x:  1.00, y: -0.04 },
    { x:  0.20, y:  0.22 },
    { x:  0.60, y:  0.94 },
    { x: -0.46, y:  0.96 },
    { x: -1.00, y:  0.10 }
  ] }
};


/* Descriptions from the source data that are not identities of their own. A regular
   pentagon is convex; "Octagon" and "Quadrilateral" have no irregular variant in these
   levels. Normalising here keeps the registry at one entry per real geometry. */
export const CANONICAL = {
  regularConvexPentagon: 'regularPentagon',
  quadrilateral: 'regularQuadrilateral',
  octagon: 'regularOctagon'
};

/** The canonical type for any name the data might use. */
export function canonical(type) {
  return CANONICAL[type] || type;
}

/** The vertices of a shape, normalised. One lookup, no branching on type. */
export function pointsOf(type) {
  const def = polygonDefinitions[canonical(type)];
  return def ? def.points : [];
}

/* `scaled(type, size)` and sidesOf() were removed: nothing imported them. The runner scales
   rings itself — PolygonFactory.fitInside() fits one UNIFORMLY into the option row's box,
   which is what keeps a regular polygon's sides equal, and a plain radial scale here could
   not offer that guarantee. verify() and the classification it checks against moved to
   tests/helpers/verify-polygons.cjs, the only place they were ever meant to run. */
