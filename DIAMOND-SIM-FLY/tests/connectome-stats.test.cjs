const test = require("node:test");
const assert = require("node:assert/strict");
const CB = require("../src/connectome-benchmark.js");

const {
  ConnectomeBenchmarkRunner,
  interquartileMean,
  pairedBootstrap,
  probabilityOfImprovement,
  winRates,
  BOOTSTRAP_SEED
} = CB;

// ─────────────────────────────────────────────────────────────────────────────
// Statistics
// ─────────────────────────────────────────────────────────────────────────────
test("the interquartile mean ignores the extreme seeds a plain mean chases", () => {
  const values = [10, 11, 12, 13, 14, 15, 16, 17];
  assert.equal(interquartileMean(values), 13.5);

  const withOutlier = [10, 11, 12, 13, 14, 15, 16, 9000];
  const plainMean = withOutlier.reduce((a, b) => a + b, 0) / withOutlier.length;
  assert.equal(interquartileMean(withOutlier), 13.5, "the middle half is unchanged");
  assert.ok(plainMean > 1000, "while the plain mean is dragged away");

  assert.equal(interquartileMean([4, 8]), 6, "too few values falls back to the mean");
  assert.equal(interquartileMean([]), 0);
});

test("the paired bootstrap is reproducible and brackets the observed mean", () => {
  const deltas = [4, -2, 9, 1, 7, -1, 3, 5];
  const first = pairedBootstrap(deltas);
  const second = pairedBootstrap(deltas);
  assert.deepEqual(first, second, "a fixed bootstrap seed must give a fixed interval");
  assert.equal(first.seed, BOOTSTRAP_SEED);
  assert.ok(first.ci95[0] < first.meanDelta && first.meanDelta < first.ci95[1]);

  const other = pairedBootstrap(deltas, 2000, 777);
  assert.notDeepEqual(other.ci95, first.ci95, "a different bootstrap seed resamples differently");
});

test("an interval over a consistent difference clears zero; over noise it does not", () => {
  const consistent = pairedBootstrap([20, 22, 19, 25, 21, 23, 18, 24]);
  assert.ok(consistent.ci95[0] > 0, "a consistent advantage should separate from zero");

  const noisy = pairedBootstrap([20, -22, 19, -25, 21, -23, 18, -24]);
  assert.ok(noisy.ci95[0] < 0 && noisy.ci95[1] > 0, "a coin flip must not look significant");
});

test("a single pair yields no interval rather than a fake one", () => {
  const result = pairedBootstrap([5]);
  assert.equal(result.ci95, null);
  assert.equal(result.meanDelta, 5);
  assert.equal(pairedBootstrap([]).meanDelta, null);
});

