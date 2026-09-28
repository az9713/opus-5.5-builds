// Shared arch-bridge geometry + physics builder.
// Used both by the Node physics self-test (build/physics-selftest.mjs) and
// by the browser bundle (src/main.js), so the physics that gets tuned on
// the command line is the exact physics that runs in the page.
//
// Coordinate system: meters. X = across the span (left abutment to right
// abutment). Y = up. Z = along the bridge width (depth). The arch center
// (the point the semicircle sweeps around) sits at (0, springY, 0).
// theta = 0 is the right springer, theta = PI is the left springer.

import * as CANNON from 'cannon-es';

// Derive an arch layout from a "rise" value (springline-to-crown height).
// A true semicircular arch has rise === innerRadius, which is the sketch's
// shape (default). The rise slider scales the sweep between a shallow
// segmental arch and a taller round one while keeping the span fixed, by
// changing the radius the semicircle is drawn at (rise stays == radius,
// i.e. we keep it a true semicircle but resize it) -- this keeps every
// voussoir a simple radial wedge, which is what the sketch shows.
export function makeLayout(rise) {
  const innerRadius = rise; // semicircle: rise == radius
  const thickness = 0.7; // voussoir ring thickness (Ro - Ri)
  const outerRadius = innerRadius + thickness;
  const depth = 2.4; // bridge width (Z)
  const springY = 2.0; // height of the springline above the ground
  const voussoirsPerSide = 11; // counted from the sketch (approx.)
  const ringCount = voussoirsPerSide * 2 + 1; // + keystone at the crown
  const pierWidth = 1.0;
  const pierHeight = springY;
  // Deck underside must clear the FULL outer radius (the crown/keystone
  // extrados peak is at springY + outerRadius) plus a parapet upstand, or
  // the deck plane cuts through the keystone -- a real overlap, not a
  // numerical-tuning problem, and it was the actual cause of the arch
  // exploding in build/physics-selftest.mjs before this fix.
  const spandrelTopY = springY + outerRadius + 0.25;
  const deckThickness = 0.35;
  const keystoneIndex = Math.floor(ringCount / 2);
  return {
    innerRadius, outerRadius, thickness, depth, springY,
    voussoirsPerSide, ringCount, pierWidth, pierHeight,
    spandrelTopY, deckThickness, keystoneIndex,
  };
}

// Plain-array (non-CANNON) version of a voussoir's 8 corners, in WORLD
// coordinates (springY already added), for the three.js render side --
// so the mesh a block wears is built from the exact same numbers as the
// shape it collides with, not a visually-similar approximation.
// Order: [theta0 inner front, theta0 inner back, theta0 outer front,
//         theta0 outer back, theta1 inner front, theta1 inner back,
//         theta1 outer front, theta1 outer back]
export function voussoirCornersWorld(layout, theta0, theta1) {
  const { innerRadius: Ri, outerRadius: Ro, depth, springY } = layout;
  const hz = depth / 2;
  const p = (theta, r, z) => [r * Math.cos(theta), springY + r * Math.sin(theta), z];
  return [
    p(theta0, Ri, hz), p(theta0, Ri, -hz),
    p(theta0, Ro, hz), p(theta0, Ro, -hz),
    p(theta1, Ri, hz), p(theta1, Ri, -hz),
    p(theta1, Ro, hz), p(theta1, Ro, -hz),
  ];
}

