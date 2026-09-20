const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function runtime(extraGlobals = {}) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'diamond-nexus.html'), 'utf8');
  const source = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
  const elements = new Map();
  const canvasContext = new Proxy({}, { get: (target, key) => target[key] || (() => ({ addColorStop() {} })), set: (target, key, value) => { target[key] = value; return true; } });
  const element = () => ({
    value: '0.1', textContent: '', width: 600, height: 600, clientWidth: 600, clientHeight: 120,
    addEventListener() {}, setAttribute() {}, appendChild() {},
    querySelectorAll() { return []; },
    classList: { toggle() {}, add() {}, remove() {} }, style: {},
    getContext() { return canvasContext; },
  });
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, { ...element(), value: id === 'num-agents' ? '1' : id === 'scenario-select' ? 'balanced' : id === 'diffusion-steps' ? '1' : '0.1' });
      return elements.get(id);
    },
    querySelectorAll() { return []; }, addEventListener() {}, createElement: element,
  };
  const context = vm.createContext({ document, console: { log() {}, warn() {}, error() {} }, setTimeout: (fn, delay) => { const timer = setTimeout(fn, delay); timer.unref(); return timer; }, clearTimeout, performance, Promise, ...extraGlobals });
  vm.runInContext(source + '\nthis.api = { Simulation, HybridAgent, SafetyShield, document, createSimulation() { simulation=new Simulation(); return simulation; }, setPopulation(n) { POPULATION_SIZE=n; SELECTION_COUNT=Math.max(2,Math.floor(n/2)); } };', context);
  return context.api;
}

function bareSimulation(api) {
  const sim = Object.create(api.Simulation.prototype);
  Object.assign(sim, { agents: [], isRunning: false, isPulsing: false, totalSteps: 0, generation: 1, updateDirectorPanel() {} });
  return sim;
}

test('concurrent step requests share one in-flight transition', async () => {
  const api = runtime(), sim = bareSimulation(api);
  let finish, calls = 0;
  sim._performStep = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  const first = sim.step(), second = sim.step();
  assert.equal(calls, 1);
  finish();
  await Promise.all([first, second]);
  assert.equal(sim._stepPromise, null);
});

test('state replacement waits for training and blocks intervening steps', async () => {
  const api = runtime(), sim = bareSimulation(api);
  const events = [];
  let finish;
  sim._performStep = () => new Promise(resolve => { finish = () => { events.push('step completed'); resolve(); }; });
  const active = sim.step();
  const mutation = sim.mutateWhenIdle(() => events.push('reset'));
  await Promise.resolve();
  assert.deepEqual(events, []);
  assert.equal(await sim.step(), false);
  finish();
  await Promise.all([active, mutation]);
  assert.deepEqual(events, ['step completed', 'reset']);
  assert.equal(sim._pendingMutations, 0);
});

test('a single-agent population survives evolution and disposes its parent', () => {
  const api = runtime(), sim = bareSimulation(api);
  api.setPopulation(1);
  let disposed = 0;
  sim.agents = [{ totalReward: 200, curiosityScore: 0, clone() { return { totalReward: 0 }; }, dispose() { disposed++; } }];
  Object.assign(sim, { dynEnv: { adversaryStrength: 0.2 }, intentModel: { update() {} }, landmarkPlanner: { update() {} }, strategyDirector: { update() {} }, taskMarket: { update() {} }, focusLeader() {} });
  sim.performSelectionAndTraining();
  assert.equal(sim.agents.length, 1);
  assert.equal(sim.agents[0].id, 1);
  assert.equal(disposed, 1);
  assert.equal(sim.dynEnv.adversaryStrength, 0.25);
});

test('stopping a pulse cancels its remaining steps', async () => {
  const api = runtime(), sim = bareSimulation(api);
  let finish, calls = 0;
  sim._performStep = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  sim.focusLeader = () => {};
  const pulse = sim.pulse(25);
  sim.stop();
  finish();
  await pulse;
  assert.equal(calls, 1);
  assert.equal(sim.isPulsing, false);
});

test('safety shield preserves a safe sampled action and vetoes unsafe samples', () => {
  const api = runtime(), shield = new api.SafetyShield(4);
  const ranked = [{ action: 'up', index: 0, sampled: false }, { action: 'right', index: 3, sampled: true }];
  const env = { state: Array.from({ length: 4 }, () => Array(4).fill(1)) };
  assert.equal(shield.resolveAction({ energy: 200 }, ranked, 1, 1, env), 'right');
  env.state[1][2] = null;
  assert.equal(shield.resolveAction({ energy: 200 }, ranked, 1, 1, env), 'up');
  assert.equal(shield.vetoCount, 1);
});

