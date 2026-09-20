(function(root) {
"use strict";
    const GRID_SIZE = 60;
    const CELL_SIZE = 10;
    const GRID_CELLS = GRID_SIZE * GRID_SIZE;
    const ACTIONS = [
      { x: 0, y: -1, name: "up" },
      { x: 1, y: 0, name: "right" },
      { x: 0, y: 1, name: "down" },
      { x: -1, y: 0, name: "left" },
      { x: 0, y: 0, name: "stay" }
    ];
    const ACTION_COUNT = ACTIONS.length;
    const MAX_ENERGY = 120;
    const HISTORY_LIMIT = 360;
    const MAX_PATH = 180;

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function lerp(a, b, t) {
      return a + (b - a) * t;
    }

    function indexOf(x, y) {
      return y * GRID_SIZE + x;
    }

    function xyOf(index) {
      return { x: index % GRID_SIZE, y: Math.floor(index / GRID_SIZE) };
    }

    function format(value, digits = 2) {
      return Number.isFinite(value) ? value.toFixed(digits) : "0.00";
    }

    function hsl(id, alpha = 1) {
      const hue = (id * 63 + 185) % 360;
      return `hsla(${hue}, 92%, 64%, ${alpha})`;
    }

    class RNG {
      constructor(seed = 1) {
        this.seed = seed >>> 0;
      }

      next() {
        let t = this.seed = (this.seed + 0x6D2B79F5) >>> 0;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      }

      int(max) {
        return Math.floor(this.next() * max);
      }

      range(min, max) {
        return min + this.next() * (max - min);
      }

      choice(list) {
        return list[this.int(list.length)];
      }
    }

    class Environment {
      constructor(seed) {
        this.seed = seed;
        this.rng = new RNG(seed);
        this.state = new Float32Array(GRID_CELLS);
        this.obstacles = new Uint8Array(GRID_CELLS);
        this.energy = new Uint8Array(GRID_CELLS);
        this.hazards = [];
        this.pulseLoc = null;
        this.t = 0;
        this.reset();
      }

      reset() {
        this.rng = new RNG(this.seed);
        this.state.fill(0);
        this.obstacles.fill(0);
        this.energy.fill(0);
        this.hazards = [];
        this.pulseLoc = null;
        this.t = 0;
        this.buildRewardField();
        this.buildObstacles();
        this.spawnEnergy(38);
        this.spawnHazards(16);
        this.clearSafeZone();
      }

      buildRewardField() {
        for (let i = 0; i < GRID_CELLS; i++) {
          this.state[i] = this.rng.range(0.02, 0.12);
        }

        for (let peak = 0; peak < 16; peak++) {
          const cx = this.rng.int(GRID_SIZE);
          const cy = this.rng.int(GRID_SIZE);
          const radius = this.rng.range(4, 12);
          const amp = this.rng.range(1.6, 7.2);

          for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
              const dx = x - cx;
              const dy = y - cy;
              const d2 = dx * dx + dy * dy;
              const value = amp * Math.exp(-d2 / (2 * radius * radius));
              this.state[indexOf(x, y)] += value;
            }
          }
        }

        for (let i = 0; i < 12; i++) this.diffuse(1);
        this.normalizeState();
      }

      normalizeState() {
        let max = 0;
        for (let i = 0; i < GRID_CELLS; i++) max = Math.max(max, this.state[i]);
        if (max <= 0) return;
        for (let i = 0; i < GRID_CELLS; i++) this.state[i] = (this.state[i] / max) * 10;
      }

      buildObstacles() {
        for (let x = 0; x < GRID_SIZE; x++) {
          this.obstacles[indexOf(x, 0)] = 1;
          this.obstacles[indexOf(x, GRID_SIZE - 1)] = 1;
        }
        for (let y = 0; y < GRID_SIZE; y++) {
          this.obstacles[indexOf(0, y)] = 1;
          this.obstacles[indexOf(GRID_SIZE - 1, y)] = 1;
        }

        for (let c = 0; c < 18; c++) {
          let x = this.rng.int(GRID_SIZE);
          let y = this.rng.int(GRID_SIZE);
          const len = 8 + this.rng.int(22);
          const horizontal = this.rng.next() > 0.5;
          for (let i = 0; i < len; i++) {
            x = clamp(x + (horizontal ? 1 : this.rng.int(3) - 1), 2, GRID_SIZE - 3);
            y = clamp(y + (horizontal ? this.rng.int(3) - 1 : 1), 2, GRID_SIZE - 3);
            if (this.rng.next() > 0.17) this.obstacles[indexOf(x, y)] = 1;
          }
        }
      }

      clearSafeZone() {
        const c = Math.floor(GRID_SIZE / 2);
        for (let y = c - 4; y <= c + 4; y++) {
          for (let x = c - 4; x <= c + 4; x++) {
            this.obstacles[indexOf(x, y)] = 0;
            this.energy[indexOf(x, y)] = 0;
          }
        }
        this.hazards = this.hazards.filter(h => Math.abs(h.x - c) > 5 || Math.abs(h.y - c) > 5);
      }

      isBlocked(x, y) {
        if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return true;
        return this.obstacles[indexOf(x, y)] === 1;
      }

      hazardAt(x, y) {
        return this.hazards.some(h => h.x === x && h.y === y);
      }

      spawnEnergy(count) {
        let attempts = 0;
        while (count > 0 && attempts < count * 100) {
          attempts++;
          const x = this.rng.int(GRID_SIZE);
          const y = this.rng.int(GRID_SIZE);
          const i = indexOf(x, y);
          if (!this.obstacles[i] && !this.energy[i] && !this.hazardAt(x, y)) {
            this.energy[i] = 1;
            count--;
          }
        }
      }

      spawnHazards(count) {
        let attempts = 0;
        while (count > 0 && attempts < count * 100) {
          attempts++;
          const x = this.rng.int(GRID_SIZE);
          const y = this.rng.int(GRID_SIZE);
          const i = indexOf(x, y);
          if (!this.obstacles[i] && !this.energy[i]) {
            this.hazards.push({
              x, y,
              dx: this.rng.choice([-1, 1]),
              dy: this.rng.choice([-1, 1])
            });
            count--;
          }
        }
      }

      update(movingHazards = true, diffusionSteps = 1) {
        this.t++;
        if (this.pulseLoc) {
          this.pulseLoc.life -= 0.5;
          if (this.pulseLoc.life <= 0) this.pulseLoc = null;
        }
        if (diffusionSteps > 0 && this.t % 3 === 0) this.diffuse(diffusionSteps);
        if (this.t % 70 === 0) this.injectRewardPulse();
        if (this.t % 45 === 0) this.spawnEnergy(4);
        if (movingHazards) this.updateHazards();
      }

      injectRewardPulse() {
        const cx = 3 + this.rng.int(GRID_SIZE - 6);
        const cy = 3 + this.rng.int(GRID_SIZE - 6);
        const radius = this.rng.range(2.5, 7.5);
        for (let y = 1; y < GRID_SIZE - 1; y++) {
          for (let x = 1; x < GRID_SIZE - 1; x++) {
            const i = indexOf(x, y);
            if (this.obstacles[i]) continue;
            const dx = x - cx;
            const dy = y - cy;
            this.state[i] = clamp(this.state[i] + 2.4 * Math.exp(-(dx * dx + dy * dy) / (2 * radius * radius)), 0, 10);
          }
        }
        this.pulseLoc = { x: cx, y: cy, radius, life: 10 };
      }

      updateHazards() {
        for (const h of this.hazards) {
          if (this.rng.next() < 0.08) {
            h.dx = this.rng.choice([-1, 0, 1]);
            h.dy = this.rng.choice([-1, 0, 1]);
            if (h.dx === 0 && h.dy === 0) h.dx = 1;
          }
          const nx = h.x + h.dx;
          const ny = h.y + h.dy;
          if (this.isBlocked(nx, ny)) {
            h.dx = -h.dx || 0;
            h.dy = -h.dy || 0;
          } else {
            h.x = nx;
            h.y = ny;
          }
        }
      }

      diffuse(steps) {
        for (let s = 0; s < steps; s++) {
          const next = new Float32Array(this.state);
          for (let y = 1; y < GRID_SIZE - 1; y++) {
            for (let x = 1; x < GRID_SIZE - 1; x++) {
              const i = indexOf(x, y);
              if (this.obstacles[i]) continue;
              const n1 = indexOf(x + 1, y);
              const n2 = indexOf(x - 1, y);
              const n3 = indexOf(x, y + 1);
              const n4 = indexOf(x, y - 1);
              let sum = this.state[i];
              let count = 1;
              for (const ni of [n1, n2, n3, n4]) {
                if (!this.obstacles[ni]) {
                  sum += this.state[ni];
                  count++;
                }
              }
              next[i] = clamp(0.992 * (sum / count), 0, 10);
            }
          }
          this.state = next;
        }
      }

      transition(x, y, actionIndex) {
        const action = ACTIONS[actionIndex];
        const nx = clamp(x + action.x, 0, GRID_SIZE - 1);
        const ny = clamp(y + action.y, 0, GRID_SIZE - 1);
        const ni = indexOf(nx, ny);
        const blocked = this.obstacles[ni] === 1;
        const tx = blocked ? x : nx;
        const ty = blocked ? y : ny;
        const ti = indexOf(tx, ty);
        const hazard = this.hazardAt(tx, ty);
        const energyFound = this.energy[ti] === 1;

        let reward = this.state[ti] / 10;
        if (blocked) reward -= 0.45;
        if (hazard) reward -= 1.2;
        if (energyFound) reward += 0.45;
        if (actionIndex === 4) reward -= 0.02;

        if (energyFound) this.energy[ti] = 0;

        return { x: tx, y: ty, index: ti, blocked, hazard, energyFound, reward };
      }
    }

    class Agent {
      constructor(id, env, rng) {
        this.id = id;
        this.rng = rng;
        this.x = Math.floor(GRID_SIZE / 2) + rng.int(7) - 3;
        this.y = Math.floor(GRID_SIZE / 2) + rng.int(7) - 3;
        this.renderX = this.x;
        this.renderY = this.y;
        this.energy = MAX_ENERGY;
        this.totalExtrinsic = 0;
        this.totalIntrinsic = 0;
        this.collisions = 0;
        this.hazardHits = 0;
        this.steps = 0;
        this.respawns = 0;
        this.lastPredictionError = 0;
        this.path = [];
        this.currentPlan = [];
        this.observed = new Uint8Array(GRID_CELLS);
        this.visits = new Float32Array(GRID_CELLS); // Float for smooth decay/pseudo-counts
        this.belief = new Float32Array(GRID_CELLS);
        this.uncertainty = new Float32Array(GRID_CELLS);
        this.error = new Float32Array(GRID_CELLS);
        this.q = new Float32Array(GRID_CELLS * ACTION_COUNT);
        this.knownStates = [];
        this.knownFlag = new Uint8Array(GRID_CELLS);
        this.uncertainty.fill(1);
        this.observe(env, 5, 0.25);
      }

      currentIndex() {
        return indexOf(this.x, this.y);
      }

      updateRender() {
        this.renderX = lerp(this.renderX, this.x, 0.25);
        this.renderY = lerp(this.renderY, this.y, 0.25);
      }

      bestActionValue(stateIndex) {
        const base = stateIndex * ACTION_COUNT;
        let best = -Infinity;
        for (let a = 0; a < ACTION_COUNT; a++) best = Math.max(best, this.q[base + a]);
        return Number.isFinite(best) ? best : 0;
      }

      legalActions(env, x = this.x, y = this.y) {
        return ACTIONS.map((action, a) => {
          const nx = clamp(x + action.x, 0, GRID_SIZE - 1);
          const ny = clamp(y + action.y, 0, GRID_SIZE - 1);
          return env.isBlocked(nx, ny) ? null : a;
        }).filter(a => a !== null);
      }

      estimateValue(x, y, env, params) {
        const i = indexOf(x, y);
        const extrinsic = this.belief[i] / 10;
        // Pseudo-count curiosity: 1 / sqrt(N+1)
        const pseudoCount = this.visits[i];
        const intrinsic = params.curiosity * (1.0 / Math.sqrt(pseudoCount + 1.0));
        const hazardPenalty = env.hazardAt(x, y) ? 1.5 : 0;
        const qVal = this.bestActionValue(i);
        // Blend immediate model prediction with long-term Q-value
        return (extrinsic + intrinsic - hazardPenalty) * 0.6 + qVal * 0.4;
      }

      mpcAction(env, params, legal) {
        let bestAction = legal[0];
        let bestValue = -Infinity;
        let bestPath = [];
        const H = params.planningHorizon;
        const shoots = Math.max(1, Math.floor(params.planning / Math.max(1, legal.length)));

        for (const a0 of legal) {
          const action0 = ACTIONS[a0];
          const x0 = clamp(this.x + action0.x, 0, GRID_SIZE - 1);
          const y0 = clamp(this.y + action0.y, 0, GRID_SIZE - 1);
          const val0 = this.estimateValue(x0, y0, env, params);

          let maxShootVal = val0;
          let actionPath = [{x:this.x,y:this.y},{x:x0,y:y0}];

          for (let s = 0; s < shoots; s++) {
            let cx = x0, cy = y0;
            const path = [{x:this.x,y:this.y},{x:cx,y:cy}];
            let cumVal = val0;
            let gamma = params.discount;
            for (let h = 1; h < H; h++) {
              const legalNext = this.legalActions(env, cx, cy);
              if (legalNext.length === 0) break;
              const an = this.rng.choice(legalNext);
              const actN = ACTIONS[an];
              cx = clamp(cx + actN.x, 0, GRID_SIZE - 1);
              cy = clamp(cy + actN.y, 0, GRID_SIZE - 1);
              path.push({x:cx,y:cy});
              cumVal += gamma * this.estimateValue(cx, cy, env, params);
              gamma *= params.discount;
            }
            if (cumVal > maxShootVal) { maxShootVal = cumVal; actionPath = path; }
          }

          if (maxShootVal > bestValue) {
            bestValue = maxShootVal;
            bestAction = a0;
            bestPath = actionPath;
          }
        }

        this.currentPlan = bestPath;
        return bestAction;
      }

      // Discrete, bounded beam search: immediate rewards at each depth and one
      // terminal Q estimate. Virtual visits and energy pickups are local to a path.
      beamAction(env, params) {
        let beam = [{x:this.x,y:this.y,value:0,rank:0,energy:this.energy,first:4,
          path:[{x:this.x,y:this.y}],visits:new Map(),pickups:new Set()}];
        const width = Math.max(1, Math.min(80, params.planning));
        for (let depth=0; depth<params.planningHorizon; depth++) {
          const candidates = [];
          for (const node of beam) {
            // The real agent respawns next tick after exhaustion. Stop this
            // rollout here rather than value pickups beyond that termination.
            if(node.energy<=0) {candidates.push(node);continue;}
            for (const action of this.legalActions(env,node.x,node.y)) {
              const x=clamp(node.x+ACTIONS[action].x,0,GRID_SIZE-1);
              const y=clamp(node.y+ACTIONS[action].y,0,GRID_SIZE-1);
              const i=indexOf(x,y), visits=new Map(node.visits), pickups=new Set(node.pickups);
              const count=this.visits[i]+(visits.get(i)||0);
              const hazard=env.hazardAt(x,y), pickup=env.energy[i] && !pickups.has(i);
              const urgency=clamp(1-node.energy/45,0,1);
              const reward=this.belief[i]/10 + params.curiosity/Math.sqrt(count+1)
                - (hazard ? 1.5 : 0) - (action===4 ? .02 : 0)
                - params.riskAversion*this.uncertainty[i]
                + (pickup ? .45+2*urgency : 0);
              const energy=clamp(node.energy-.65-(hazard?16:0)+(pickup?36:0),0,MAX_ENERGY);
              visits.set(i,(visits.get(i)||0)+1);
              if(pickup) pickups.add(i);
              const value=node.value+Math.pow(params.discount,depth)*(reward-(energy===0?2:0));
              candidates.push({x,y,value,energy,visits,pickups,
                first:depth===0?action:node.first,path:[...node.path,{x,y}],
                rank:value+(energy>0?Math.pow(params.discount,depth+1)*.4*this.bestActionValue(i):0)});
            }
          }
          candidates.sort((a,b)=>b.rank-a.rank);
          beam=candidates.slice(0,width);
          if(!beam.length) {this.currentPlan=[];return 4;}
        }
        this.currentPlan=beam[0].path;
        return beam[0].first;
      }

      chooseAction(env, params) {
        const legal = this.legalActions(env);
        if (legal.length === 0) return 4;
        if (params.planner === 'random' || this.rng.next() < params.epsilon) {
          this.currentPlan = [];
          return this.rng.choice(legal);
        }

        if (params.planner === 'beam' && params.planning > 0) return this.beamAction(env, params);
        if (params.planner !== 'greedy' && params.planning > 0) {
          return this.mpcAction(env, params, legal);
        }

        let bestAction = legal[0];
        let bestScore = -Infinity;
        const current = this.currentIndex();

        for (const a of legal) {
          const action = ACTIONS[a];
          const nx = clamp(this.x + action.x, 0, GRID_SIZE - 1);
          const ny = clamp(this.y + action.y, 0, GRID_SIZE - 1);
          const ni = indexOf(nx, ny);
          const qValue = this.q[current * ACTION_COUNT + a];
          const pseudoCount = this.visits[ni];
          const novelty = params.curiosity * (1.0 / Math.sqrt(pseudoCount + 1.0));
          const predictedReward = this.belief[ni] / 10;
          const hazardPenalty = env.hazardAt(nx, ny) ? 0.9 : 0;
          const stayPenalty = a === 4 ? 0.04 : 0;
          const score = qValue + novelty + predictedReward - hazardPenalty - stayPenalty;
          if (score > bestScore) {
            bestScore = score;
            bestAction = a;
          }
        }
        this.currentPlan = [];
        return bestAction;
      }

      observe(env, radius, learningRate) {
        const seen = [];
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > radius) continue;
            const x = this.x + dx;
            const y = this.y + dy;
            if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) continue;
            const i = indexOf(x, y);
            const truth = env.state[i];
            const old = this.belief[i];
            const err = Math.abs(truth - old);
            const closeness = 1 - (dist / (radius + 0.001));
            const lr = clamp(learningRate * (0.45 + closeness), 0.02, 0.85);
            this.belief[i] = lerp(old, truth, lr);
            this.error[i] = lerp(this.error[i], err, 0.35);
            this.uncertainty[i] = clamp(this.uncertainty[i] * (1 - 0.55 * lr), 0.02, 1);
            this.observed[i] = 1;
            if (!this.knownFlag[i]) {
              this.knownFlag[i] = 1;
              this.knownStates.push(i);
            }
            seen.push({ i, truth, uncertainty: this.uncertainty[i], error: this.error[i] });
          }
        }
        return seen;
      }

      integrateSharedObservation(obs, learningRate) {
        const old = this.belief[obs.i];
        this.belief[obs.i] = lerp(old, obs.truth, learningRate * 0.75);
        this.error[obs.i] = lerp(this.error[obs.i], Math.abs(obs.truth - old), 0.2);
        this.uncertainty[obs.i] = Math.min(this.uncertainty[obs.i], obs.uncertainty + 0.04);
        this.observed[obs.i] = 1;
        if (!this.knownFlag[obs.i]) {
          this.knownFlag[obs.i] = 1;
          this.knownStates.push(obs.i);
        }
      }

      updateQ(stateIndex, actionIndex, reward, nextIndex, params) {
        const qi = stateIndex * ACTION_COUNT + actionIndex;
        const target = reward + params.discount * this.bestActionValue(nextIndex);
        this.q[qi] += params.learningRate * (target - this.q[qi]);
      }

      imagine(env, params) {
        if (this.knownStates.length === 0 || params.planning <= 0) return;
        for (let n = 0; n < params.planning; n++) {
          const stateIndex = this.rng.choice(this.knownStates);
          const { x, y } = xyOf(stateIndex);
          const legal = this.legalActions(env, x, y);
          if (legal.length === 0) continue;
          const actionIndex = this.rng.choice(legal);
          const action = ACTIONS[actionIndex];
          const nx = clamp(x + action.x, 0, GRID_SIZE - 1);
          const ny = clamp(y + action.y, 0, GRID_SIZE - 1);
          const nextIndex = indexOf(nx, ny);
          const imaginedReward =
            (this.belief[nextIndex] / 10) +
            (params.curiosity * 0.5 * (1 / Math.sqrt(this.visits[nextIndex] + 1))) -
            (env.hazardAt(nx, ny) ? 0.8 : 0) -
            (actionIndex === 4 ? 0.03 : 0);
          this.updateQ(stateIndex, actionIndex, imaginedReward, nextIndex, params);
        }
      }

      step(env, params) {
        if (this.energy <= 0) {
          this.respawns++;
          this.energy = MAX_ENERGY * 0.55;
          this.x = Math.floor(GRID_SIZE / 2);
          this.y = Math.floor(GRID_SIZE / 2);
        }

        const stateIndex = this.currentIndex();
        const actionIndex = this.chooseAction(env, params);
        const result = env.transition(this.x, this.y, actionIndex);

        const previousBelief = this.belief[result.index];
        const predictionError = Math.abs(env.state[result.index] - previousBelief);
        this.lastPredictionError = predictionError;
        const pseudoCount = this.visits[result.index];
        const intrinsic =
          params.curiosity * (1.0 / Math.sqrt(pseudoCount + 1.0)) +
          0.08 * predictionError;

        const totalReward = result.reward + intrinsic;

        this.updateQ(stateIndex, actionIndex, totalReward, result.index, params);

        this.x = result.x;
        this.y = result.y;
        this.path.push({ x: this.x, y: this.y });
        if (this.path.length > MAX_PATH) this.path.shift();

        this.visits[result.index] = this.visits[result.index] + 1;
        this.totalExtrinsic += result.reward;
        this.totalIntrinsic += intrinsic;
        this.steps++;

        if (result.blocked) this.collisions++;
        if (result.hazard) this.hazardHits++;

        this.energy -= 0.65 + (result.blocked ? 1.2 : 0) + (result.hazard ? 16 : 0);
        if (result.energyFound) this.energy = Math.min(MAX_ENERGY, this.energy + 36);
        this.energy = clamp(this.energy, 0, MAX_ENERGY);

        const observations = this.observe(env, params.observeRadius, params.learningRate);
        
        // Background Dyna-Q updates to propagate rewards backwards through Q-table
        this.imagine(env, params);

        // Findings for multi-agent communication
        const findings = observations
          .filter(o => o.truth > 2.5 && o.uncertainty < 0.4)
          .map(o => ({ i: o.i, truth: o.truth, uncertainty: o.uncertainty }));

        return {
          observations,
          findings,
          reward: result.reward,
          intrinsic,
          collision: result.blocked ? 1 : 0,
          hazard: result.hazard ? 1 : 0,
          energy: this.energy
        };
      }

      coverage() {
        let count = 0;
        for (let i = 0; i < GRID_CELLS; i++) count += this.observed[i] ? 1 : 0;
        return count / GRID_CELLS;
      }

      modelMAE(env) {
        let total = 0;
        for (let i = 0; i < GRID_CELLS; i++) {
          total += Math.abs(env.state[i] - this.belief[i]);
        }
        return total / GRID_CELLS;
      }

      avgUncertainty() {
        let total = 0;
        for (let i = 0; i < GRID_CELLS; i++) total += this.uncertainty[i];
        return total / GRID_CELLS;
      }
    }


