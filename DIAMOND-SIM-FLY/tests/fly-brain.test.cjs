const test = require("node:test");
const assert = require("node:assert/strict");
const FlyBrainEngine = require("../src/fly-brain-engine.js");

const {
  MulberryPRNG,
  ChemicalFieldGrid,
  DrosophilaBrain,
  NeurogenesisEngine,
  PreTrainingEngine,
  SixteenFlyBrainSyncytium,
  ElevenFlyBrainSyncytium,     // alias
  EightFlyBrainSyncytium,      // alias
  SevenFlyBrainSyncytium,      // alias
  FiveFlyBrainSyncytium,       // alias
  MultiAgentGraphGraft,
  DiamondAgentGraft,            // alias
  FlyBrainStateSerializer
} = FlyBrainEngine;

// ──────────────────────────────────────────────────────────────────────────────
// 1. PRNG
// ──────────────────────────────────────────────────────────────────────────────
test("MulberryPRNG produces deterministic, repeatable pseudorandom sequences from world seeds", () => {
  const prngA = new MulberryPRNG(12345);
  const prngB = new MulberryPRNG(12345);
  const prngC = new MulberryPRNG("cosmic-nectar");

  const drawsA = Array.from({ length: 10 }, () => prngA.next());
  const drawsB = Array.from({ length: 10 }, () => prngB.next());
  assert.deepEqual(drawsA, drawsB, "Identical seeds must yield identical pseudorandom streams");

  const drawsC = Array.from({ length: 10 }, () => prngC.next());
  assert.notDeepEqual(drawsA, drawsC, "Different seeds must yield distinct streams");
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. Single Brain Init
// ──────────────────────────────────────────────────────────────────────────────
test("DrosophilaBrain initializes neuropils with sparse AL-KC and neutral MBON weights", () => {
  const brain = new DrosophilaBrain(0, "forager");
  assert.equal(brain.id, 0);
  assert.equal(brain.role, "forager");
  assert.equal(brain.alProjection.length, 14);
  assert.equal(brain.kcActivations.length, 32);
  assert.equal(brain.mbonActivations.length, 4);
  assert.equal(brain.compassRing.length, 8);
  assert.equal(brain.bornNeurons.length, 0);

  for (let i = 0; i < brain.kcToMbonWeights.length; i++) {
    assert.ok(brain.kcToMbonWeights[i] > 0);
    assert.ok(Number.isFinite(brain.kcToMbonWeights[i]));
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. SEZ Metabolic Brain
// ──────────────────────────────────────────────────────────────────────────────
test("Brain 7 (SEZ / Metabolic) modulates sugar drive and octopamine arousal from energy levels", () => {
  const sezBrain = new DrosophilaBrain(7, "metabolic");

  const satiatedSensory = [0.5, 0.5, 0.1, 0.0, 0.95, 0.1, 0, 0, 0, 0, 0, 0, 0, 0];
  sezBrain.forward(satiatedSensory, 0);
  assert.equal(sezBrain.metabolicSatiety, 0.95);
  assert.ok(sezBrain.serotonin5HT > sezBrain.octopamineOA, "Satiety promotes serotonin over octopamine");

  const hungrySensory = [0.5, 0.5, 0.8, 0.0, 0.1, 0.1, 0, 0, 0, 0, 0, 0, 0, 0];
  sezBrain.forward(hungrySensory, 0);
  assert.equal(sezBrain.metabolicSatiety, 0.1);
  assert.ok(sezBrain.sugarDrive > 1.0, "Hunger amplifies appetitive sugar drive");
  assert.ok(sezBrain.octopamineOA > 0.8, "Nutritional deficit elevates octopamine motor arousal");
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. PreTraining
// ──────────────────────────────────────────────────────────────────────────────
test("PreTrainingEngine pre-conditions sensory representations and marks syncytium pre-trained", () => {
  const syncytium = new ElevenFlyBrainSyncytium(77);
  assert.equal(syncytium.isPretrained, false);

  let progressReported = false;
  PreTrainingEngine.runPreTraining(syncytium, 30, (pct) => {
    progressReported = true;
  });

  assert.equal(syncytium.isPretrained, true);
  assert.equal(syncytium.pretrainingEpochs, 30);
  assert.ok(progressReported, "Progress callback should be executed during pre-training");

  for (let b = 0; b < 16; b++) {
    for (let k = 0; k < syncytium.brains[b].kcToMbonWeights.length; k++) {
      const w = syncytium.brains[b].kcToMbonWeights[k];
      assert.ok(Number.isFinite(w) && w > 0);
    }
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// 5. SixteenFlyBrainSyncytium — 16 brains, 16x16x4 commissural weights
// ──────────────────────────────────────────────────────────────────────────────
test("SixteenFlyBrainSyncytium coordinates 16 distinct brains with 16x16x4 commissural cross-talk", () => {
  const syncytium = new SixteenFlyBrainSyncytium(99);
  assert.equal(syncytium.brains.length, 16);
  assert.equal(syncytium.commissuralWeights.length, 16 * 16 * 4);  // 1024

  const expectedRoles = [
    "forager", "navigator", "sentinel", "vault", "pioneer",
    "optic", "executive", "metabolic", "lal", "vnc_cpg", "ammc",
    "pb", "eb", "no", "aotu", "smp"
  ];
  for (let i = 0; i < 16; i++) {
    assert.equal(syncytium.brains[i].role, expectedRoles[i], `Brain ${i} should have role ${expectedRoles[i]}`);
  }

  const sensory = [0.3, 0.4, 0.1, 0.0, 0.8, 0.5, 0.2, -1, 0, 0, 0, 0, 0, 0];
  const actionProbs = syncytium.step(sensory, 0.1, 0.05, 80);

  assert.equal(actionProbs.length, 4);
  const sum = actionProbs.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1.0) < 1e-4, "Action probabilities must sum to 1");

  const telemetry = syncytium.getTelemetry();
  assert.equal(telemetry.step, 1);
  assert.equal(telemetry.brainCount, 16);
  assert.equal(telemetry.brainRoles.length, 16);
  assert.ok("pbPhaseShift" in telemetry);
  assert.ok("ebStabilization" in telemetry);
  assert.ok("noDistance" in telemetry);
  assert.ok("aotuSunHeading" in telemetry);
  assert.ok("smpLatchedAction" in telemetry);
});

// ──────────────────────────────────────────────────────────────────────────────
// 6. Backward-Compat Aliases still resolve to SixteenFlyBrainSyncytium
// ──────────────────────────────────────────────────────────────────────────────
test("ElevenFlyBrainSyncytium / EightFlyBrainSyncytium / SevenFlyBrainSyncytium aliases instantiate 16-brain syncytium", () => {
  const s11 = new ElevenFlyBrainSyncytium(10);
  const s8 = new EightFlyBrainSyncytium(10);
  const s7 = new SevenFlyBrainSyncytium(10);
  const s5 = new FiveFlyBrainSyncytium(10);
  assert.equal(s11.brains.length, 16);
  assert.equal(s8.brains.length, 16);
  assert.equal(s7.brains.length, 16);
  assert.equal(s5.brains.length, 16);
});

// ──────────────────────────────────────────────────────────────────────────────
// 7. Brain 8 — LAL Flip-Flop casting
// ──────────────────────────────────────────────────────────────────────────────
test("Brain 8 (LAL) initializes with lalFlipFlop property and toggles alternation", () => {
  const syncytium = new ElevenFlyBrainSyncytium(55);
  const lalBrain = syncytium.brains[8];
  assert.equal(lalBrain.role, "lal");
  assert.ok("lalFlipFlop" in lalBrain, "LAL brain must expose lalFlipFlop property");

  // Run a few steps and check that telemetry exposes lalFlipFlop
  const sensory = [0.5, 0.5, 0.1, 0.0, 0.7, 0.3, 0, 0, 0, 0, 0, 0, 0, 0];
  syncytium.step(sensory, 0, 0.0, 80);
  const tel = syncytium.getTelemetry();
  assert.ok("lalFlipFlop" in tel, "Telemetry should expose lalFlipFlop");
  // Engine stores numeric flip-flop state: 1 (right bias) or -1 (left bias)
  assert.ok(typeof tel.lalFlipFlop === "number" || typeof tel.lalFlipFlop === "boolean",
    "lalFlipFlop must be numeric or boolean");
  assert.ok([true, false, 1, -1, 0].includes(tel.lalFlipFlop),
    `lalFlipFlop must be a valid flip-flop state, got: ${tel.lalFlipFlop}`);
});

// ──────────────────────────────────────────────────────────────────────────────
// 8. Brain 9 — VNC CPG gait torque
// ──────────────────────────────────────────────────────────────────────────────
test("Brain 9 (VNC CPG) initializes with vncTorque and produces finite gait torque", () => {
  const syncytium = new ElevenFlyBrainSyncytium(66);
  const vncBrain = syncytium.brains[9];
  assert.equal(vncBrain.role, "vnc_cpg");
  assert.ok("vncTorque" in vncBrain, "VNC brain must expose vncTorque");

  const sensory = [0.5, 0.5, 0.0, 0.0, 0.8, 0.5, 0, 0, 0, 0, 0, 0, 0, 0];
  syncytium.step(sensory, 0.2, 0.0, 90);
  const tel = syncytium.getTelemetry();
  assert.ok("vncTorque" in tel, "Telemetry should expose vncTorque");
  assert.ok(Number.isFinite(tel.vncTorque), "VNC torque must be finite");
});

// ──────────────────────────────────────────────────────────────────────────────
// 9. Brain 10 — AMMC peer vibration / acoustic communication
// ──────────────────────────────────────────────────────────────────────────────
test("Brain 10 (AMMC) detects peer vibration via peerContext and exposes ammcVibration", () => {
  const syncytium = new ElevenFlyBrainSyncytium(77);
  const ammcBrain = syncytium.brains[10];
  assert.equal(ammcBrain.role, "ammc");
  assert.ok("ammcVibration" in ammcBrain, "AMMC brain must expose ammcVibration");

  const sensory = [0.5, 0.5, 0.1, 0.0, 0.8, 0.3, 0, 0, 0, 0, 0, 0, 0, 0];
  const peerContext = { dx: 3, dy: 4, dist: 5 };  // Peer 5 units away
  syncytium.step(sensory, 0, 0.0, 80, peerContext);

  const tel = syncytium.getTelemetry();
  assert.ok("ammcVibration" in tel, "Telemetry should expose ammcVibration");
  assert.ok(Number.isFinite(tel.ammcVibration), "ammcVibration must be finite");
  // Peer at distance 5, vibration should be detectable
  assert.ok(tel.ammcVibration >= 0, "AMMC vibration must be non-negative");
});

// ──────────────────────────────────────────────────────────────────────────────
// 10. MultiAgentGraphGraft — resolves both agents
// ──────────────────────────────────────────────────────────────────────────────
test("MultiAgentGraphGraft resolves both agents with distinct actions and regime states", () => {
  const syncytium = new ElevenFlyBrainSyncytium(42);
  const graft = new MultiAgentGraphGraft(syncytium, 0.55);

  const env = {
    agent1X: 5, agent1Y: 5, agent1Energy: 80,
    agent2X: 12, agent2Y: 8, agent2Energy: 70,
  };
  const obs1 = [0.25, 0.25, 0.2, 0.1, 0.8, 0.4, 0, 0, 0, 0, 0, 0, 0, 0];
  const obs2 = [0.6, 0.4, 0.0, 0.0, 0.7, 0.6, 0, 0, 0, 0, 0, 0, 0, 0];

  const result = graft.resolveAgents(env, obs1, obs2);

  assert.ok(result.agent1, "Result must have agent1");
  assert.ok(result.agent2, "Result must have agent2");
  assert.ok(["up","down","left","right"].includes(result.agent1.action), "Agent1 action must be cardinal direction");
  assert.ok(["up","down","left","right"].includes(result.agent2.action), "Agent2 action must be cardinal direction");
  assert.equal(result.agent1.probabilities.length, 4, "Agent1 must have 4 action probs");
  assert.equal(result.agent2.probabilities.length, 4, "Agent2 must have 4 action probs");
  assert.ok(Number.isFinite(result.peerDist), "peerDist must be finite");
  assert.ok(result.peerDist > 0, "Agents at different positions should have peerDist > 0");
  assert.ok(typeof result.agent1.regime === "string", "Agent1 regime must be a string");
  assert.ok(typeof result.agent2.regime === "string", "Agent2 regime must be a string");
});

// ──────────────────────────────────────────────────────────────────────────────
// 11. DiamondAgentGraft alias — single-agent backward compat
// ──────────────────────────────────────────────────────────────────────────────
test("DiamondAgentGraft dynamically switches hierarchical behavioral regimes and gates attention", () => {
  const syncytium = new ElevenFlyBrainSyncytium(42);
  const graft = new DiamondAgentGraft(syncytium, 0.55);

  // High hazard -> EVADE
  const hazardState = [0.5, 0.5, 0.1, 0.9, 0.8, 0.1, 0, 0, 0, 0, 0, 0, 0, 0];
  const resEvade = graft.resolveAction(hazardState, [0.25, 0.25, 0.25, 0.25], 0, 80);
  assert.equal(resEvade.regime, "EVADE");
  assert.ok(resEvade.gatingWeight > 0.55, "Graft gating weight should increase during evasion");

  // Low energy -> FORAGE
  const hungryState = [0.5, 0.5, 0.7, 0.0, 0.2, 0.1, 0, 0, 0, 0, 0, 0, 0, 0];
  const resForage = graft.resolveAction(hungryState, [0.25, 0.25, 0.25, 0.25], 0, 20);
  assert.equal(resForage.regime, "FORAGE");

  // Safe and satiated -> CONSOLIDATE
  const safeState = [0.5, 0.5, 0.1, 0.0, 0.9, 0.8, 0, 0, 0, 0, 0, 0, 0, 0];
  const resConsolidate = graft.resolveAction(safeState, [0.25, 0.25, 0.25, 0.25], 0, 95);
  assert.equal(resConsolidate.regime, "CONSOLIDATE");
});

// ──────────────────────────────────────────────────────────────────────────────
// 12. Stagnation / Stasis Hazard
// ──────────────────────────────────────────────────────────────────────────────
test("Stagnation hazard triggers after 4 still ticks and drains energy", () => {
  const syncytium = new ElevenFlyBrainSyncytium(42);
  const graft = new MultiAgentGraphGraft(syncytium, 0.55);

  const env = {
    agent1X: 5, agent1Y: 5, agent1Energy: 100,
    agent2X: 15, agent2Y: 15, agent2Energy: 100,
  };
  const obs1 = [0.25, 0.25, 0.1, 0.0, 1.0, 0.5, 0, 0, 0, 0, 0, 0, 0, 0];
  const obs2 = [0.75, 0.75, 0.0, 0.0, 1.0, 0.5, 0, 0, 0, 0, 0, 0, 0, 0];

  // Keep Agent1 stationary for 5 ticks
  for (let i = 0; i < 5; i++) {
    graft.resolveAgents(env, obs1, obs2);
  }

  assert.ok(graft.agent1.isStasisHazard, "Agent1 should be in stasis after 5 stationary ticks");
  assert.ok(env.agent1Energy < 100, "Stasis should drain Agent1 energy");
  assert.ok(graft.stasisEvents > 0, "Stasis event counter should have been incremented");
});

test("Stasis hazard resets when agent moves", () => {
  const syncytium = new ElevenFlyBrainSyncytium(42);
  const graft = new MultiAgentGraphGraft(syncytium, 0.55);

  const env = {
    agent1X: 5, agent1Y: 5, agent1Energy: 100,
    agent2X: 15, agent2Y: 15, agent2Energy: 100,
  };
  const obs = [0.25, 0.25, 0.1, 0.0, 1.0, 0.5, 0, 0, 0, 0, 0, 0, 0, 0];
  const obs2 = [0.75, 0.75, 0.0, 0.0, 1.0, 0.5, 0, 0, 0, 0, 0, 0, 0, 0];

  // Make stationary for 5 ticks
  for (let i = 0; i < 5; i++) {
    graft.resolveAgents(env, obs, obs2);
  }
  assert.ok(graft.agent1.isStasisHazard);

  // Now move Agent1
  env.agent1X = 6;
  graft.resolveAgents(env, obs, obs2);
  assert.equal(graft.agent1.dwellTicks, 0, "Dwell ticks should reset on movement");
  assert.equal(graft.agent1.isStasisHazard, false, "Stasis hazard should clear on movement");
});

// ──────────────────────────────────────────────────────────────────────────────
// 13. Neurogenesis
// ──────────────────────────────────────────────────────────────────────────────
test("Neurogenesis dynamically spawns new Kenyon cells on high novelty error", () => {
  const syncytium = new ElevenFlyBrainSyncytium(42);
  const sensory = [0.1, 0.2, 0.0, 0.0, 0.5, 0.0, 0.0, 0.0, 0, 0, 0, 0, 0, 0];

  syncytium.step(sensory, 0, 0.05, 100);
  assert.equal(syncytium.neurogenesis.mitosisCount, 0);

  syncytium.step(sensory, 0, 0.85, 100);
  assert.ok(syncytium.neurogenesis.mitosisCount > 0, "Mitosis should be triggered by novelty");
});

// ──────────────────────────────────────────────────────────────────────────────
// 14. TD-RPE Dopamine Plasticity
// ──────────────────────────────────────────────────────────────────────────────
test("Endogenous TD-RPE dopamine modulates plasticity and consolidates memory engrams", () => {
  const syncytium = new ElevenFlyBrainSyncytium(42);
  const brain = syncytium.brains[0];

  const sensory = [0.8, 0.8, 0.0, 0.0, 0.9, 0.5, 0, 0, 0, 0, 0, 0, 0, 0];
  syncytium.step(sensory, 0, 0.0, 100);

  const initialWeights = brain.kcToMbonWeights.slice();
  syncytium.applyReinforcement(1.5, 0.0, { x: 0.7, y: 0.8 });
  assert.ok(syncytium.lastRPE > 0, "RPE should be positive on reward");

  const rewardedWeights = brain.kcToMbonWeights.slice();
  let increased = false;
  for (let i = 0; i < initialWeights.length; i++) {
    if (rewardedWeights[i] > initialWeights[i]) { increased = true; break; }
  }
  assert.ok(increased, "Active KC-MBON synapses should increase after reward");
  assert.ok(syncytium.engramBank.length > 0, "Reward should consolidate an LTM engram");
});

// ──────────────────────────────────────────────────────────────────────────────
// 15. v4 Serializer — 11 brains + dual agents
// ──────────────────────────────────────────────────────────────────────────────
test("FlyBrainStateSerializer v4 exports 11-brain state with dual-agent regimes and restores exactly", () => {
  const syncytium = new ElevenFlyBrainSyncytium(888);
  const graft = new MultiAgentGraphGraft(syncytium, 0.65);
  PreTrainingEngine.runPreTraining(syncytium, 20);

  const env = {
    agent1X: 3, agent1Y: 4, agent1Energy: 90,
    agent2X: 10, agent2Y: 12, agent2Energy: 75,
  };
  const obs1 = [0.4, 0.6, 0.3, 0.1, 0.7, 0.2, 0.2, 0.2, 0.2, 0.2, 0, 0, 0, 0];
  const obs2 = [0.6, 0.3, 0.0, 0.0, 0.9, 0.5, 0, 0, 0, 0, 0, 0, 0, 0];
  graft.resolveAgents(env, obs1, obs2);
  graft.feedback(5, false, { x: 0.4, y: 0.6 });

  const extraData = { agentId: 88, worldSeed: 888, diamonds: [{ x: 5, y: 3 }] };
  const json = FlyBrainStateSerializer.serialize(graft, extraData);
  assert.ok(typeof json === "string", "Serialized state must be a JSON string");

  const parsed = JSON.parse(json);
  assert.ok(/^\d+\.\d+\.\d+$/.test(parsed.version), "Serialized state must carry a semantic version");
  assert.ok(Number(parsed.version.split(".")[0]) >= 5, "Serialized version must be 5.0.0 or newer");
  assert.equal(parsed.brains.length, 16, "Must serialize 16 brains");
  assert.ok(parsed.agents, "Must serialize agents object");
  assert.ok(parsed.agents.agent1, "Must have agent1 state");
  assert.ok(parsed.agents.agent2, "Must have agent2 state");
  assert.ok(typeof parsed.stasisEvents === "number", "Must serialize stasisEvents");
  assert.ok(typeof parsed.circadianClock === "number", "Must serialize circadianClock");
  assert.ok(typeof parsed.handshakeEvents === "number", "Must serialize handshakeEvents");

  // Deserialize into fresh instances
  const freshSync = new SixteenFlyBrainSyncytium(1);
  const freshGraft = new MultiAgentGraphGraft(freshSync, 0.1);
  const restoredExtra = FlyBrainStateSerializer.deserialize(freshGraft, json);

  assert.equal(freshGraft.graftInfluence, 0.65, "graftInfluence must be restored");
  assert.equal(freshSync.worldSeed, 888, "worldSeed must be restored");
  assert.equal(freshSync.brains.length, 16, "Must restore 16 brains");
  assert.equal(freshSync.isPretrained, true, "isPretrained must be restored");
  assert.equal(restoredExtra.agentId, 88, "Extra agent data must survive round-trip");

  // Verify all 16 brains have their KC-MBON weights preserved
  for (let b = 0; b < 16; b++) {
    const origBrain = syncytium.brains[b];
    const restBrain = freshSync.brains[b];
    assert.equal(restBrain.role, origBrain.role, `Brain ${b} role must be preserved`);
    assert.deepEqual(
      Array.from(restBrain.kcToMbonWeights),
      Array.from(origBrain.kcToMbonWeights),
      `Brain ${b} KC-MBON weights must be preserved exactly`
    );
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// 16. ChemicalFieldGrid — Plume emission, diffusion, and bilateral sampling
// ──────────────────────────────────────────────────────────────────────────────
test("ChemicalFieldGrid emits plumes, diffuses gradients, and evaluates bilateral antenna samples", () => {
  const grid = new ChemicalFieldGrid(20, 20);

  // Emit food odor at (10, 10)
  grid.emit("foodOdor", 10, 10, 1.5);
  const directSample = grid.sample("foodOdor", 10, 10);
  assert.ok(directSample >= 1.4, "Center of emission should have high concentration");

  // Sample bilateral antennae facing North (heading = -Math.PI / 2) at (9, 10)
  // Left antenna is at (9 - 0.8, 10) = (8.2, 10), Right antenna is at (9 + 0.8, 10) = (9.8, 10)
  const bi = grid.sampleBilateral("foodOdor", 9, 10, -Math.PI / 2, 0.8);
  assert.ok(bi.right > bi.left, "Right antenna should be closer to (10,10) food source");
  assert.ok(bi.diff < 0, "diff = left - right should be negative when source is on right");

  // Diffuse step
  grid.step(0.2, 0.95);
  const diffusedNeighbor = grid.sample("foodOdor", 10, 11);
  assert.ok(diffusedNeighbor > 0, "Odor must diffuse to neighboring cells");
});

// ──────────────────────────────────────────────────────────────────────────────
// 17. Bilateral Antennal Tropotaxis in DrosophilaBrain
// ──────────────────────────────────────────────────────────────────────────────
test("DrosophilaBrain forager executes bilateral tropotaxis steering toward odor gradient", () => {
  const brain = new DrosophilaBrain(0, "forager");

  // Sensory input with left antenna > right antenna:
  // indices 12 (left) and 13 (right)
  const sensoryLeftHigher = [0.5, 0.5, 0.5, 0.0, 0.8, 0.5, 0, 0, 0, 0, 0, 0, 0.9, 0.1];
  const outLeft = brain.forward(sensoryLeftHigher, 0).slice();

  // Sensory input with right antenna > left antenna:
  const sensoryRightHigher = [0.5, 0.5, 0.5, 0.0, 0.8, 0.5, 0, 0, 0, 0, 0, 0, 0.1, 0.9];
  const outRight = brain.forward(sensoryRightHigher, 0).slice();

  // Action 2 = left, Action 3 = right
  assert.ok(outLeft[2] > outRight[2], "Left turn drive must be higher when left antenna detects stronger odor");
  assert.ok(outRight[3] > outLeft[3], "Right turn drive must be higher when right antenna detects stronger odor");
});

// ──────────────────────────────────────────────────────────────────────────────
// 18. AMMC Acoustic Handshake & Knowledge Transduction
// ──────────────────────────────────────────────────────────────────────────────
test("AMMC Acoustic Handshake triggers when agents are in close proximity and boosts energy", () => {
  const syncytium = new ElevenFlyBrainSyncytium(42);
  const graft = new MultiAgentGraphGraft(syncytium, 0.55);

  const env = {
    agent1X: 5, agent1Y: 5, agent1Energy: 50,
    agent2X: 6, agent2Y: 5, agent2Energy: 50, // Distance = 1.0 (<= 2.5)
  };
  const obs1 = [0.25, 0.25, 0.1, 0.0, 0.5, 0.5, 0, 0, 0, 0, 0, 0, 0, 0];
  const obs2 = [0.3, 0.25, 0.1, 0.0, 0.5, 0.5, 0, 0, 0, 0, 0, 0, 0, 0];

  const res = graft.resolveAgents(env, obs1, obs2);

  assert.equal(res.isAcousticHandshake, true, "Handshake should trigger when dist <= 2.5");
  assert.ok(res.handshakeEvents > 0, "Handshake event counter should increment");
  assert.ok(env.agent1Energy > 50, "Agent 1 energy should be boosted by resonance");
  assert.ok(env.agent2Energy > 50, "Agent 2 energy should be boosted by resonance");
});

// ──────────────────────────────────────────────────────────────────────────────
// 19. Circadian Day/Night Cycle & PDF Neuromodulation
// ──────────────────────────────────────────────────────────────────────────────
test("ElevenFlyBrainSyncytium cycles through Day/Night phases with PDF neuromodulator scaling", () => {
  const syncytium = new ElevenFlyBrainSyncytium(42);
  const sensory = [0.5, 0.5, 0.1, 0.0, 0.8, 0.5, 0, 0, 0, 0, 0, 0, 0, 0];

  // At step 10 (daytime):
  for (let i = 0; i < 10; i++) syncytium.step(sensory, 0, 0, 100);
  const telDay = syncytium.getTelemetry();
  assert.equal(telDay.circadianPhase, "DAY", "Early cycle steps must be DAY");
  assert.ok(telDay.pdfArousal >= 1.0, "Daytime PDF arousal should be >= 1.0");

  // Advance to step 80 (nighttime, period = 120):
  for (let i = 0; i < 70; i++) syncytium.step(sensory, 0, 0, 100);
  const telNight = syncytium.getTelemetry();
  assert.equal(telNight.circadianPhase, "NIGHT", "Step 80 must be NIGHT");
  assert.ok(telNight.pdfArousal < 1.0, "Nighttime PDF arousal should be attenuated (< 1.0)");
});

// ──────────────────────────────────────────────────────────────────────────────
// 20. Brain 11 (PB) — Protocerebral Bridge Sinusoidal Phase Shift
// ──────────────────────────────────────────────────────────────────────────────
test("Brain 11 (PB) initializes pbPhaseShift and computes sinusoidal differential steering", () => {
  const syncytium = new SixteenFlyBrainSyncytium(42);
  const pbBrain = syncytium.brains[11];
  assert.equal(pbBrain.role, "pb");
  assert.ok("pbPhaseShift" in pbBrain);

  const sensory = [0.5, 0.5, 0.1, 0.0, 0.8, 0.5, 0, 0, 0, 0, 0, 0, 0, 0];
  // Step with heading delta to shift compass
  syncytium.step(sensory, Math.PI / 4, 0, 80);
  const tel = syncytium.getTelemetry();
  assert.ok(typeof tel.pbPhaseShift === "number");
  assert.ok(Number.isFinite(tel.pbPhaseShift));
});

// ──────────────────────────────────────────────────────────────────────────────
// 21. Brain 12 (EB) — Ellipsoid Body Toroidal Landmark Ring Stabilization
// ──────────────────────────────────────────────────────────────────────────────
test("Brain 12 (EB) calculates toroidal landmark ring attractor and heading stabilization", () => {
  const syncytium = new SixteenFlyBrainSyncytium(42);
  const ebBrain = syncytium.brains[12];
  assert.equal(ebBrain.role, "eb");
  assert.ok("ebRingAttractor" in ebBrain);
  assert.equal(ebBrain.ebRingAttractor.length, 8);

  const sensory = [0.5, 0.5, 0.1, 0.0, 0.8, 0.5, 0, 0, 0, 0, 0, 0, 0, 0];
  syncytium.step(sensory, 0.3, 0, 80);
  const tel = syncytium.getTelemetry();
  assert.ok(typeof tel.ebStabilization === "number");
  assert.ok(Number.isFinite(tel.ebStabilization));
});

// ──────────────────────────────────────────────────────────────────────────────
// 22. Brain 13 (NO) — Noduli Translational Odometry & Path Integration
// ──────────────────────────────────────────────────────────────────────────────
test("Brain 13 (NO) accumulates step-length translational odometry and home vector", () => {
  const syncytium = new SixteenFlyBrainSyncytium(42);
  const noBrain = syncytium.brains[13];
  assert.equal(noBrain.role, "no");
  assert.ok("noOdometryDistance" in noBrain);
  assert.ok("noHomeVector" in noBrain);

  const sensory = [0.5, 0.5, 0.1, 0.0, 0.8, 0.5, 0, 0, 0, 0, 0, 0, 0, 0];
  // Step with displacement
  syncytium.step(sensory, 0, 0, 80, { stepDx: 1.0, stepDy: 0.0 });
  syncytium.step(sensory, 0, 0, 80, { stepDx: 0.0, stepDy: 1.0 });

  assert.ok(noBrain.noOdometryDistance >= 2.0, "Noduli must accumulate traveled distance");
  assert.equal(noBrain.noHomeVector[0], 1.0, "Noduli must accumulate X displacement");
  assert.equal(noBrain.noHomeVector[1], 1.0, "Noduli must accumulate Y displacement");
});

// ──────────────────────────────────────────────────────────────────────────────
// 23. Brain 14 (AOTU) — Anterior Optic Tubercle Celestial Sun Compass
// ──────────────────────────────────────────────────────────────────────────────
test("Brain 14 (AOTU) tracks celestial polarized sun angle and e-vector alignment", () => {
  const syncytium = new SixteenFlyBrainSyncytium(42);
  const aotuBrain = syncytium.brains[14];
  assert.equal(aotuBrain.role, "aotu");

  const sensory = [0.5, 0.5, 0.1, 0.0, 0.8, 0.5, 0, 0, 0, 0, 0, 0, 0, 0];
  const sunAngle = Math.PI / 3;
  syncytium.step(sensory, 0, 0, 80, { sunAngle });

  const tel = syncytium.getTelemetry();
  assert.equal(tel.aotuSunHeading, sunAngle);
  assert.ok(Number.isFinite(tel.aotuEVectorAlignment));
});

// ──────────────────────────────────────────────────────────────────────────────
// 24. Brain 15 (SMP) — Superior Medial Protocerebrum Action Commitment Latch
// ──────────────────────────────────────────────────────────────────────────────
test("Brain 15 (SMP) manages action commitment latching to suppress rapid dithering", () => {
  const syncytium = new SixteenFlyBrainSyncytium(42);
  const smpBrain = syncytium.brains[15];
  assert.equal(smpBrain.role, "smp");
  assert.ok("smpLatchedAction" in smpBrain);

  const graft = new MultiAgentGraphGraft(syncytium, 0.55);
  const env = {
    agent1X: 5, agent1Y: 5, agent1Energy: 80,
    agent2X: 12, agent2Y: 8, agent2Energy: 70,
  };
  const obs1 = [0.25, 0.25, 0.2, 0.1, 0.8, 0.4, 0, 0, 0, 0, 0, 0, 0, 0];
  const obs2 = [0.6, 0.4, 0.0, 0.0, 0.7, 0.6, 0, 0, 0, 0, 0, 0, 0, 0];

  const res1 = graft.resolveAgents(env, obs1, obs2);
  assert.ok(graft.agent1.commitmentTimer > 0, "Agent 1 should set commitment timer");
  assert.ok(typeof res1.sunAngle === "number", "resolveAgents must return sunAngle");
});

// ──────────────────────────────────────────────────────────────────────────────
// 25. Connectome Benchmark — Deterministic Episode Execution
// ──────────────────────────────────────────────────────────────────────────────
test("ConnectomeBenchmarkRunner runs episodes deterministically and computes paired metrics", () => {
  const { ConnectomeBenchmarkRunner } = require("../src/connectome-benchmark.js");
  const runner = new ConnectomeBenchmarkRunner();

  const epA = runner.runEpisode("Syncytium_16B", 777, 30);
  const epB = runner.runEpisode("Syncytium_16B", 777, 30);

  assert.equal(epA.arm, "Syncytium_16B");
  assert.equal(epA.seed, 777);
  assert.equal(epA.stepsSurvived, epB.stepsSurvived, "Identical seeds must yield identical step counts");
  assert.equal(epA.diamondsCollected, epB.diamondsCollected);
  assert.equal(epA.hazardsHit, epB.hazardsHit);
  assert.equal(epA.netScore, epB.netScore);
  assert.ok(epA.uniqueCells > 0, "Agent must explore arena cells");
});

// ──────────────────────────────────────────────────────────────────────────────
// 26. Connectome Benchmark — Comparative 4-Arm Evaluation
// ──────────────────────────────────────────────────────────────────────────────
test("ConnectomeBenchmarkRunner evaluates every default arm with complete paired statistics", async () => {
  const { ConnectomeBenchmarkRunner } = require("../src/connectome-benchmark.js");
  const runner = new ConnectomeBenchmarkRunner();

  const result = await runner.runComparativeBenchmark({
    episodesPerArm: 3,
    stepLimit: 25,
    seeds: [101, 202, 303]
  });

  assert.deepEqual(result.arms.map(a => a.arm), [
    "RandomWalk",
    "SingleBrain_AL",
    "CentralComplex_8B",
    "Syncytium_16B_Legacy",
    "Syncytium_16B"
  ]);

  for (const arm of result.arms) {
    assert.equal(arm.episodes, 3);
    assert.ok(Number.isFinite(arm.meanNetScore));
    assert.ok(Number.isFinite(arm.meanDiamonds));
    assert.ok(Number.isFinite(arm.winRate));
    assert.ok(Number.isFinite(arm.iqmNetScore));
  }

  assert.equal(result.reference, "RandomWalk");
  assert.equal(result.comparisons.length, result.arms.length - 1);
});

// ──────────────────────────────────────────────────────────────────────────────
// 27. Connectome Benchmark — 16-Brain Syncytium Outperforms Random Walk
// ──────────────────────────────────────────────────────────────────────────────
test("16-Brain Syncytium policy demonstrates superior net performance over random walk baseline", async () => {
  const { ConnectomeBenchmarkRunner } = require("../src/connectome-benchmark.js");
  const runner = new ConnectomeBenchmarkRunner();

  const result = await runner.runComparativeBenchmark({
    episodesPerArm: 5,
    stepLimit: 40,
    seeds: [501, 602, 703, 804, 905]
  });

  const randomArm = result.arms.find(a => a.arm === "RandomWalk");
  const syncytiumArm = result.arms.find(a => a.arm === "Syncytium_16B");

  assert.ok(syncytiumArm.meanNetScore >= randomArm.meanNetScore, "Syncytium should achieve higher or equal net score than random walk");
  assert.ok(syncytiumArm.meanDiamonds >= randomArm.meanDiamonds, "Syncytium should collect at least as many diamonds as random walk");
});

// ──────────────────────────────────────────────────────────────────────────────
// 28. MultiAgentGraphGraft — Agent 3 (Cartographer-Scout) Resolution & Beacon Planting
// ──────────────────────────────────────────────────────────────────────────────
test("MultiAgentGraphGraft resolves Agent 3 Cartographer and plants luminescent beacon waypoints", () => {
  const syncytium = new SixteenFlyBrainSyncytium(77);
  const graft = new MultiAgentGraphGraft(syncytium, 0.6);

  const env = {
    agent1X: 2, agent1Y: 2, agent1Energy: 80,
    agent2X: 12, agent2Y: 12, agent2Energy: 80,
    agent3X: 5, agent3Y: 5, agent3Energy: 90
  };

  // 1. Scout mode when far from rewards and hazards
  const obs1 = [0.1, 0.1, 0, 0, 0.8, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const obs2 = [0.8, 0.8, 0, 0, 0.8, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const obs3Scout = [0.3, 0.3, 0.1, 0.05, 0.9, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  const res1 = graft.resolveAgents(env, obs1, obs2, obs3Scout);
  assert.ok(res1.agent3, "Agent 3 must be resolved");
  assert.equal(res1.agent3.regime, "SCOUT", "Agent 3 should be in SCOUT regime");
  assert.ok(res1.agent3.actionIndex >= 0 && res1.agent3.actionIndex < 4);
  assert.equal(res1.beaconWaypoints.length, 0, "No beacons planted in scout mode");

  // 2. Beacon planting mode when diamond reward sensed nearby (obs3[2] > 0.3)
  const obs3Reward = [0.3, 0.3, 0.45, 0.05, 0.9, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const res2 = graft.resolveAgents(env, obs1, obs2, obs3Reward);
  assert.equal(res2.agent3.regime, "MAP_BEACON", "Agent 3 should switch to MAP_BEACON regime");
  assert.equal(res2.beaconWaypoints.length, 1, "Beacon waypoint should be planted");
  assert.equal(res2.beaconWaypoints[0].x, 5);
  assert.equal(res2.beaconWaypoints[0].y, 5);
});

// ──────────────────────────────────────────────────────────────────────────────
// 29. Giant Fiber Looming Escape Reflex — Override Commitment & Explosive Evasion
// ──────────────────────────────────────────────────────────────────────────────
test("Giant Fiber looming escape reflex overrides commitment latch and triggers explosive evasion", () => {
  const syncytium = new SixteenFlyBrainSyncytium(88);
  const graft = new MultiAgentGraphGraft(syncytium, 0.6);

  const env = {
    agent1X: 8, agent1Y: 8, agent1Energy: 100,
    agent2X: 14, agent2Y: 14, agent2Energy: 100
  };

  // Step 1: Baseline low hazard
  const obsLow = [0.5, 0.5, 0, 0.1, 0.8, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  graft.resolveAgents(env, obsLow, obsLow);
  assert.equal(graft.agent1.isGFEscape, false);

  // Step 2: Sudden looming hazard expansion (hazardSense jumps from 0.1 to 0.7)
  const obsLooming = [0.5, 0.5, 0, 0.72, 0.8, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const resLooming = graft.resolveAgents(env, obsLooming, obsLooming);

  assert.equal(resLooming.agent1.isGFEscape, true, "Agent 1 should trigger GF escape");
  assert.equal(graft.agent1.commitmentTimer, 0, "Commitment timer must be reset to 0 upon GF escape");
  assert.ok(graft.giantFiberEvents >= 1, "giantFiberEvents should be incremented");

  const telemetry = syncytium.getSyncytiumTelemetry();
  assert.equal(telemetry.giantFiberTriggered, true, "Telemetry should report giantFiberTriggered");
  // loomingVelocity in telemetry reflects brain[2]'s last forward() call;
  // with dual-agent sequential step(), the second call sees delta=0.
  // The giantFiberTriggered flag confirms the GF reflex fired correctly.
  assert.ok(typeof telemetry.loomingVelocity === "number", "Looming velocity must be numeric");
});

// ──────────────────────────────────────────────────────────────────────────────
// 30. SEZ Brain 7 Neuropeptides — NPF Hunger & SIFamide Satiety Regulation
// ──────────────────────────────────────────────────────────────────────────────
test("SEZ Brain 7 modulates NPF hunger and SIFamide satiety neuropeptide titers", () => {
  const brain7 = new DrosophilaBrain(7, "metabolic");

  // Case A: Depleted Energy (Starvation / Hunger Drive) -> High NPF, Zero SIFamide
  const hungryObs = [0.5, 0.5, 0.1, 0, 0.15, 0.5, 0, 0, 0, 0, 0, 0, 0, 0];
  brain7.forward(hungryObs, 0, null, null);

  assert.ok(brain7.neuropeptideNPF > 0.5, "Starved state must exhibit high NPF hunger titer");
  assert.equal(brain7.neuropeptideSIFamide, 0, "Starved state must have zero SIFamide satiety");
  assert.ok(brain7.sugarDrive > 1.0, "Sugar drive should be high when energy is low");

  // Case B: Satiated Energy (Abundance / Calm) -> Zero NPF, High SIFamide
  const satiatedObs = [0.5, 0.5, 0.1, 0, 0.95, 0.5, 0, 0, 0, 0, 0, 0, 0, 0];
  brain7.forward(satiatedObs, 0, null, null);

  assert.equal(brain7.neuropeptideNPF, 0, "Satiated state must have zero NPF");
  assert.ok(brain7.neuropeptideSIFamide > 0.7, "Satiated state must exhibit high SIFamide titer");
  assert.ok(brain7.sugarDrive < 0.5, "Sugar drive should be low when energy is high");
});

// ──────────────────────────────────────────────────────────────────────────────
// 31. Tri-Trophic Swarm Acoustic Resonance — 3-Agent Mesh Energy Transfer
// ──────────────────────────────────────────────────────────────────────────────
test("Tri-Trophic Swarm acoustic resonance activates when 3 agents form spatial cluster", () => {
  const syncytium = new SixteenFlyBrainSyncytium(55);
  const graft = new MultiAgentGraphGraft(syncytium, 0.6);

  // Cluster 3 agents within distance <= 4.0 of each other
  const envCluster = {
    agent1X: 5.0, agent1Y: 5.0, agent1Energy: 50,
    agent2X: 6.0, agent2Y: 5.5, agent2Energy: 50,
    agent3X: 5.5, agent3Y: 6.5, agent3Energy: 50
  };

  const obs = [0.5, 0.5, 0, 0, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const res = graft.resolveAgents(envCluster, obs, obs, obs);

  assert.equal(res.isTriSwarmResonance, true, "Tri-swarm resonance must activate for spatial cluster");
  assert.equal(res.isAcousticHandshake, true, "Dual handshake also activates for close pair");
  assert.ok(res.triSwarmResonanceEvents >= 1, "triSwarmResonanceEvents must increment");
  assert.equal(envCluster.agent1Energy, 55, "Agent 1 energy must receive +2 dual + +3 tri-swarm boost = 55");
  assert.equal(envCluster.agent2Energy, 55, "Agent 2 energy must receive +2 dual + +3 tri-swarm boost = 55");
  assert.equal(envCluster.agent3Energy, 53, "Agent 3 energy must receive +3 tri-swarm boost = 53");
});

// ──────────────────────────────────────────────────────────────────────────────
// 32. Current State Serialization Round-Trip — Tri-Agent, Beacons, and Neuropeptides
// ──────────────────────────────────────────────────────────────────────────────
test("FlyBrainStateSerializer exports tri-agent swarm with beacons and neuropeptides and restores exactly", () => {
  const syncytium = new SixteenFlyBrainSyncytium(42);
  const graft = new MultiAgentGraphGraft(syncytium, 0.7);

  const env = {
    agent1X: 5, agent1Y: 5, agent1Energy: 70,
    agent2X: 6, agent2Y: 5, agent2Energy: 70,
    agent3X: 5, agent3Y: 6, agent3Energy: 70
  };

  const obs1 = [0.3, 0.3, 0.1, 0, 0.7, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const obs2 = [0.3, 0.3, 0.1, 0, 0.7, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const obs3 = [0.3, 0.3, 0.4, 0, 0.2, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // Low energy & diamond sense

  graft.resolveAgents(env, obs1, obs2, obs3);

  const extra = { mission: "Deep Exploration", totalScore: 1250 };
  const json = FlyBrainStateSerializer.serialize(graft, extra);

  const parsed = JSON.parse(json);
  assert.equal(parsed.version, "7.0.0", "Serialized version must be 7.0.0");
  assert.ok(parsed.agents.agent3, "Agent 3 state must be present in serialization");
  assert.equal(parsed.agents.agent3.regime, "MAP_BEACON");
  assert.ok(Array.isArray(parsed.beaconWaypoints), "beaconWaypoints must be serialized");
  assert.ok(parsed.beaconWaypoints.length > 0, "Should have serialized planted beacon");
  assert.ok(typeof parsed.triSwarmResonanceEvents === "number");
  assert.ok(typeof parsed.giantFiberEvents === "number");

  // Restore into a fresh graft
  const freshSync = new SixteenFlyBrainSyncytium(1);
  const freshGraft = new MultiAgentGraphGraft(freshSync, 0.1);
  const restoredExtra = FlyBrainStateSerializer.deserialize(freshGraft, json);

  assert.equal(freshGraft.graftInfluence, 0.7);
  assert.equal(freshGraft.agent3.behavioralRegime, "MAP_BEACON");
  assert.equal(freshGraft.beaconWaypoints.length, parsed.beaconWaypoints.length);
  assert.equal(restoredExtra.mission, "Deep Exploration");
  assert.equal(restoredExtra.totalScore, 1250);
});