test('zero exploration survives controls and learning decay', () => {
  const api = runtime(), sim = bareSimulation(api);
  const agent = Object.create(api.HybridAgent.prototype);
  api.document.getElementById('epsilon').value = '0';
  sim.agents = [agent];
  sim.applyControlParameters();
  agent.updateLearningParameters();
  assert.equal(agent.epsilon, 0);
});

test('a rejected training step releases the lock and permits a queued reset', async () => {
  const api = runtime(), sim = bareSimulation(api);
  let reject, reset = false;
  sim._performStep = () => new Promise((resolve, fail) => { reject = fail; });
  const active = sim.step();
  const replacement = sim.mutateWhenIdle(() => { reset = true; });
  reject(new Error('backend unavailable'));
  await assert.rejects(active, /backend unavailable/);
  await replacement;
  assert.equal(reset, true);
  assert.equal(sim._pendingMutations, 0);
  assert.equal(sim._stepPromise, null);
});

test('Nexus runs through evolution without TensorFlow or Chart.js', async () => {
  const api = runtime(), sim = api.createSimulation();
  for (let i = 0; i < 81; i++) await sim.step();
  assert.equal(sim.totalSteps, 81);
  assert.equal(sim.generation, 2);
  assert.equal(sim.agents.length, 1);
  assert.ok(Number.isFinite(sim.agents[0].totalReward));
  await sim.reset();
  assert.equal(sim.totalSteps, 0);
});

function storedRuntime(extraGlobals = {}) {
  const saved = new Map();
  const api = runtime({ ...extraGlobals, localStorage: {
    setItem(key, value) { saved.set(key, value); },
    getItem(key) { return saved.get(key); },
  } });
  return { api, saved };
}

test('partial checkpoint roundtrip restores stored state and clears unsaved run memory', async () => {
  const { api, saved } = storedRuntime(), sim = api.createSimulation();
  for (let i = 0; i < 3; i++) await sim.step();
  sim.agents[0].hue = 0;
  sim.agents[0].epsilon = 0;
  sim.curiosityModule.visitCounts.unsaved = 99;
  sim.stigmergy.deposit(1, 1, 'reward', 1);
  await sim.saveSimulation();
  const state = JSON.parse(saved.get('diamondNexusState'));
  assert.equal(state.checkpointKind, 'partial');
  const previousAgents = sim.agents;
  await sim.step();
  await sim.loadSimulation();
  assert.notEqual(sim.agents, previousAgents);
  assert.equal(sim.totalSteps, state.totalSteps);
  assert.equal(sim.agents[0].hue, 0);
  assert.equal(sim.agents[0].epsilon, 0);
  assert.equal(JSON.stringify(sim.env.state), JSON.stringify(state.env.state));
  for (const field of ['qTable', 'position', 'totalReward', 'totalSteps', 'energy', 'path']) {
    assert.equal(JSON.stringify(sim.agents[0][field]), JSON.stringify(state.agents[0][field]), field);
  }
  assert.equal(sim.curiosityModule.visitCounts.unsaved, undefined);
  assert.equal(sim.stigmergy.getTotalDensity(), 0);
  assert.equal(sim.isRunning, false);
  await sim.step();
  assert.equal(sim.totalSteps, state.totalSteps + 1);
});

test('corrupt checkpoints leave the working simulation intact and usable', async () => {
  const { api, saved } = storedRuntime(), sim = api.createSimulation();
  await sim.saveSimulation();
  const valid = saved.get('diamondNexusState');
  const agents = sim.agents, environment = sim.env, model = sim.diffusionModel;
  let disposed = 0;
  const originalDispose = agents[0].dispose.bind(agents[0]);
  agents[0].dispose = () => { disposed++; originalDispose(); };
  const corruptions = [
    state => { state.agents[0].qTable['0,0'] = null; },
    state => { state.agents[0].energy = 'broken'; },
    state => { state.agents[0].path = [[null, 3]]; },
    state => { delete state.env.obstacles; },
    state => { state.diffusionModel.predictedState[0] = null; },
    state => { state.safetyShield.vetoField = [[]]; },
    state => { state.regretCritic.regretMap[0][0] = [0]; },
    state => { state.strategyDirector.roleCounts = 'invalid'; },
    state => { state.agents[0].modelWeights = [[[0]]]; },
    state => { state.totalSteps = -1; },
  ];
  for (const corrupt of corruptions) {
    const state = JSON.parse(valid);
    corrupt(state);
    saved.set('diamondNexusState', JSON.stringify(state));
    await sim.loadSimulation();
    assert.equal(sim.agents, agents, corrupt.toString());
    assert.equal(sim.env, environment);
    assert.equal(sim.diffusionModel, model);
    assert.equal(disposed, 0);
    assert.match(api.document.getElementById('toast').textContent, /Load failed/);
  }
  await sim.step();
  assert.equal(sim.totalSteps, 1);
  assert.ok(Number.isFinite(sim.agents[0].totalReward));
});

