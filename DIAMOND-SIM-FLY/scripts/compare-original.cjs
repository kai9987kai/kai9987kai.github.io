"use strict";

// A fixed, reproducible whole-core comparison. The in-core "legacy" planner is
// an ablation of the current implementation, not a frozen-original baseline.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { performance } = require("node:perf_hooks");
const core = require("../src/worldlab-core.js");
const experiments = require("../src/worldlab-experiments.js");

const ROOT = path.resolve(__dirname, "..");
const ORIGINAL_COMMIT = "3abf50785a178e1f78e216cc10dce66928ce0760";
const CONFIG = Object.freeze({
  seeds: Object.freeze(Array.from({ length: 20 }, (_, index) => index + 1)),
  steps: 300,
  numAgents: 2,
  params: Object.freeze({ ...core.DEFAULT_PARAMS }),
  bootstrapSamples: 2000,
  bootstrapSeed: 20260912
});
const sha256 = value => crypto.createHash("sha256").update(value).digest("hex");

function originalDeclarations(html) {
  const scripts = Array.from(html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi));
  const matches = scripts.filter(match => match[1].includes("class Simulation {"));
  assert.equal(matches.length, 1, "Expected exactly one original Simulation script");
  const script = matches[0][1];
  const startup = "    const simulation = new Simulation();";
  assert.equal(script.split(startup).length, 2, "Original startup marker must be unique");
  const declarations = script.slice(0, script.indexOf(startup));
  assert.ok(declarations.includes("class Agent {") && declarations.includes("collectMetrics(summary)"));
  return declarations;
}

function loadOriginal(declarations) {
  const nodes = new Map();
  // DOM controls are inert data holders. No simulation method is reconstructed.
  const document = {
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, {
        value: "", checked: false, textContent: "",
        addEventListener() {}, getContext() { return {}; }
      });
      return nodes.get(id);
    }
  };
  const context = vm.createContext({ document, performance });
  new vm.Script(declarations + "\nthis.OriginalSimulation = Simulation;", {
    filename: `${ORIGINAL_COMMIT}:worldlab.html#unchanged-declarations`
  }).runInContext(context, { timeout: 10000 });
  const Simulation = context.OriginalSimulation;
  // These are the only original class methods overridden. All reset, policy,
  // environment, learning, communication and metric code executes unchanged.
  for (const name of ["draw", "updatePanels", "toast"]) Simulation.prototype[name] = function () {};
  const controlIds = {
    learningRate: "learning-rate", discount: "discount", epsilon: "epsilon",
    curiosity: "curiosity", planning: "planning", planningHorizon: "horizon",
    observeRadius: "observe-radius", diffusionSteps: "diffusion-steps",
    communication: "communication", movingHazards: "moving-hazards"
  };
  return seed => {
    document.getElementById("seed-input").value = String(seed);
    document.getElementById("num-agents").value = String(CONFIG.numAgents);
    for (const [name, id] of Object.entries(controlIds)) {
      const node = document.getElementById(id);
      if (typeof CONFIG.params[name] === "boolean") node.checked = CONFIG.params[name];
      else node.value = String(CONFIG.params[name]);
    }
    const run = new Simulation(); // Original constructor invokes original reset.
    const expected = Object.fromEntries(Object.keys(controlIds).map(name => [name, CONFIG.params[name]]));
    assert.equal(JSON.stringify(run.params()), JSON.stringify(expected), "Original controls differ from fixed protocol");
    return run;
  };
}