// Build the 8 corners of ring block `i` (theta0..theta1) as a convex hull
// for cannon-es, with outward-pointing face normals guaranteed by an
// auto-fix pass (checked against the block centroid).
function buildVoussoirShape(layout, theta0, theta1) {
  const { innerRadius: Ri, outerRadius: Ro, depth } = layout;
  const hz = depth / 2;
  const p = (theta, r, z) => new CANNON.Vec3(r * Math.cos(theta), r * Math.sin(theta), z);
  // 0..7: theta0 inner front/back, theta0 outer front/back,
  //       theta1 inner front/back, theta1 outer front/back
  const vertices = [
    p(theta0, Ri, hz), p(theta0, Ri, -hz),
    p(theta0, Ro, hz), p(theta0, Ro, -hz),
    p(theta1, Ri, hz), p(theta1, Ri, -hz),
    p(theta1, Ro, hz), p(theta1, Ro, -hz),
  ];
  let faces = [
    [0, 2, 3, 1], // theta0 end (radial face)
    [4, 5, 7, 6], // theta1 end (radial face)
    [0, 1, 5, 4], // inner (intrados)
    [2, 6, 7, 3], // outer (extrados)
    [0, 4, 6, 2], // front (+z)
    [1, 3, 7, 5], // back (-z)
  ];
  // cannon-es's own ConvexPolyhedron.computeNormals() sanity check assumes
  // shape-local vertices surround the shape's own local origin (it tests
  // dot(normal, vertex) < 0 against the raw local vertex, not a centroid).
  // So the local origin must be the block centroid, not the arch center --
  // recenter vertices here and hand the centroid back so the caller can use
  // it as the body's world position.
  const centroid = new CANNON.Vec3();
  vertices.forEach((v) => centroid.vadd(v, centroid));
  centroid.scale(1 / vertices.length, centroid);
  const localVertices = vertices.map((v) => v.vsub(centroid));
  // Match cannon-es's own ConvexPolyhedron.computeNormals() exactly: it
  // calls getFaceNormal() -- computeNormal(va, vb, vc) = (vc-vb) x (vb-va)
  // -- and then NEGATES that before using it as the face normal. So the
  // raw (non-negated) cross product must point *inward* (dot with the
  // local vertex <= 0) for the final, negated normal to point outward.
  faces = faces.map((f) => {
    const a = localVertices[f[0]], b = localVertices[f[1]], cc = localVertices[f[2]];
    const ab = b.vsub(a), cb = cc.vsub(b);
    const n = cb.cross(ab);
    return n.dot(a) <= 0 ? f : f.slice().reverse();
  });
  const shape = new CANNON.ConvexPolyhedron({ vertices: localVertices, faces });
  return { shape, centroid };
}

// Creates all bodies (arch ring, keystone, piers, spandrel, deck) and adds
// them to `world`. Returns handles used by the UI/render layer and by the
// self-test.
const STONE_DENSITY = 2400; // kg/m^3, roughly limestone -- masses are computed
                            // from real shape volumes so the mass ratios
                            // between voussoir / spandrel / deck are realistic
                            // (an earlier placeholder set of masses had the
                            // deck 20x a voussoir instead of the ~8x a real
                            // stone deck works out to, and the iterative
                            // solver could not hold that ratio -- see
                            // build/physics-selftest.mjs history).

// Angular boundaries of every ring block. The keystone (the middle block)
// is made noticeably wider than the other voussoirs -- matching the
// sketch, where the shaded keystone reads as a distinctly bigger stone
// than the surrounding coursing -- and, physically, so that removing it
// leaves a gap wide enough that the two half-arches cannot just rotate a
// couple of degrees and re-touch each other. With all voussoirs the same
// (thin, ~7.8 degree) width, that's exactly what happened: the "keystone
// removed" case settled at 0.3 m and plateaued instead of collapsing --
// see build/physics-selftest.mjs history.
const KEYSTONE_WIDTH_FACTOR = 4.0;
export function ringThetaBounds(layout) {
  const keystoneWidth = (Math.PI / layout.ringCount) * KEYSTONE_WIDTH_FACTOR;
  const sideWidth = (Math.PI - keystoneWidth) / (layout.ringCount - 1);
  const bounds = [0];
  for (let i = 0; i < layout.ringCount; i++) {
    const w = i === layout.keystoneIndex ? keystoneWidth : sideWidth;
    bounds.push(bounds[i] + w);
  }
  return bounds;
}