test("probability of improvement counts ties as half", () => {
  assert.equal(probabilityOfImprovement([2, 2, 2, 2], [1, 1, 1, 1]), 1);
  assert.equal(probabilityOfImprovement([1, 1, 1, 1], [2, 2, 2, 2]), 0);
  assert.equal(probabilityOfImprovement([1, 1], [1, 1]), 0.5, "ties are not wins");
  assert.equal(probabilityOfImprovement([3, 1, 2], [1, 3, 2]), 0.5);
  assert.equal(probabilityOfImprovement([], []), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Runner contract
// ─────────────────────────────────────────────────────────────────────────────
test("tied seeds split the win rather than going to whichever arm is listed first", () => {
  // A tie on every seed must be shared, not handed to the arm listed first.
  assert.deepEqual(
    winRates({ first: [10, 10, 10], second: [10, 10, 10] }),
    { first: 50, second: 50 }
  );

  // One clear winner takes the seed outright.
  assert.deepEqual(
    winRates({ weak: [1, 1], strong: [9, 9] }),
    { weak: 0, strong: 100 }
  );

  // Mixed: seed 0 is a three-way tie, seed 1 belongs to c alone.
  assert.deepEqual(
    winRates({ a: [5, 1], b: [5, 1], c: [5, 9] }),
    { a: 16.7, b: 16.7, c: 66.7 }
  );

  // Shares always total 100%, which a first-past-the-post rule also does but
  // only by giving the whole seed to one arm.
  const rates = winRates({ a: [3, 3, 7], b: [3, 5, 7], c: [1, 5, 7] });
  const total = Object.values(rates).reduce((x, y) => x + y, 0);
  assert.ok(Math.abs(total - 100) < 0.2, `win shares must total 100%, saw ${total}`);
});

test("duplicate arms are rejected rather than silently overwriting each other", async () => {
  const runner = new ConnectomeBenchmarkRunner();
  await assert.rejects(
    () => runner.runComparativeBenchmark({
      arms: ["Syncytium_16B", "Syncytium_16B"],
      seeds: [11, 22],
      stepLimit: 20
    }),
    /distinct/
  );
});

test("every arm sees the same seeds, so the comparison is paired", async () => {
  const runner = new ConnectomeBenchmarkRunner();
  const seeds = [7, 8, 9];
  const report = await runner.runComparativeBenchmark({ seeds, stepLimit: 20 });
  for (const arm of report.arms) {
    assert.deepEqual(arm.raw.map(e => e.seed), seeds, `${arm.arm} ran the wrong seeds`);
  }
  for (const comparison of report.comparisons) {
    assert.equal(comparison.pairCount, seeds.length);
    assert.equal(comparison.perSeedDeltas.length, seeds.length);
  }
});

test("the reference arm is selectable and excluded from its own comparison", async () => {
  const runner = new ConnectomeBenchmarkRunner();
  const report = await runner.runComparativeBenchmark({
    arms: ["RandomWalk", "Syncytium_16B_Legacy", "Syncytium_16B"],
    reference: "Syncytium_16B_Legacy",
    seeds: [3, 4, 5],
    stepLimit: 20
  });
  assert.equal(report.reference, "Syncytium_16B_Legacy");
  assert.deepEqual(report.comparisons.map(c => c.arm), ["RandomWalk", "Syncytium_16B"]);
});

test("repeated seeds and unknown arms are rejected instead of silently distorting pairing", async () => {
  const runner = new ConnectomeBenchmarkRunner();
  await assert.rejects(
    () => runner.runComparativeBenchmark({ seeds: [5, 5, 6], stepLimit: 10 }),
    /distinct/
  );
  await assert.rejects(
    () => runner.runComparativeBenchmark({ arms: ["NoSuchArm"], seeds: [1, 2], stepLimit: 10 }),
    /Unsupported benchmark arm/
  );
  await assert.rejects(
    () => runner.runComparativeBenchmark({ arms: ["RandomWalk"], reference: "Syncytium_16B", seeds: [1, 2], stepLimit: 10 }),
    /not among the arms/
  );
});

test("an episode is reproducible from its seed", () => {
  const runner = new ConnectomeBenchmarkRunner();
  for (const arm of runner.knownArms()) {
    const a = runner.runEpisode(arm, 4242, 40);
    const b = runner.runEpisode(arm, 4242, 40);
    assert.deepEqual(a, b, `${arm} must replay identically from the same seed`);
  }
});

test("the legacy arm really runs the pre-upgrade circuit", () => {
  const runner = new ConnectomeBenchmarkRunner();
  const legacy = runner._createPolicy("Syncytium_16B_Legacy", 1);
  const upgraded = runner._createPolicy("Syncytium_16B", 1);
  assert.equal(legacy.syncytium.config.compass, "kinematic");
  assert.equal(legacy.syncytium.config.consensus, "flat");
  assert.equal(upgraded.syncytium.config.compass, "attractor");
  assert.equal(upgraded.syncytium.config.consensus, "gated");
});

test("the report carries its protocol, its limitations and every raw episode", async () => {
  const runner = new ConnectomeBenchmarkRunner();
  const report = await runner.runComparativeBenchmark({ seeds: [2, 3], stepLimit: 15 });
  assert.match(report.protocol.version, /^connectome-benchmark\//);
  assert.ok(report.protocol.limitations.length > 20, "the report must state its own limits");
  assert.equal(report.protocol.bootstrapSeed, BOOTSTRAP_SEED);
  assert.ok(Date.parse(report.generatedAt) > 0);
  for (const arm of report.arms) {
    assert.equal(arm.raw.length, 2, "raw per-seed observations must be retained");
  }
});

test("the single-brain arm learns differentially under the dopamine-gated rule", () => {
  // Nothing outside a syncytium sets lastActionIndex, and the rule treats -1 as
  // "every channel was taken", which makes the update carry no direction at all.
  const { SingleBrainPolicy } = CB;
  const policy = new SingleBrainPolicy();
  const observation = [0.5, 0.5, 0.25, 0.05, 0.8, 0.4, 0, 1, 0, 1, 0, 0, 0.12, 0.05];

  const chosen = policy.act(observation, 0, 0, 100, 0, 5, 5, 16);
  assert.equal(policy.brain.lastActionIndex, chosen, "the brain must be told what it did");

  const before = policy.brain.kcToMbonWeights.slice();
  policy.reinforce(0, 1.0);
  const after = policy.brain.kcToMbonWeights;

  const row = Array.from({ length: policy.brain.KC_BASE_COUNT }, (_, k) => k)
    .find(k => Math.abs(after[k * 4] - before[k * 4]) > 1e-9);
  assert.ok(row !== undefined, "punishment must change some synapse");

  const deltas = [0, 1, 2, 3].map(m => after[row * 4 + m] - before[row * 4 + m]);
  assert.ok(
    new Set(deltas.map(d => d.toFixed(9))).size > 1,
    `all four channels moved identically (${deltas.join(", ")}), so the update has no direction`
  );
  assert.ok(deltas[chosen] < Math.max(...deltas.filter((_, m) => m !== chosen)),
    "the punished channel must be depressed more than the others");
});

test("the spiking policy breaks a two-way tie instead of always turning the same way", () => {
  const { SpikingMushroomBodyPolicy } = CB;
  const policy = new SpikingMushroomBodyPolicy(3);
  // Force a tie for the lead across the output neurons.
  const counts = new Uint32Array(policy.circuit.count);
  policy.circuit.run = () => { for (const i of policy.mbonIndices) counts[i] = 0; counts[policy.mbonIndices[0]] = 5; counts[policy.mbonIndices[1]] = 5; return counts; };

  const seen = new Set();
  for (let i = 0; i < 40; i++) seen.add(policy.act(new Array(14).fill(0.3), 0, 0, 100, i, 8, 8, 16));
  assert.ok(seen.size > 1, `a tie for the lead collapsed into one direction: ${[...seen].join(",")}`);
});

test("a single seed is rejected rather than reported as an interval-free comparison", async () => {
  const runner = new ConnectomeBenchmarkRunner();
  await assert.rejects(
    () => runner.runComparativeBenchmark({ seeds: [7], stepLimit: 5 }),
    /at least two seeds/
  );
  const fallback = await runner.runComparativeBenchmark({ seeds: [], episodesPerArm: 2, stepLimit: 5 });
  assert.equal(fallback.seeds.length, 2, "an empty list falls back to the default seeds");
});
