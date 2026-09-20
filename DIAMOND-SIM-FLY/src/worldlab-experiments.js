(function (root) {
  "use strict";

  const core = typeof module !== "undefined" && module.exports
    ? require("./worldlab-core.js") : root.DiamondCore;
  const PROTOCOL_VERSION = "diamond-paired-seeds-v1";
  const BASELINES = Object.freeze(["legacy", "greedy", "random"]);
  const DEFAULT_SEEDS = Object.freeze([11, 29, 47, 71, 101]);
  const METRICS = Object.freeze([
    "totalExtrinsic", "totalExtrinsicPerAgent", "totalIntrinsic", "coverage",
    "modelMAE", "energy", "collisions", "hazardHits", "respawns", "elapsedMs"
  ]);

  function integer(value, name, minimum, maximum) {
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw new RangeError(`${name} must be an integer from ${minimum} to ${maximum}.`);
    }
    return value;
  }

  function validateOptions(options = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("Experiment options must be an object.");
    }
    const seeds = options.seeds === undefined ? DEFAULT_SEEDS.slice() : options.seeds;
    if (!Array.isArray(seeds) || seeds.length < 2 || seeds.length > 30) {
      throw new RangeError("Provide 2 to 30 distinct seeds.");
    }
    seeds.forEach(seed => integer(seed, "Seed", 1, 4294967295));
    if (new Set(seeds).size !== seeds.length) {
      throw new RangeError("Experiment seeds must be distinct.");
    }
    const baseline = options.baseline === undefined ? "legacy" : options.baseline;
    if (!BASELINES.includes(baseline)) {
      throw new RangeError(`Baseline must be one of: ${BASELINES.join(", ")}.`);
    }
    if (options.params !== undefined && (!options.params || typeof options.params !== "object" || Array.isArray(options.params))) {
      throw new TypeError("Experiment params must be an object.");
    }
    const params = { ...core.DEFAULT_PARAMS, ...options.params };
    // The protocol controls both planner assignments, irrespective of the live UI.
    delete params.planner;
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "number" && !Number.isFinite(value)) {
        throw new RangeError(`Parameter ${key} must be finite.`);
      }
    }
    const validatedParams = core.validateParams({ ...params, planner: "beam" });
    delete validatedParams.planner;
    return {
      seeds: seeds.slice(),
      steps: integer(options.steps === undefined ? 150 : options.steps, "Steps", 1, 2000),
      numAgents: integer(options.numAgents === undefined ? 2 : options.numAgents, "Agents", 1, 12),
      candidate: "beam",
      baseline,
      params: validatedParams,
      bootstrapSamples: integer(options.bootstrapSamples === undefined ? 2000 : options.bootstrapSamples, "Bootstrap samples", 100, 10000),
      bootstrapSeed: integer(options.bootstrapSeed === undefined ? 20260912 : options.bootstrapSeed, "Bootstrap seed", 0, 4294967295)
    };
  }

  function mean(values) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function quantile(sorted, fraction) {
    const index = (sorted.length - 1) * fraction;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
  }

  function meanMetrics(pairs, arm) {
    const result = {};
    for (const metric of METRICS) result[metric] = mean(pairs.map(pair => pair[arm][metric]));
    return result;
  }

  function summarizePairs(pairs, options = {}) {
    if (!Array.isArray(pairs)) throw new TypeError("Pairs must be an array.");
    const samples = integer(options.bootstrapSamples === undefined ? 2000 : options.bootstrapSamples, "Bootstrap samples", 100, 10000);
    const seed = integer(options.bootstrapSeed === undefined ? 20260912 : options.bootstrapSeed, "Bootstrap seed", 0, 4294967295);
    const bootstrap = { samples, seed, method: "paired-seed percentile bootstrap, 95% interval" };
    if (!pairs.length) {
      return { pairCount: 0, meanDelta: null, ci95: null, candidateMeans: null, baselineMeans: null, deltaMeans: null, bootstrap, interpretation: "No completed seed pairs." };
    }
    const seen = new Set();
    for (const pair of pairs) {
      if (!pair || seen.has(pair.seed)) throw new RangeError("Each completed pair needs a distinct seed.");
      integer(pair.seed, "Pair seed", 1, 4294967295);
      seen.add(pair.seed);
      for (const arm of ["candidate", "baseline"]) {
        for (const metric of METRICS) {
          if (!pair[arm] || !Number.isFinite(pair[arm][metric])) {
            throw new TypeError(`Pair ${pair.seed} has an invalid ${arm}.${metric}.`);
          }
        }
      }
    }
    const candidateMeans = meanMetrics(pairs, "candidate");
    const baselineMeans = meanMetrics(pairs, "baseline");
    const deltaMeans = {};
    for (const metric of METRICS) deltaMeans[metric] = candidateMeans[metric] - baselineMeans[metric];
    const deltas = pairs.map(pair => pair.candidate.totalExtrinsicPerAgent - pair.baseline.totalExtrinsicPerAgent);
    const meanDelta = mean(deltas);
    let ci95 = null;
    if (pairs.length >= 2) {
      // This generator is independent of every simulation run's random state.
      const rng = new core.RNG(seed);
      const resampled = [];
      for (let sample = 0; sample < samples; sample++) {
        let sum = 0;
        for (let pair = 0; pair < deltas.length; pair++) sum += deltas[rng.int(deltas.length)];
        resampled.push(sum / deltas.length);
      }
      resampled.sort((a, b) => a - b);
      ci95 = [quantile(resampled, 0.025), quantile(resampled, 0.975)];
    }
    let interpretation = "At least two completed seeds are needed for an interval.";
    if (ci95) interpretation = ci95[0] > 0
      ? "The interval favors beam on these seeds and this configuration. This does not establish universal superiority."
      : ci95[1] < 0
        ? "The interval favors the baseline on these seeds and this configuration."
        : "The interval includes zero; this run does not resolve a reward advantage.";
    return { pairCount: pairs.length, meanDelta, ci95, candidateMeans, baselineMeans, deltaMeans, bootstrap, interpretation };
  }

  function now() {
    return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
  }

  function collectMetrics(run, elapsedMs) {
    const agents = run.agents;
    const sum = field => agents.reduce((total, agent) => total + agent[field], 0);
    return {
      totalExtrinsic: sum("totalExtrinsic"),
      totalExtrinsicPerAgent: sum("totalExtrinsic") / agents.length,
      totalIntrinsic: sum("totalIntrinsic"),
      coverage: mean(agents.map(agent => agent.coverage())),
      modelMAE: mean(agents.map(agent => agent.modelMAE(run.env))),
      energy: mean(agents.map(agent => agent.energy)),
      collisions: sum("collisions"),
      hazardHits: sum("hazardHits"),
      respawns: sum("respawns"),
      elapsedMs,
      steps: run.stepCount,
      numAgents: agents.length
    };
  }

  async function runExperiment(options = {}, controls = {}) {
    if (!core || typeof core.createRun !== "function" || typeof core.stepRun !== "function") {
      throw new Error("The experiment runner requires DiamondCore.createRun and DiamondCore.stepRun.");
    }
    const config = validateOptions(options);
    const onProgress = controls.onProgress || (() => {});
    const shouldCancel = controls.shouldCancel || (() => false);
    const yieldControl = controls.yieldControl || (() => new Promise(resolve => setTimeout(resolve, 0)));
    const pairs = [];
    const startedAt = now();
    let cancelled = false;
    const progress = (seed, phase, step) => onProgress({ completedPairs: pairs.length, totalPairs: config.seeds.length, seed, phase, step, steps: config.steps });

    async function runArm(seed, planner, phase) {
      if (shouldCancel()) return null;
      const initStarted = now();
      const run = core.createRun(seed, config.numAgents, { ...config.params, planner });
      let elapsedMs = now() - initStarted;
      progress(seed, phase, 0);
      while (run.stepCount < config.steps) {
        if (shouldCancel()) return null;
        const chunkStarted = now();
        let chunkSteps = 0;
        while (run.stepCount < config.steps && chunkSteps < 5 && now() - chunkStarted < 12) {
          if (shouldCancel()) return null;
          core.stepRun(run);
          chunkSteps++;
        }
        elapsedMs += now() - chunkStarted;
        progress(seed, phase, run.stepCount);
        if (run.stepCount < config.steps) await yieldControl();
      }
      return collectMetrics(run, elapsedMs);
    }

    for (const seed of config.seeds) {
      const candidate = await runArm(seed, "beam", "candidate");
      if (!candidate) { cancelled = true; break; }
      // Yield between arms even for short experiments, so cancellation is responsive.
      await yieldControl();
      const baseline = await runArm(seed, config.baseline, "baseline");
      if (!baseline) { cancelled = true; break; }
      const delta = {};
      for (const metric of METRICS) delta[metric] = candidate[metric] - baseline[metric];
      pairs.push({ seed, candidate, baseline, delta });
      progress(seed, "pair-complete", config.steps);
      if (pairs.length < config.seeds.length) await yieldControl();
    }
    const complete = pairs.length === config.seeds.length;
    const result = {
      protocol: {
        version: PROTOCOL_VERSION,
        primaryMetric: "per-agent cumulative extrinsic reward; candidate minus baseline",
        pairing: "Identical seed, initial world, agent count, parameters and step budget. Policy decisions and resource interactions make trajectories diverge.",
        experimentalUnit: "seed (agents sharing a world are not independent replicates)",
        timing: "Per-arm active setup and stepping time; excludes cooperative yields and final metrics. Timing is nondeterministic and order-sensitive.",
        limitations: "Toy simulator; fixed seed results and a small-sample bootstrap interval do not imply real-world or universal improvement."
      },
      config,
      complete,
      cancelled,
      completedPairs: pairs.length,
      totalPairs: config.seeds.length,
      pairs,
      summary: summarizePairs(pairs, config),
      elapsedMs: now() - startedAt
    };
    progress(null, complete ? "complete" : "cancelled", complete ? config.steps : 0);
    return result;
  }

  function csvCell(value) {
    const text = String(value === undefined || value === null ? "" : value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function toCSV(result) {
    if (!result || !Array.isArray(result.pairs) || !result.config || !result.protocol) {
      throw new TypeError("CSV export requires an experiment result.");
    }
    const columns = ["protocol", "complete", "seed", "candidate", "baseline", "steps", "numAgents", "params", "bootstrapSamples", "bootstrapSeed"];
    for (const arm of ["candidate", "baseline", "delta"]) {
      for (const metric of METRICS) columns.push(`${arm}_${metric}`);
    }
    const rows = [columns];
    for (const pair of result.pairs) {
      const row = [result.protocol.version, result.complete, pair.seed, result.config.candidate, result.config.baseline, result.config.steps, result.config.numAgents, JSON.stringify(result.config.params), result.config.bootstrapSamples, result.config.bootstrapSeed];
      for (const arm of ["candidate", "baseline", "delta"]) {
        for (const metric of METRICS) row.push(pair[arm][metric]);
      }
      rows.push(row);
    }
    return rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
  }

  const api = { PROTOCOL_VERSION, BASELINES, DEFAULT_SEEDS, METRICS, validateOptions, summarizePairs, runExperiment, toCSV };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DiamondExperiments = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