const DEFAULT_PARAMS = Object.freeze({learningRate:.18,discount:.92,epsilon:.08,
  curiosity:.75,planning:16,planningHorizon:3,observeRadius:4,diffusionSteps:1,
  communication:true,movingHazards:true,planner:'beam',riskAversion:.25});

function validateParams(input) {
  const p={...DEFAULT_PARAMS,...input};
  const ranges={learningRate:[.01,.7],discount:[.2,.99],epsilon:[0,.5],curiosity:[0,2],
    planning:[0,80,true],planningHorizon:[1,6,true],observeRadius:[1,10,true],
    diffusionSteps:[0,4,true],riskAversion:[0,2]};
  for(const key of Object.keys(p)) if(!(key in DEFAULT_PARAMS)) throw new Error('Unknown parameter: '+key);
  for(const [key,[min,max,integer]] of Object.entries(ranges)) {
    if(!Number.isFinite(p[key]) || p[key]<min || p[key]>max || (integer&&!Number.isInteger(p[key])))
      throw new Error('Invalid parameter: '+key);
  }
  if(!['beam','legacy','greedy','random'].includes(p.planner)) throw new Error('Invalid planner');
  for(const key of ['communication','movingHazards']) if(typeof p[key]!=='boolean') throw new Error('Invalid parameter: '+key);
  return p;
}