function sharedInitialState(run) {
  const normalize = value => {
    if (ArrayBuffer.isView(value)) return Array.from(value);
    if (Array.isArray(value)) return Array.from(value, normalize);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.keys(value).sort().map(key => [key,
        key === "rng" ? { seed: value[key].seed >>> 0 } : normalize(value[key])]));
    }
    return value;
  };
  const pick = (value, keys) => Object.fromEntries(keys.map(key => [key, value[key]]));
  return normalize({
    env: pick(run.env, ["seed", "rng", "state", "obstacles", "energy", "hazards", "pulseLoc", "t"]),
    rng: run.rng,
    stepCount: run.stepCount,
    agents: run.agents.map(agent => pick(agent, [
      "id", "rng", "x", "y", "renderX", "renderY", "energy", "totalExtrinsic",
      "totalIntrinsic", "collisions", "hazardHits", "steps", "path", "currentPlan",
      "observed", "visits", "belief", "uncertainty", "error", "q", "knownStates", "knownFlag"
    ]))
  });
}

function measure(run, elapsedMs, observedRespawns) {
  const agents = run.agents;
  const sum = key => agents.reduce((total, agent) => total + agent[key], 0);
  const mean = fn => agents.reduce((total, agent) => total + fn(agent), 0) / agents.length;
  const last = run.history.at(-1); // Both original and new stepping collect metrics.
  assert.equal(last.step, CONFIG.steps);
  assert.equal(last.coverage, mean(agent => agent.coverage()));
  assert.equal(last.hazards, sum("hazardHits"));
  return {
    totalExtrinsic: sum("totalExtrinsic"),
    totalExtrinsicPerAgent: sum("totalExtrinsic") / agents.length,
    totalIntrinsic: sum("totalIntrinsic"),
    coverage: last.coverage,
    modelMAE: last.mae,
    energy: mean(agent => agent.energy),
    collisions: sum("collisions"),
    hazardHits: sum("hazardHits"),
    respawns: observedRespawns.reduce((total, count) => total + count, 0),
    elapsedMs,
    steps: run.stepCount,
    numAgents: agents.length,
    perAgent: agents.map((agent, index) => ({
      id: agent.id, totalExtrinsic: agent.totalExtrinsic, totalIntrinsic: agent.totalIntrinsic,
      coverage: agent.coverage(), modelMAE: agent.modelMAE(run.env),
      energy: agent.energy, collisions: agent.collisions, hazardHits: agent.hazardHits,
      respawns: observedRespawns[index]
    })),
    lastStepMetrics: last
  };
}

function runArm(seed, arm, createOriginal) {
  const setupStarted = performance.now();
  const run = arm === "baseline" ? createOriginal(seed) : core.createRun(seed, CONFIG.numAgents, CONFIG.params);
  const setupElapsed = performance.now() - setupStarted;
  const initialStateSha256 = sha256(JSON.stringify(sharedInitialState(run)));
  const respawns = run.agents.map(() => 0);
  const steppingStarted = performance.now();
  for (let step = 0; step < CONFIG.steps; step++) {
    // Agent.step's energy <= 0 branch respawns once at the start of a step.
    run.agents.forEach((agent, index) => { if (agent.energy <= 0) respawns[index]++; });
    if (arm === "baseline") run.step();
    else core.stepRun(run);
  }
  const elapsedMs = setupElapsed + performance.now() - steppingStarted;
  if (arm === "candidate") {
    run.agents.forEach((agent, index) => assert.equal(agent.respawns, respawns[index]));
  }
  return { initialStateSha256, metrics: measure(run, elapsedMs, respawns) };
}

