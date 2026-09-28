// Tuned cannon-es solver constants, shared by the Node physics self-test
// (build/physics-selftest.mjs) and the browser page (src/main.js), so the
// physics that was tuned on the command line is exactly what runs live.
//
// Why these numbers: the default cannon-es contact stiffness (1e7) is
// tuned for toy-scale bodies. These voussoirs are real-mass stone blocks
// (~1.5 tonnes each -- see STONE_DENSITY in src/arch.js), and at 1e7 the
// contacts compressed enough, chained across ~22 joints, that the crown
// sagged continuously and even the "default, should hold" case failed.
// contactEquationStiffness 2e10 (relaxation 3) with 150 solver iterations
// brought that residual creep to 3.7mm over 3.5s. See
// build/physics-selftest.mjs for the sweep that found this.
export const SOLVER_ITERATIONS = 150;
export const CONTACT_STIFFNESS = 2e10;
export const CONTACT_RELAXATION = 3;
export const DEFAULT_FRICTION = 0.65;
export const FIXED_DT = 1 / 120;
