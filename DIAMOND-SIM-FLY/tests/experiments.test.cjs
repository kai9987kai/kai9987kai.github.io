"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../src/worldlab-core.js");
const experiments = require("../src/worldlab-experiments.js");
const { parseArgs } = require("../scripts/benchmark.cjs");

const quick = { seeds: [11, 29], steps: 6, numAgents: 1, params: { planning: 0, epsilon: 0 }, bootstrapSamples: 100 };
const immediate = { yieldControl: async () => {} };

function withoutTiming(value) {
  if (Array.isArray(value)) return value.map(withoutTiming);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== "elapsedMs").map(([key, nested]) => [key, withoutTiming(nested)]));
  return value;
}

function fixturePair(seed, delta) {
  const candidate = Object.fromEntries(experiments.METRICS.map(metric => [metric, 0]));
  const baseline = { ...candidate };
  candidate.totalExtrinsicPerAgent = delta;
  return { seed, candidate, baseline };
}

test("experiment validation enforces budgets, unique seeds, and baseline choices", () => {
  for (const seeds of [[1], [1, 1], [1, 0], [1, -1], [1, 4294967296], [1, 2.2], Array.from({ length: 31 }, (_, i) => i)]) {
    assert.throws(() => experiments.validateOptions({ seeds }), RangeError);
  }
  for (const options of [{ steps: 0 }, { steps: 2001 }, { steps: 1.5 }, { numAgents: 0 }, { numAgents: 13 }, { baseline: "beam" }, { bootstrapSamples: 0 }, { bootstrapSeed: -1 }]) {
    assert.throws(() => experiments.validateOptions(options), RangeError);
  }
  assert.throws(() => experiments.validateOptions({ params: { curiosity: NaN } }), /finite/);
  assert.throws(() => experiments.validateOptions({ params: { riskAversion: 3 } }), /Invalid parameter/);
  assert.throws(() => experiments.validateOptions({ params: { surprise: 3 } }), /Unknown parameter/);
  assert.throws(() => experiments.validateOptions(null), TypeError);
  assert.throws(() => experiments.validateOptions({ params: [] }), TypeError);
});

test("validation copies caller configuration and reserves planner assignments", () => {
  const source = { seeds: [1, 4294967295], params: { planner: "random", curiosity: 0.3 } };
  const config = experiments.validateOptions(source);
  source.seeds[0] = 13;
  source.params.curiosity = 3;
  assert.deepEqual(config.seeds, [1, 4294967295]);
  assert.equal(config.params.curiosity, 0.3);
  assert.equal(config.params.planner, undefined);
  assert.equal(config.candidate, "beam");
});

test("bootstrap resamples whole paired seeds and is reproducible", () => {
  const pairs = [fixturePair(1, -8), fixturePair(2, 3), fixturePair(3, 11), fixturePair(4, 6)];
  const options = { bootstrapSamples: 1000, bootstrapSeed: 17 };
  const summary = experiments.summarizePairs(pairs, options);
  assert.deepEqual(summary, experiments.summarizePairs(pairs, options));
  assert.equal(summary.pairCount, 4);
  assert.equal(summary.meanDelta, 3);
  assert.ok(summary.ci95[0] < 3 && summary.ci95[1] > 3);
  assert.deepEqual(experiments.summarizePairs([fixturePair(1, 5), fixturePair(2, 5)], options).ci95, [5, 5]);
  // A stored delta cannot override the actual per-arm observations.
  pairs[0].delta = { totalExtrinsicPerAgent: 99999 };
  assert.equal(experiments.summarizePairs(pairs, options).meanDelta, 3);
});

test("zero/one completed pairs do not fabricate a confidence interval", () => {
  assert.equal(experiments.summarizePairs([]).meanDelta, null);
  assert.equal(experiments.summarizePairs([]).ci95, null);
  const summary = experiments.summarizePairs([fixturePair(4, 6)]);
  assert.equal(summary.meanDelta, 6);
  assert.equal(summary.ci95, null);
  assert.throws(() => experiments.summarizePairs([fixturePair(4, 6), fixturePair(4, 9)]), /distinct/);
  const broken = fixturePair(1, 4);
  broken.candidate.hazardHits = NaN;
  assert.throws(() => experiments.summarizePairs([broken]), /invalid/);
});

test("completed experiments retain equal per-arm budgets and raw paired results", async () => {
  const progress = [];
  const result = await experiments.runExperiment(quick, { ...immediate, onProgress: update => progress.push(update) });
  assert.equal(result.complete, true);
  assert.equal(result.cancelled, false);
  assert.equal(result.completedPairs, 2);
  assert.equal(result.summary.pairCount, 2);
  assert.equal(result.protocol.version, experiments.PROTOCOL_VERSION);
  for (const pair of result.pairs) {
    assert.equal(pair.candidate.steps, quick.steps);
    assert.equal(pair.baseline.steps, quick.steps);
    assert.equal(pair.candidate.numAgents, quick.numAgents);
    assert.equal(pair.baseline.numAgents, quick.numAgents);
    assert.equal(pair.delta.totalExtrinsicPerAgent, pair.candidate.totalExtrinsicPerAgent - pair.baseline.totalExtrinsicPerAgent);
  }
  assert.ok(progress.some(update => update.phase === "pair-complete"));
  assert.equal(progress.at(-1).phase, "complete");
});