function main() {
  if (process.argv.length > 2) {
    throw new Error("This comparison has a fixed protocol; run node scripts/compare-original.cjs without options.");
  }
  const htmlBytes = execFileSync("git", ["show", `${ORIGINAL_COMMIT}:worldlab.html`], { cwd: ROOT, maxBuffer: 4 * 1024 * 1024 });
  const declarations = originalDeclarations(htmlBytes.toString("utf8"));
  const sourcePaths = ["src/worldlab-core.js", "src/worldlab-experiments.js", "scripts/compare-original.cjs"];
  const sourceHashes = Object.fromEntries(sourcePaths.map(file => [file, sha256(fs.readFileSync(path.join(ROOT, file)))]));
  const createOriginal = loadOriginal(declarations);
  const startedAt = new Date().toISOString();
  const pairs = [];
  for (const seed of CONFIG.seeds) {
    const order = seed % 2 ? ["baseline", "candidate"] : ["candidate", "baseline"];
    const arms = {};
    for (const arm of order) arms[arm] = runArm(seed, arm, createOriginal);
    assert.equal(arms.candidate.initialStateSha256, arms.baseline.initialStateSha256,
      `Seed ${seed}: the complete common initial simulation state differs`);
    const pair = {
      seed, order,
      initialState: {
        equal: true,
        candidateSha256: arms.candidate.initialStateSha256,
        baselineSha256: arms.baseline.initialStateSha256
      },
      candidate: arms.candidate.metrics,
      baseline: arms.baseline.metrics
    };
    pair.delta = Object.fromEntries(experiments.METRICS.map(metric => [metric, pair.candidate[metric] - pair.baseline[metric]]));
    pairs.push(pair);
    process.stdout.write(`Seed ${seed}/${CONFIG.seeds.length}: extrinsic per agent delta ${pair.delta.totalExtrinsicPerAgent.toFixed(3)}; initial states identical\n`);
  }
  for (const file of sourcePaths) {
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, file))), sourceHashes[file], `${file} changed during comparison; rerun`);
  }
  const summary = experiments.summarizePairs(pairs, CONFIG);
  summary.interpretation = summary.ci95[0] > 0
    ? "The interval favors the current full core on these seeds and this configuration. This does not isolate the contribution of any single change or establish universal superiority."
    : summary.ci95[1] < 0
      ? "The interval favors the frozen original on these seeds and this configuration."
      : "The interval includes zero; this comparison does not resolve an extrinsic reward advantage.";
  const receipt = {
    protocol: {
      version: "diamond-frozen-original-v1",
      primaryMetric: "Per-agent cumulative extrinsic reward; current full core minus frozen original",
      experimentalUnit: "Seed; agents share one world and are not independent replicates",
      pairing: "Identical common initial state, seed, agent count, shared parameters and step budget. Initial hashes cover the world, agents including learning arrays, and RNG states normalized to uint32.",
      originalExecution: "Unchanged original inline declarations through Simulation, excluding startup. Original constructor/reset/step/collectMetrics execute with inert DOM controls. Only draw/updatePanels/toast are presentation stubs.",
      respawns: "Counted without changing either implementation: energy <= 0 immediately before each step, per agent. Cross-checked against candidate counters.",
      timing: "Setup and stepping, excluding initial-state hashing, source loading and final metrics; alternating order. Original uses a Node VM and candidate CommonJS, so these times cannot establish a performance advantage.",
      limitations: "This is a toy simulation and one fixed 20-seed, 300-step, two-agent configuration. It does not prove superiority across configurations, original Nexus behavior, real-world tasks or all metrics. Bootstrap intervals summarize these seed pairs; seeds are a convenience sample, not a representative distribution. No parameter tuning is performed by this script."
    },
    config: CONFIG,
    source: {
      originalCommit: ORIGINAL_COMMIT,
      originalPath: "worldlab.html",
      originalFileSha256: sha256(htmlBytes),
      originalDeclarationsSha256: sha256(declarations),
      candidateGitHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim(),
      candidateWorkingFilesSha256: sourceHashes,
      note: "Candidate hashes identify working-tree files, which may differ from candidateGitHead."
    },
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    startedAt, completedAt: new Date().toISOString(), complete: pairs.length === CONFIG.seeds.length,
    pairs, summary
  };
  const outputPath = path.join(ROOT, "output", "comparison-original.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(receipt, null, 2) + "\n");
  process.stdout.write(JSON.stringify({ outputPath, summary }, null, 2) + "\n");
  return receipt;
}

if (require.main === module) {
  try { main(); } catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; }
}
module.exports = { CONFIG, ORIGINAL_COMMIT, originalDeclarations, sharedInitialState, main };