function createRun(seed=1337,numAgents=4,params={}) {
  if(!Number.isInteger(seed)||seed<1||seed>0xffffffff) throw new Error('Seed must be an integer from 1 to 4294967295');
  if(!Number.isInteger(numAgents)||numAgents<1||numAgents>12) throw new Error('Agents must be an integer from 1 to 12');
  const validated=validateParams(params),env=new Environment(seed);
  return {seed,env,rng:new RNG(seed^0xA11CE),agents:Array.from({length:numAgents},(_,i)=>new Agent(i+1,env,new RNG(seed+i*997+17))),
    stepCount:0,history:[],params:validated};
}

function collectMetrics(run,summary) {
  const n=run.agents.length;
  const mean=fn=>run.agents.reduce((sum,a)=>sum+fn(a),0)/n;
  return {step:run.stepCount,reward:summary?summary.reward/n:0,intrinsic:summary?summary.intrinsic/n:0,
    coverage:mean(a=>a.coverage()),mae:mean(a=>a.modelMAE(run.env)),uncertainty:mean(a=>a.avgUncertainty()),
    energyPct:mean(a=>a.energy)/MAX_ENERGY,collisions:run.agents.reduce((s,a)=>s+a.collisions,0),
    hazards:run.agents.reduce((s,a)=>s+a.hazardHits,0),respawns:run.agents.reduce((s,a)=>s+a.respawns,0),
    predictionError:mean(a=>a.lastPredictionError)};
}