export function buildBridge(world, layout, materials, opts = {}) {
  const { withSuperstructure = true } = opts;
  const { archMat } = materials;
  const keystoneIndex = Math.floor(layout.ringCount / 2);
  const bodies = { ring: [], keystoneIndex, piers: [], spandrel: [], deck: null };
  layout = { ...layout, keystoneIndex };
  const bounds = ringThetaBounds(layout);

  for (let i = 0; i < layout.ringCount; i++) {
    const theta0 = bounds[i];
    const theta1 = bounds[i + 1];
    const { shape, centroid } = buildVoussoirShape(layout, theta0, theta1);
    const volume = 0.5 * (theta1 - theta0) * (layout.outerRadius ** 2 - layout.innerRadius ** 2) * layout.depth;
    const body = new CANNON.Body({
      mass: STONE_DENSITY * volume,
      shape,
      material: archMat,
      position: new CANNON.Vec3(centroid.x, layout.springY + centroid.y, centroid.z),
      allowSleep: false, // see build/physics-selftest.mjs notes: sleeping
                          // bodies do not wake when a neighbor is removed
    });
    body.angularDamping = 0.2;
    body.linearDamping = 0.05;
    body.userData = { kind: 'voussoir', index: i, theta0, theta1, restPosition: body.position.clone() };
    world.addBody(body);
    bodies.ring.push(body);
  }
  bodies.keystone = bodies.ring[bodies.keystoneIndex];

  // Ground: static, so a genuine collapse lands and stops instead of
  // free-falling forever (an early self-test reported a "53 m collapse"
  // that was really just an unbounded fall through empty space).
  {
    const groundShape = new CANNON.Box(new CANNON.Vec3(30, 0.5, 30));
    const groundBody = new CANNON.Body({ mass: 0, shape: groundShape, material: archMat, position: new CANNON.Vec3(0, -0.5, 0) });
    world.addBody(groundBody);
    bodies.ground = groundBody;
  }

  // Piers (abutments): static, real bridges bury these, so they do not move.
  for (const side of [-1, 1]) {
    const x = side * (layout.innerRadius + layout.pierWidth / 2);
    const shape = new CANNON.Box(new CANNON.Vec3(layout.pierWidth / 2, layout.pierHeight / 2, layout.depth / 2 + 0.15));
    const body = new CANNON.Body({ mass: 0, shape, material: archMat, position: new CANNON.Vec3(x, layout.pierHeight / 2, 0) });
    world.addBody(body);
    bodies.piers.push(body);
  }

  if (!withSuperstructure) return bodies;

  // Spandrel walls: one dynamic body per side, built from wedge panels
  // whose BOTTOM face is the exact same geometry as the matching arch ring
  // block's outer (extrados) face -- guaranteed flush, zero-gap contact,
  // the same trick that makes voussoir-to-voussoir contacts stable --
  // extruded straight up to the flat deck-underside plane. (An earlier
  // version approximated the curve with axis-aligned boxes; the box edges
  // didn't match the curve, leaving alternating gaps and overlaps under
  // each step, and that produced a slow-building instability localized at
  // the crown that even 400 solver iterations did not fix -- see
  // build/physics-selftest.mjs history. Matching the exact ring geometry
  // instead of approximating it removed the problem at its source.)
  // The sketch shows the brick coursing stopping short of the crown, with
  // the keystone exposed above it, so only the haunch-side ring blocks
  // (skip the ones nearest the crown) get a spandrel panel.
  const spandrelSkipNearCrown = 3;
  for (const side of [-1, 1]) {
    const blockIndices = [];
    for (let i = 0; i < layout.voussoirsPerSide - spandrelSkipNearCrown; i++) {
      blockIndices.push(side > 0 ? i : layout.ringCount - 1 - i);
    }
    const panels = [];
    let volume = 0;
    for (const i of blockIndices) {
      const theta0 = bounds[i];
      const theta1 = bounds[i + 1];
      const Ro = layout.outerRadius;
      const hz = layout.depth / 2;
      const b0 = new CANNON.Vec3(Ro * Math.cos(theta0), Ro * Math.sin(theta0), hz);
      const b1 = new CANNON.Vec3(Ro * Math.cos(theta0), Ro * Math.sin(theta0), -hz);
      const b2 = new CANNON.Vec3(Ro * Math.cos(theta1), Ro * Math.sin(theta1), hz);
      const b3 = new CANNON.Vec3(Ro * Math.cos(theta1), Ro * Math.sin(theta1), -hz);
      const topLocalY = layout.spandrelTopY - layout.springY;
      const t0 = new CANNON.Vec3(b0.x, topLocalY, b0.z);
      const t1 = new CANNON.Vec3(b1.x, topLocalY, b1.z);
      const t2 = new CANNON.Vec3(b2.x, topLocalY, b2.z);
      const t3 = new CANNON.Vec3(b3.x, topLocalY, b3.z);
      const verts = [b0, b1, b2, b3, t0, t1, t2, t3];
      const w = Math.hypot(b2.x - b0.x, b2.y - b0.y);
      const h = topLocalY - (b0.y + b2.y) / 2;
      volume += w * h * layout.depth;
      panels.push({ theta0, theta1, verts });
    }
    // Volume-weighted centroid of all 8*N panel vertices, for the same
    // inertia reason as above: keep the body's local origin near its mass.
    let cx = 0, cy = 0, cz = 0, n = 0;
    for (const p of panels) for (const v of p.verts) { cx += v.x; cy += v.y; cz += v.z; n++; }
    cx /= n; cy /= n; cz /= n;
    const body = new CANNON.Body({
      mass: STONE_DENSITY * volume,
      material: archMat,
      allowSleep: false,
      position: new CANNON.Vec3(cx, layout.springY + cy, cz),
    });
    for (const p of panels) {
      // Each ConvexPolyhedron's own internal sanity check (see
      // buildVoussoirShape above) needs ITS OWN local vertices to surround
      // ITS OWN origin -- not the compound body's shared origin -- so give
      // every panel its own centroid-relative frame and pass the offset
      // from the body's origin to addShape() instead.
      const panelCentroid = new CANNON.Vec3();
      p.verts.forEach((v) => panelCentroid.vadd(v, panelCentroid));
      panelCentroid.scale(1 / p.verts.length, panelCentroid);
      const local = p.verts.map((v) => v.vsub(panelCentroid));
      const faces = [
        [0, 2, 3, 1], // bottom (flush against the ring's outer face)
        [4, 5, 7, 6], // top (flat, at the deck underside)
        [0, 1, 5, 4], // theta0 end
        [2, 6, 7, 3], // theta1 end
        [0, 4, 6, 2], // front (+z)
        [1, 3, 7, 5], // back (-z)
      ];
      const fixedFaces = faces.map((f) => {
        const a = local[f[0]], b = local[f[1]], cc = local[f[2]];
        const ab = b.vsub(a), cb = cc.vsub(b);
        const normal = cb.cross(ab);
        return normal.dot(a) <= 0 ? f : f.slice().reverse();
      });
      const shape = new CANNON.ConvexPolyhedron({ vertices: local, faces: fixedFaces });
      const offset = new CANNON.Vec3(panelCentroid.x - cx, panelCentroid.y - cy, panelCentroid.z - cz);
      body.addShape(shape, offset);
    }
    body.updateMassProperties();
    world.addBody(body);
    bodies.spandrel.push(body);
  }

  // Deck: one slab resting on both spandrel walls.
  {
    const span = layout.innerRadius * 2 + layout.pierWidth * 2 + 0.4;
    const shape = new CANNON.Box(new CANNON.Vec3(span / 2, layout.deckThickness / 2, layout.depth / 2 + 0.1));
    const deckVolume = span * layout.deckThickness * (layout.depth + 0.2);
    const body = new CANNON.Body({
      mass: STONE_DENSITY * deckVolume,
      shape,
      material: archMat,
      position: new CANNON.Vec3(0, layout.spandrelTopY + layout.deckThickness / 2, 0),
      allowSleep: false,
    });
    world.addBody(body);
    bodies.deck = body;
  }

  return bodies;
}

export function removeKeystone(world, bodies) {
  if (!bodies.keystone) return;
  world.removeBody(bodies.keystone);
  bodies.keystoneRemoved = true;
  bodies.ring.forEach((b) => b.wakeUp());
  bodies.spandrel.forEach((b) => b.wakeUp());
  bodies.deck.wakeUp();
}

export function maxRingDisplacement(bodies) {
  let max = 0;
  for (const b of bodies.ring) {
    if (b === bodies.keystone && bodies.keystoneRemoved) continue;
    const d = b.position.distanceTo(b.userData.restPosition);
    if (d > max) max = d;
  }
  return max;
}