test("fixed seed reruns reproduce observations and intervals apart from timing", async () => {
  const first = await experiments.runExperiment(quick, immediate);
  const second = await experiments.runExperiment(quick, immediate);
  assert.deepEqual(withoutTiming(first), withoutTiming(second));
});

test("runner matches independent direct core runs for both assigned planners", async () => {
  const result = await experiments.runExperiment(quick, immediate);
  for (const pair of result.pairs) {
    for (const [arm, planner] of [["candidate", "beam"], ["baseline", "legacy"]]) {
      const run = core.createRun(pair.seed, quick.numAgents, { ...result.config.params, planner });
      for (let step = 0; step < quick.steps; step++) core.stepRun(run);
      assert.equal(pair[arm].totalExtrinsic, run.agents.reduce((total, agent) => total + agent.totalExtrinsic, 0));
      assert.equal(pair[arm].respawns, run.agents.reduce((total, agent) => total + agent.respawns, 0));
    }
  }
});

test("experiments do not mutate a separate live run or its RNG", async () => {
  const live = core.createRun(71, 2, { planning: 0 });
  core.stepRun(live);
  const before = JSON.stringify(live);
  await experiments.runExperiment(quick, immediate);
  assert.equal(JSON.stringify(live), before);
});

test("cancellation before start returns no pairs", async () => {
  const result = await experiments.runExperiment(quick, { ...immediate, shouldCancel: () => true });
  assert.equal(result.complete, false);
  assert.equal(result.cancelled, true);
  assert.equal(result.completedPairs, 0);
  assert.equal(result.summary.ci95, null);
});

test("cancellation discards an unfinished second pair and yields within five steps", async () => {
  let cancel = false;
  let yields = 0;
  const lastStep = {};
  const result = await experiments.runExperiment({ ...quick, steps: 12, seeds: [11, 29, 47] }, {
    onProgress(update) {
      if (update.phase === "candidate" || update.phase === "baseline") {
        const key = `${update.seed}:${update.phase}`;
        assert.ok(update.step - (lastStep[key] || 0) <= 5);
        lastStep[key] = update.step;
        if (update.seed === 29 && update.step >= 5) cancel = true;
      }
    },
    shouldCancel: () => cancel,
    yieldControl: async () => { yields++; }
  });
  assert.equal(result.complete, false);
  assert.equal(result.cancelled, true);
  assert.deepEqual(result.pairs.map(pair => pair.seed), [11]);
  assert.equal(result.summary.pairCount, 1);
  assert.equal(result.summary.ci95, null);
  assert.ok(yields > 0);
});

test("all supported baselines are executable", async () => {
  for (const baseline of experiments.BASELINES) {
    const result = await experiments.runExperiment({ ...quick, steps: 2, baseline }, immediate);
    assert.equal(result.config.baseline, baseline);
    assert.equal(result.complete, true);
  }
});

test("CSV carries complete per-seed observations and reproducibility settings", async () => {
  const result = await experiments.runExperiment(quick, immediate);
  const csv = experiments.toCSV(result);
  assert.equal(csv.trim().split("\r\n").length, 3);
  assert.ok(csv.startsWith("protocol,complete,seed,candidate,baseline,steps,numAgents,params,bootstrapSamples,bootstrapSeed,"));
  assert.ok(csv.includes("candidate_totalExtrinsicPerAgent"));
  assert.ok(csv.includes("baseline_respawns"));
  assert.ok(csv.includes("delta_hazardHits"));
  assert.ok(csv.includes('""curiosity""'));
  assert.throws(() => experiments.toCSV({}), TypeError);
});

test("benchmark CLI validates values and parses explicit experiment configuration", () => {
  const parsed = parseArgs(["--seeds", "3,7", "--steps", "20", "--agents", "3", "--baseline", "random", "--params", '{"curiosity":0.2}']);
  assert.deepEqual(parsed.options, { seeds: [3, 7], steps: 20, numAgents: 3, baseline: "random", params: { curiosity: 0.2 } });
  assert.equal(parseArgs(["--help"]).help, true);
  assert.throws(() => parseArgs(["--steps"]), /Missing value/);
  assert.throws(() => parseArgs(["--seeds", "1,,2"]), /empty/);
  assert.throws(() => parseArgs(["--surprise", "1"]), /Unknown option/);
});