function stepRun(run) {
  const params=run.params;
  run.env.update(params.movingHazards,params.diffusionSteps);
  const summary={reward:0,intrinsic:0},results=[];
  for(const agent of run.agents) {
    const result=agent.step(run.env,params);
    results.push(result); summary.reward+=result.reward;summary.intrinsic+=result.intrinsic;
  }
  // Distance-weighted sharing of sensed rewards. A sender never reconsumes its own data.
  if(params.communication) for(let receiver=0;receiver<run.agents.length;receiver++) {
    const agent=run.agents[receiver];
    for(let sender=0;sender<results.length;sender++) {
      if(sender===receiver) continue;
      for(const f of results[sender].findings) {
        const pos=xyOf(f.i),weight=Math.exp(-(Math.abs(agent.x-pos.x)+Math.abs(agent.y-pos.y))/15);
        if(weight>.1) agent.integrateSharedObservation(f,weight*.4);
      }
    }
  }
  run.stepCount++;
  const metrics=collectMetrics(run,summary);
  run.history.push(metrics);
  if(run.history.length>HISTORY_LIMIT) run.history.shift();
  return metrics;
}

const api = {GRID_SIZE, CELL_SIZE, GRID_CELLS, ACTIONS, ACTION_COUNT, MAX_ENERGY, HISTORY_LIMIT, MAX_PATH, clamp, lerp, indexOf, xyOf, format, hsl, RNG, Environment, Agent, DEFAULT_PARAMS, validateParams, createRun, stepRun, collectMetrics};
if (typeof module !== "undefined" && module.exports) module.exports = api;
else root.DiamondCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
