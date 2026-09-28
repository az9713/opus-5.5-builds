// Physics self-test, run in plain Node (no rendering).
// Builds the arch ring with src/arch.js and steps the same cannon-es world
// the browser page uses, to tune the solver before wiring up three.js, and
// to record the pass/fail numbers for the final report.
//
// Run: node build/physics-selftest.mjs
//
// Tuning history (see src/physics-config.js and src/arch.js comments for
// the numeric and geometry-side fixes this file's development turned up).

import * as CANNON from 'cannon-es';
import { makeLayout, buildBridge, removeKeystone, maxRingDisplacement } from '../src/arch.js';
import { SOLVER_ITERATIONS, CONTACT_STIFFNESS, CONTACT_RELAXATION, DEFAULT_FRICTION, FIXED_DT } from '../src/physics-config.js';

export function makeWorld(friction) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  world.solver.iterations = SOLVER_ITERATIONS;
  const archMat = new CANNON.Material('arch');
  world.addContactMaterial(new CANNON.ContactMaterial(archMat, archMat, {
    friction, restitution: 0,
    contactEquationStiffness: CONTACT_STIFFNESS, contactEquationRelaxation: CONTACT_RELAXATION,
    frictionEquationStiffness: CONTACT_STIFFNESS, frictionEquationRelaxation: CONTACT_RELAXATION,
  }));
  return { world, archMat };
}

const STEPS = 420; // 3.5s ~ the cart-crossing window

function runCase(name, { friction, removeKey }) {
  const { world, archMat } = makeWorld(friction);
  const layout = makeLayout(2.5);
  const bodies = buildBridge(world, layout, { archMat });
  if (removeKey) removeKeystone(world, bodies);
  for (let i = 0; i < STEPS; i++) world.step(FIXED_DT);
  const maxD = maxRingDisplacement(bodies);
  console.log(`${name}: friction=${friction} removeKeystone=${removeKey} -> max ring displacement @3.5s = ${maxD.toFixed(4)} m`);
  return maxD;
}

{
  console.log(`--- arch physics self-test (cannon-es, fixed dt 1/120, iterations=${SOLVER_ITERATIONS}, stiffness=${CONTACT_STIFFNESS}) ---`);
  const dHold = runCase('default (should HOLD)', { friction: DEFAULT_FRICTION, removeKey: false });
  const dCollapse = runCase('keystone removed (should FALL)', { friction: DEFAULT_FRICTION, removeKey: true });
  const dLowFriction = runCase('friction = 0 (should SLIDE/FALL)', { friction: 0.0, removeKey: false });

  console.log('\nSummary:');
  console.log(`  hold threshold check: default displacement ${dHold.toFixed(4)} m ${dHold < 0.05 ? 'PASS (<0.05m)' : 'FAIL'}`);
  console.log(`  collapse check: keystone-removed displacement ${dCollapse.toFixed(4)} m ${dCollapse > 0.5 ? 'PASS (>0.5m, still growing = true fall)' : 'FAIL'}`);
  console.log(`  friction discrimination: friction=0 displacement ${dLowFriction.toFixed(4)} m ${dLowFriction > dHold ? 'PASS (slider changes result)' : 'FAIL'}`);
}
