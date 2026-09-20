const {test} = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/worldlab-core.js');
const {Environment, Agent, RNG, indexOf, ACTIONS} = core;
const params = {learningRate:.18,discount:.92,epsilon:0,curiosity:.75,planning:16,planningHorizon:3,observeRadius:4,diffusionSteps:1,communication:true,movingHazards:true,planner:'beam',riskAversion:.25};

test('RNG state remains a resumable uint32 after every draw', () => {
  const rng = new RNG(42);
  for (let i=0;i<10;i++) rng.next();
  assert.equal(rng.seed, rng.seed >>> 0);
  const restored = new RNG(rng.seed);
  assert.equal(restored.next(), rng.next());
});

test('beam planner prefers reachable energy when energy is low', () => {
  const env = new Environment(7); env.obstacles.fill(0); env.energy.fill(0); env.hazards=[];
  const agent = new Agent(1,env,new RNG(5)); agent.x=30;agent.y=30;agent.energy=3;
  agent.belief.fill(0);agent.visits.fill(0);agent.q.fill(0); agent.uncertainty.fill(0);
  env.energy[indexOf(31,30)]=1;
  const before = JSON.stringify({energy:Array.from(env.energy),visits:Array.from(agent.visits)});
  assert.equal(agent.chooseAction(env,params),1);
  assert.equal(JSON.stringify({energy:Array.from(env.energy),visits:Array.from(agent.visits)}),before);
  assert.deepEqual(agent.currentPlan[0],{x:30,y:30});
  assert.deepEqual(agent.currentPlan[1],{x:31,y:30});
});

test('selected legacy rollout starts with the executed action and stays legal', () => {
  const env = new Environment(1337); const agent = new Agent(1,env,new RNG(44));
  const action = agent.chooseAction(env,{...params,planner:'legacy'});
  assert.deepEqual(agent.currentPlan[1], {x:agent.x+ACTIONS[action].x,y:agent.y+ACTIONS[action].y});
  for (const p of agent.currentPlan) assert.equal(env.isBlocked(p.x,p.y),false);
});

test('prediction residual measures reward field rather than hazard penalties', () => {
  const env=new Environment(42);const a=new Agent(1,env,new RNG(3));
  env.state.fill(5);env.energy.fill(0);env.hazards=[{x:a.x,y:a.y,dx:1,dy:1}];
  a.belief.fill(5);a.chooseAction=()=>4;
  a.step(env,{...params,planning:0});
  assert.equal(a.lastPredictionError,0);
  assert.equal(a.hazardHits,1);
});

test('headless runs reproduce dynamics and metrics with the same seed', () => {
  assert.equal(typeof core.createRun,'function');
  const a=core.createRun(27,2,params),b=core.createRun(27,2,params);
  for(let i=0;i<90;i++){core.stepRun(a);core.stepRun(b);}
  assert.deepEqual(a,b);
  assert.equal(a.stepCount,90);
  assert.equal(a.env.t,90);
  assert.ok(a.history.at(-1).coverage>0);
});

test('beam rollout uses the environment boundary rule on an open border', () => {
  const env=new Environment(4);env.obstacles.fill(0);env.hazards=[];
  const a=new Agent(1,env,new RNG(2));a.x=0;a.y=0;
  a.chooseAction(env,params);
  assert.ok(a.currentPlan.every(p=>p.x>=0&&p.y>=0&&p.x<60&&p.y<60));
});

test('depleted beam branches end before an unreachable later energy pickup', () => {
  const env=new Environment(4);env.obstacles.fill(0);env.energy.fill(0);env.hazards=[];
  const a=new Agent(1,env,new RNG(2));a.x=10;a.y=10;a.energy=.6;
  a.belief.fill(0);a.q.fill(0);env.energy[indexOf(12,10)]=1;
  a.chooseAction(env,{...params,curiosity:0,riskAversion:0});
  assert.equal(a.currentPlan.length,2);
  assert.ok(!a.currentPlan.some(p=>p.x===12&&p.y===10));
});