test('unavailable checkpoint storage is reported and releases the mutation queue', async () => {
  const api = runtime({ localStorage: { getItem() { throw new Error('storage denied'); } } });
  const sim = api.createSimulation();
  await sim.loadSimulation();
  assert.match(api.document.getElementById('toast').textContent, /Load failed: storage denied/);
  assert.equal(sim._pendingMutations, 0);
  await sim.step();
  assert.equal(sim.totalSteps, 1);
});

test('an invalid new save preserves the previous checkpoint and legacy checkpoints remain loadable', async () => {
  const { api, saved } = storedRuntime(), sim = api.createSimulation();
  assert.equal(await sim.saveSimulation(), true);
  const valid = saved.get('diamondNexusState');
  sim.agents[0].qTable['0,0'].up = NaN;
  assert.equal(await sim.saveSimulation(), false);
  assert.equal(saved.get('diamondNexusState'), valid);
  const legacy = JSON.parse(valid);
  delete legacy.checkpointKind;
  delete legacy.checkpointVersion;
  saved.set('diamondNexusState', JSON.stringify(legacy));
  assert.equal(await sim.loadSimulation(), true);
  assert.equal(sim.agents[0].qTable['0,0'].up, 0);
});

test('a failed replacement does not block the next queued mutation', async () => {
  const api = runtime(), sim = bareSimulation(api), events = [];
  const failed = sim.mutateWhenIdle(() => { throw new Error('replacement failed'); });
  const next = sim.mutateWhenIdle(() => events.push('next'));
  await assert.rejects(failed, /replacement failed/);
  await next;
  assert.deepEqual(events, ['next']);
  assert.equal(sim._pendingMutations, 0);
});

test('optional neural initialization disposes models when layer construction fails', () => {
  let allocated = 0, disposed = 0;
  const api = runtime({ tf: {
    sequential() { allocated++; return { add() { throw new Error('layer failed'); }, dispose() { disposed++; } }; },
    layers: { dense() { return {}; } },
  } });
  const sim = api.createSimulation();
  assert.equal(allocated, 3);
  assert.equal(disposed, allocated);
  assert.equal(sim.curiosityModule.forwardModel, null);
  assert.equal(sim.diffusionModel.denoiseModel, null);
  assert.equal(sim.agents[0].experts, null);
});

test('real TensorFlow CPU training and model replacement release tensors', { skip: !process.env.NEXUS_TF_SMOKE }, async () => {
  const response = await fetch('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
  assert.equal(response.ok, true);
  const module = { exports: {} };
  new Function('module', 'exports', 'require', await response.text())(module, module.exports, require);
  const tf = module.exports;
  await tf.setBackend('cpu');
  let allocation = 0, failAllocation = Infinity;
  const tfFacade = { ...tf, tensor(...args) {
    if (++allocation === failAllocation) throw new Error('injected tensor allocation failure');
    return tf.tensor(...args);
  } };
  const saved = new Map();
  const api = runtime({ tf: tfFacade, localStorage: { setItem(key, value) { saved.set(key, value); }, getItem(key) { return saved.get(key); } } });
  api.document.getElementById('num-agents').value = '4';
  const sim = api.createSimulation();
  const baseline = tf.memory().numTensors;
  for (let i = 0; i < 3; i++) await sim.step();
  assert.equal(sim.agents[0].trainingWarningShown, undefined);
  assert.ok(tf.memory().numTensors > baseline, 'Adam allocates training state');
  await sim.reset();
  assert.equal(tf.memory().numTensors, baseline, 'reset releases old model and optimizer tensors');
  sim.performSelectionAndTraining();
  assert.equal(tf.memory().numTensors, baseline, 'evolution releases parents and temporary weights');
  assert.equal(await sim.saveSimulation(), true);
  const weights = JSON.stringify(sim.agents.map(agent => agent.experts.map(expert => expert.getWeights().map(weight => weight.arraySync()))));
  const originalAgents = sim.agents, originalEnv = sim.env;
  allocation = 0;
  failAllocation = 21; // One complete agent and two temporary tensors into the next agent.
  assert.equal(await sim.loadSimulation(), false);
  assert.match(api.document.getElementById('toast').textContent, /injected tensor allocation failure/);
  assert.equal(sim.agents, originalAgents);
  assert.equal(sim.env, originalEnv);
  assert.equal(tf.memory().numTensors, baseline, 'failed loading releases candidate agents and partially allocated weights');
  failAllocation = Infinity;
  assert.equal(await sim.loadSimulation(), true);
  assert.equal(tf.memory().numTensors, baseline, 'loading releases replaced models and temporary weights');
  assert.equal(sim.agents.length, 4);
  assert.equal(JSON.stringify(sim.agents.map(agent => agent.experts.map(expert => expert.getWeights().map(weight => weight.arraySync())))), weights);
  await sim.step();
  assert.equal(sim.agents[0].trainingWarningShown, undefined);
});
