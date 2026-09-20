(function (root) {
  "use strict";

  const core = typeof module !== "undefined" && module.exports
    ? require("./worldlab-core.js") : root.DiamondCore;
  const { GRID_SIZE, GRID_CELLS, ACTION_COUNT, MAX_ENERGY, MAX_PATH, HISTORY_LIMIT,
    RNG, Environment, Agent, indexOf } = core;
  const VERSION = 3;
  const MAX_UINT32 = 0xFFFFFFFF;
  const MAX_COUNT = Number.MAX_SAFE_INTEGER;
  const PARAM_RANGES = {
    learningRate: [0.01, 0.7], discount: [0.2, 0.99], epsilon: [0, 0.5],
    curiosity: [0, 2], planning: [0, 80, true], planningHorizon: [1, 6, true],
    observeRadius: [1, 10, true], diffusionSteps: [0, 4, true], riskAversion: [0, 2]
  };
  const PARAM_KEYS = [...Object.keys(PARAM_RANGES), "planner", "communication", "movingHazards"];
  const ROOT_KEYS = ["version", "seed", "stepCount", "rngSeed", "params", "history", "env", "agents"];
  const ENV_KEYS = ["seed", "rngSeed", "state", "obstacles", "energy", "hazards", "pulseLoc", "t"];
  const AGENT_SCALARS = ["id", "x", "y", "renderX", "renderY", "energy", "totalExtrinsic", "totalIntrinsic",
    "collisions", "hazardHits", "steps", "respawns", "lastPredictionError"];
  const FLOAT_ARRAYS = {
    visits: [0, Infinity], belief: [0, 10], uncertainty: [0, 1], error: [0, 10], q: [-Infinity, Infinity]
  };
  const AGENT_ARRAYS = [...Object.keys(FLOAT_ARRAYS), "observed", "knownFlag", "knownStates"];
  const AGENT_KEYS = [...AGENT_SCALARS, ...AGENT_ARRAYS, "rngSeed", "path", "currentPlan"];
  const HISTORY_KEYS = ["step", "reward", "intrinsic", "coverage", "mae", "uncertainty", "energyPct",
    "collisions", "hazards", "respawns", "predictionError"];

  function fail(field, reason) {
    throw new Error(`Invalid snapshot ${field}: ${reason}.`);
  }

  function object(value, field, keys) {
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
      fail(field, "expected a plain object");
    }
    if (!keys) return;
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) fail(`${field}.${key}`, "missing required field");
    }
    for (const key of Object.keys(value)) {
      if (!keys.includes(key)) fail(field, `unsupported field ${key}`);
    }
  }

  function number(value, field, min = -Infinity, max = Infinity, integer = false) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max ||
        (integer && !Number.isSafeInteger(value))) {
      fail(field, `expected ${integer ? "an integer" : "a finite number"} between ${min} and ${max}`);
    }
  }

  function list(value, field, min, max = min) {
    if (!Array.isArray(value) || value.length < min || value.length > max) {
      fail(field, min === max ? `expected an array of exactly ${min} entries` : `expected ${min} to ${max} entries`);
    }
  }

  function numericArray(value, field, length, min, max, binary = false) {
    list(value, field, length);
    for (let i = 0; i < length; i++) {
      number(value[i], `${field}[${i}]`, min, max, binary);
      // JSON emitted from Float32Array round-trips exactly. Reject values that would
      // otherwise overflow or be silently changed when restored to a typed array.
      if (!binary && Math.fround(value[i]) !== value[i]) fail(`${field}[${i}]`, "expected an exact float32 value");
    }
  }

  function point(value, field, env) {
    object(value, field, ["x", "y"]);
    number(value.x, `${field}.x`, 0, GRID_SIZE - 1, true);
    number(value.y, `${field}.y`, 0, GRID_SIZE - 1, true);
    if (env.obstacles[indexOf(value.x, value.y)]) fail(field, "position lies in an obstacle");
  }

  function validateParams(params) {
    object(params, "params", PARAM_KEYS);
    for (const [key, bounds] of Object.entries(PARAM_RANGES)) number(params[key], `params.${key}`, ...bounds);
    if (!["beam", "legacy", "greedy", "random"].includes(params.planner)) fail("params.planner", "unsupported planner");
    for (const key of ["communication", "movingHazards"]) {
      if (typeof params[key] !== "boolean") fail(`params.${key}`, "expected a boolean");
    }
  }

  function validateEnvironment(env, snapshot) {
    object(env, "env", ENV_KEYS);
    number(env.seed, "env.seed", 1, MAX_UINT32, true);
    number(env.rngSeed, "env.rngSeed", 0, MAX_UINT32, true);
    number(env.t, "env.t", 0, MAX_COUNT, true);
    if (env.seed !== snapshot.seed) fail("env.seed", "must match the run seed");
    if (env.t !== snapshot.stepCount) fail("env.t", "must match stepCount");
    numericArray(env.state, "env.state", GRID_CELLS, 0, 10);
    numericArray(env.obstacles, "env.obstacles", GRID_CELLS, 0, 1, true);
    numericArray(env.energy, "env.energy", GRID_CELLS, 0, 1, true);
    for (let i = 0; i < GRID_CELLS; i++) {
      if (env.obstacles[i] && env.energy[i]) fail(`env.energy[${i}]`, "energy lies in an obstacle");
    }
    list(env.hazards, "env.hazards", 0, GRID_CELLS);
    for (let i = 0; i < env.hazards.length; i++) {
      const hazard = env.hazards[i], field = `env.hazards[${i}]`;
      object(hazard, field, ["x", "y", "dx", "dy"]);
      point({ x: hazard.x, y: hazard.y }, field, env);
      number(hazard.dx, `${field}.dx`, -1, 1, true);
      number(hazard.dy, `${field}.dy`, -1, 1, true);
      if (!hazard.dx && !hazard.dy) fail(field, "hazard direction cannot be stationary");
    }
    if (env.pulseLoc !== null) {
      const pulse = env.pulseLoc;
      object(pulse, "env.pulseLoc", ["x", "y", "radius", "life"]);
      number(pulse.x, "env.pulseLoc.x", 3, GRID_SIZE - 4, true);
      number(pulse.y, "env.pulseLoc.y", 3, GRID_SIZE - 4, true);
      number(pulse.radius, "env.pulseLoc.radius", 2.5, 7.5);
      number(pulse.life, "env.pulseLoc.life", 0.5, 10);
    }
  }

  function validateAgents(agents, snapshot) {
    list(agents, "agents", 1, 12);
    const ids = new Set();
    for (let a = 0; a < agents.length; a++) {
      const agent = agents[a], field = `agents[${a}]`;
      object(agent, field, AGENT_KEYS);
      number(agent.id, `${field}.id`, 1, MAX_UINT32, true);
      if (ids.has(agent.id)) fail("agents", "agent IDs must be unique");
      ids.add(agent.id);
      number(agent.rngSeed, `${field}.rngSeed`, 0, MAX_UINT32, true);
      point({ x: agent.x, y: agent.y }, field, snapshot.env);
      number(agent.renderX, `${field}.renderX`, 0, GRID_SIZE - 1);
      number(agent.renderY, `${field}.renderY`, 0, GRID_SIZE - 1);
      number(agent.energy, `${field}.energy`, 0, MAX_ENERGY);
      number(agent.totalExtrinsic, `${field}.totalExtrinsic`);
      number(agent.totalIntrinsic, `${field}.totalIntrinsic`, 0);
      number(agent.lastPredictionError, `${field}.lastPredictionError`, 0, 10);
      number(agent.steps, `${field}.steps`, 0, MAX_COUNT, true);
      if (agent.steps !== snapshot.stepCount) fail(`${field}.steps`, "must match stepCount");
      for (const key of ["collisions", "hazardHits", "respawns"]) number(agent[key], `${field}.${key}`, 0, agent.steps, true);
      for (const [key, bounds] of Object.entries(FLOAT_ARRAYS)) {
        numericArray(agent[key], `${field}.${key}`, GRID_CELLS * (key === "q" ? ACTION_COUNT : 1), ...bounds);
      }
      numericArray(agent.observed, `${field}.observed`, GRID_CELLS, 0, 1, true);
      numericArray(agent.knownFlag, `${field}.knownFlag`, GRID_CELLS, 0, 1, true);
      list(agent.knownStates, `${field}.knownStates`, 1, GRID_CELLS);
      const known = new Set();
      for (const index of agent.knownStates) {
        number(index, `${field}.knownStates`, 0, GRID_CELLS - 1, true);
        if (known.has(index)) fail(`${field}.knownStates`, "known indices must be unique");
        known.add(index);
      }
      for (let i = 0; i < GRID_CELLS; i++) {
        if (agent.knownFlag[i] !== Number(known.has(i))) fail(`${field}.knownFlag[${i}]`, "must match knownStates membership");
        if (agent.observed[i] !== agent.knownFlag[i]) fail(`${field}.observed[${i}]`, "must match knownFlag");
      }
      list(agent.path, `${field}.path`, Math.min(agent.steps, MAX_PATH));
      for (let p = 0; p < agent.path.length; p++) point(agent.path[p], `${field}.path[${p}]`, snapshot.env);
      const last = agent.path[agent.path.length - 1];
      if (last && (last.x !== agent.x || last.y !== agent.y)) fail(`${field}.path`, "last point must match the agent position");
      list(agent.currentPlan, `${field}.currentPlan`, 0, 7);
      if (agent.currentPlan.length === 1) fail(`${field}.currentPlan`, "a plan needs an origin and a first action");
      for (let p = 0; p < agent.currentPlan.length; p++) {
        point(agent.currentPlan[p], `${field}.currentPlan[${p}]`, snapshot.env);
        if (p) {
          const previous = agent.currentPlan[p - 1], next = agent.currentPlan[p];
          if (Math.abs(next.x - previous.x) + Math.abs(next.y - previous.y) > 1) {
            fail(`${field}.currentPlan[${p}]`, "plan moves must connect adjacent cells");
          }
        }
      }
      if (agent.currentPlan.length && (agent.currentPlan[1].x !== agent.x || agent.currentPlan[1].y !== agent.y)) {
        fail(`${field}.currentPlan`, "first planned action must match the agent position");
      }
    }
  }

  function validateHistory(history, snapshot) {
    list(history, "history", Math.min(snapshot.stepCount, HISTORY_LIMIT));
    const cumulative = ["collisions", "hazards", "respawns"];
    for (let i = 0; i < history.length; i++) {
      const row = history[i], field = `history[${i}]`;
      object(row, field, HISTORY_KEYS);
      number(row.step, `${field}.step`, 1, snapshot.stepCount, true);
      if (row.step !== snapshot.stepCount - history.length + i + 1) fail(`${field}.step`, "history steps must be consecutive and end at stepCount");
      number(row.reward, `${field}.reward`, -1.67, 1.45);
      number(row.intrinsic, `${field}.intrinsic`, 0, 2.8);
      for (const key of ["coverage", "uncertainty", "energyPct"]) number(row[key], `${field}.${key}`, 0, 1);
      for (const key of ["mae", "predictionError"]) number(row[key], `${field}.${key}`, 0, 10);
      for (const key of cumulative) {
        number(row[key], `${field}.${key}`, 0, Math.min(MAX_COUNT, row.step * snapshot.agents.length), true);
        if (i && (row[key] < history[i - 1][key] || row[key] - history[i - 1][key] > snapshot.agents.length)) {
          fail(`${field}.${key}`, "counter change must be between zero and the number of agents");
        }
      }
    }
    if (history.length) {
      const last = history[history.length - 1];
      for (const [metric, counter] of [["collisions", "collisions"], ["hazards", "hazardHits"], ["respawns", "respawns"]]) {
        const total = snapshot.agents.reduce((sum, agent) => sum + agent[counter], 0);
        if (last[metric] !== total) fail(`history[${history.length - 1}].${metric}`, "must match current agent counters");
      }
    }
  }

  function validateSnapshot(snapshot) {
    object(snapshot, "snapshot");
    if (snapshot.version === 2) {
      fail("version", "version 2 is missing RNG state and cannot provide exact replay; start a new run and save a version 3 snapshot");
    }
    if (snapshot.version !== VERSION) fail("version", `unsupported version; expected ${VERSION}`);
    object(snapshot, "snapshot", ROOT_KEYS);
    number(snapshot.seed, "seed", 1, MAX_UINT32, true);
    number(snapshot.rngSeed, "rngSeed", 0, MAX_UINT32, true);
    number(snapshot.stepCount, "stepCount", 0, MAX_COUNT, true);
    validateParams(snapshot.params);
    validateEnvironment(snapshot.env, snapshot);
    validateAgents(snapshot.agents, snapshot);
    validateHistory(snapshot.history, snapshot);
  }

  const copyPoints = points => points.map(point => ({ ...point }));

  function serializeRun(run) {
    const env = run.env;
    const snapshot = {
      version: VERSION, seed: run.seed, stepCount: run.stepCount, rngSeed: run.rng.seed,
      params: { ...run.params }, history: run.history.map(row => ({ ...row })),
      env: {
        seed: env.seed, rngSeed: env.rng.seed, state: Array.from(env.state),
        obstacles: Array.from(env.obstacles), energy: Array.from(env.energy),
        hazards: env.hazards.map(hazard => ({ ...hazard })),
        pulseLoc: env.pulseLoc ? { ...env.pulseLoc } : null, t: env.t
      },
      agents: run.agents.map(agent => {
        const saved = { rngSeed: agent.rng.seed, path: copyPoints(agent.path), currentPlan: copyPoints(agent.currentPlan) };
        for (const key of AGENT_SCALARS) saved[key] = agent[key];
        for (const key of AGENT_ARRAYS) saved[key] = Array.from(agent[key]);
        return saved;
      })
    };
    validateSnapshot(snapshot);
    return snapshot;
  }

  function restoreRun(snapshot) {
    // Complete validation comes before constructing any live objects or typed arrays.
    // The caller only replaces its active run after this function returns successfully.
    validateSnapshot(snapshot);
    const rawEnv = snapshot.env;
    const env = Object.assign(Object.create(Environment.prototype), {
      seed: rawEnv.seed, rng: new RNG(rawEnv.rngSeed), t: rawEnv.t,
      state: Float32Array.from(rawEnv.state), obstacles: Uint8Array.from(rawEnv.obstacles), energy: Uint8Array.from(rawEnv.energy),
      hazards: rawEnv.hazards.map(hazard => ({ ...hazard })), pulseLoc: rawEnv.pulseLoc ? { ...rawEnv.pulseLoc } : null
    });
    const agents = snapshot.agents.map(raw => {
      const agent = Object.create(Agent.prototype);
      for (const key of AGENT_SCALARS) agent[key] = raw[key];
      for (const key of Object.keys(FLOAT_ARRAYS)) agent[key] = Float32Array.from(raw[key]);
      agent.rng = new RNG(raw.rngSeed);
      agent.observed = Uint8Array.from(raw.observed);
      agent.knownFlag = Uint8Array.from(raw.knownFlag);
      agent.knownStates = [...raw.knownStates];
      agent.path = copyPoints(raw.path);
      agent.currentPlan = copyPoints(raw.currentPlan);
      return agent;
    });
    return {
      seed: snapshot.seed, stepCount: snapshot.stepCount, rng: new RNG(snapshot.rngSeed),
      params: { ...snapshot.params }, history: snapshot.history.map(row => ({ ...row })), env, agents
    };
  }

  const api = { serializeRun, restoreRun, SNAPSHOT_VERSION: VERSION };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DiamondState = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
