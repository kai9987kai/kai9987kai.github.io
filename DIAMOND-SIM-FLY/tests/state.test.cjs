const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../src/worldlab-core.js');
const statePath = path.join(__dirname, '../src/worldlab-state.js');

function stateAPI() {
  assert.ok(fs.existsSync(statePath), 'reproducible snapshot persistence module exists');
  return require(statePath);
}

const clone = value => JSON.parse(JSON.stringify(value));

test('snapshot resumes exactly through pulses, communication, and respawn', () => {
  const state = stateAPI();
  const original = core.createRun(1337, 2, { planning: 4, planningHorizon: 2 });
  for (let i = 0; i < 73; i++) core.stepRun(original);
  // Force the next legitimate transition to include a respawn, without changing its counters.
  original.agents[0].energy = 0;
  original.agents[0].updateRender();
  const snapshot = clone(state.serializeRun(original));
  const restored = state.restoreRun(snapshot);
  assert.deepEqual(state.serializeRun(restored), snapshot);
  assert.deepEqual(restored, original, 'every live core field is preserved');
  assert.deepEqual(restored.agents[0].knownStates, original.agents[0].knownStates);
  assert.notDeepEqual(snapshot.agents[0].knownStates, [...snapshot.agents[0].knownStates].sort((a, b) => a - b),
    'the fixture exercises discovery order rather than sorted observed indices');
  assert.ok(snapshot.env.pulseLoc, 'snapshot includes an active reward pulse');
  for (let i = 0; i < 160; i++) {
    core.stepRun(original);
    core.stepRun(restored);
    assert.deepEqual(restored.history.at(-1), original.history.at(-1), `metrics at resumed step ${i + 1}`);
  }
  assert.ok(restored.agents[0].respawns > snapshot.agents[0].respawns);
  assert.deepEqual(restored, original);
  assert.deepEqual(state.serializeRun(restored), state.serializeRun(original));
});

test('all planners and seed boundaries preserve initial and truncated-history runs', () => {
  const state = stateAPI();
  for (const planner of ['beam', 'legacy', 'greedy', 'random']) {
    const run = core.createRun(planner === 'beam' ? 1 : 0xFFFFFFFF, 1,
      { planner, planning: 1, planningHorizon: 2, movingHazards: false, communication: false });
    assert.deepEqual(state.restoreRun(clone(state.serializeRun(run))), run, `${planner} initial run`);
    for (let i = 0; i < core.HISTORY_LIMIT + 2; i++) core.stepRun(run);
    assert.equal(run.history.length, core.HISTORY_LIMIT);
    const restored = state.restoreRun(clone(state.serializeRun(run)));
    for (let i = 0; i < 5; i++) { core.stepRun(run); core.stepRun(restored); }
    assert.deepEqual(restored, run, `${planner} resumed history`);
  }
});

test('snapshots and restored runs do not alias live state or imported data', () => {
  const state = stateAPI();
  const run = core.createRun(71, 1);
  core.stepRun(run);
  const snapshot = state.serializeRun(run);
  const restored = state.restoreRun(snapshot);
  snapshot.env.state[0] = 99;
  snapshot.agents[0].path[0].x = 0;
  snapshot.agents[0].knownStates.reverse();
  snapshot.history[0].reward = 99;
  assert.deepEqual(state.serializeRun(restored), state.serializeRun(run));
  restored.agents[0].belief[0] = 99;
  assert.notEqual(run.agents[0].belief[0], 99);
});

test('version 2 is rejected because its missing RNG state prevents exact replay', () => {
  assert.throws(() => stateAPI().restoreRun({ version: 2 }), /version 2.*RNG.*replay/i);
});

test('corrupt snapshots reject atomically with field-specific errors', () => {
  const state = stateAPI();
  const live = core.createRun(17, 2, { planning: 1 });
  for (let i = 0; i < 3; i++) core.stepRun(live);
  const good = state.serializeRun(live);
  const corruptions = [
    ['version', d => { d.version = 99; }],
    ['seed', d => { d.seed = -1; }],
    ['seed', d => { d.seed = 0; d.env.seed = 0; }],
    ['rngSeed', d => { d.rngSeed = 2 ** 32; }],
    ['params.planning', d => { d.params.planning = 1000000; }],
    ['params.communication', d => { d.params.communication = 'false'; }],
    ['params.planner', d => { d.params.planner = 'unknown'; }],
    ['env.state', d => { d.env.state.pop(); }],
    ['env.state', d => { d.env.state[0] = NaN; }],
    ['env.state', d => { d.env.state[0] = 0.1; }],
    ['env.obstacles', d => { d.env.obstacles[0] = 256; }],
    ['env.energy', d => { d.env.energy[0] = 0.5; }],
    ['env.t', d => { d.env.t++; }],
    ['env.seed', d => { d.env.seed++; }],
    ['env.hazards', d => { d.env.hazards[0].x = -1; }],
    ['env.pulseLoc', d => { d.env.pulseLoc = { x: 5, y: 5, radius: 3, life: Infinity }; }],
    ['agents', d => { d.agents = []; }],
    ['agents', d => { d.agents.push(d.agents[0]); }],
    ['agents[0].x', d => { d.agents[0].x = -1; }],
    ['agents[0].renderX', d => { d.agents[0].renderX = NaN; }],
    ['agents[0].q', d => { d.agents[0].q[0] = 1e300; }],
    ['agents[0].visits', d => { d.agents[0].visits[0] = -1; }],
    ['agents[0].rngSeed', d => { delete d.agents[0].rngSeed; }],
    ['agents[0].knownStates', d => { d.agents[0].knownStates.push(d.agents[0].knownStates[0]); }],
    ['agents[0].knownFlag', d => { d.agents[0].knownFlag[d.agents[0].knownStates[0]] = 0; }],
    ['agents[0].observed', d => { d.agents[0].observed[d.agents[0].knownStates[0]] = 0; }],
    ['agents[0].steps', d => { d.agents[0].steps++; }],
    ['agents[0].path', d => { d.agents[0].path.at(-1).x++; }],
    ['agents[0].currentPlan', d => { d.agents[0].currentPlan = [{ x: 30, y: 30 }]; }],
    ['history', d => { d.history[0].step++; }],
    ['history', d => { d.history.pop(); }],
    ['history', d => { d.history[0].reward = Infinity; }],
    ['history', d => { d.history.at(-1).hazards++; }],
    ['snapshot', d => { d.unrecognized = true; }]
  ];
  for (const [field, corrupt] of corruptions) {
    const invalid = clone(good);
    corrupt(invalid);
    assert.throws(() => state.restoreRun(invalid), error => {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes(field), `${field}: ${error.message}`);
      return true;
    }, field);
  }
  assert.deepEqual(state.serializeRun(live), good, 'rejected data never changes the existing run');
});
