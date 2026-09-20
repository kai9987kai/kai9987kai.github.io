/**
 * @file connectome-benchmark.js
 * Headless and in-browser benchmark suite for the Drosophila connectome models.
 *
 * Arms:
 *   RandomWalk         - Brownian exploration over legal moves
 *   SingleBrain_AL     - one Antennal Lobe brain, chemotaxis only
 *   CentralComplex_8B  - the first 8 brains, Central Complex subsystem
 *   Syncytium_16B      - the full 16-brain syncytium
 *   Syncytium_16B_Legacy - the same syncytium with the pre-upgrade circuit
 *                        models (kinematic compass, top-k sparseness, Hebbian
 *                        plasticity), so the upgrade can be measured rather
 *                        than asserted
 *   Spiking_MB         - the leaky integrate-and-fire mushroom body
 *
 * Reporting follows the same conventions as the World Lab experiments: raw
 * per-seed observations, paired percentile bootstrap intervals from a separate
 * seeded generator, probability of improvement and an interquartile mean, after
 * Agarwal et al., Deep Reinforcement Learning at the Edge of the Statistical
 * Precipice (NeurIPS 2021). Means alone over a handful of seeds do not support
 * a claim either way.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./fly-brain-engine.js"), require("./fly-lif-circuit.js"));
  } else {
    root.ConnectomeBenchmark = factory(root.FlyBrainEngine, root.FlyLifCircuit);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (FlyBrainEngine, FlyLifCircuit) {
  "use strict";

  const {
    MulberryPRNG,
    ChemicalFieldGrid,
    DrosophilaBrain,
    SixteenFlyBrainSyncytium,
    PreTrainingEngine,
    angleDelta
  } = FlyBrainEngine;

  /**
   * Angular velocity from a step vector, given the previous heading. The
   * compass integrates a turn rate, so handing it an absolute bearing makes the
   * heading estimate meaningless. A fly that did not move did not turn.
   */
  function turnRate(policy, stepDx, stepDy) {
    if (stepDx === 0 && stepDy === 0) return 0;
    const heading = Math.atan2(stepDy, stepDx);
    const delta = angleDelta(heading, policy.heading);
    policy.heading = heading;
    return delta;
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  // -------------------------------------------------------------
  // Statistics
  // -------------------------------------------------------------
  const BOOTSTRAP_SAMPLES = 2000;
  const BOOTSTRAP_SEED = 20260912;

  function mean(values) {
    if (!values.length) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  function quantile(sorted, fraction) {
    if (!sorted.length) return null;
    const index = (sorted.length - 1) * fraction;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
  }

  /**
   * Interquartile mean: the mean of the middle half of the runs. One lucky or
   * unlucky seed moves it far less than it moves a plain mean, which matters
   * when the seed count is small.
   */
  function interquartileMean(values) {
    if (values.length < 4) return mean(values);
    const sorted = values.slice().sort((a, b) => a - b);
    const cut = Math.floor(sorted.length / 4);
    return mean(sorted.slice(cut, sorted.length - cut));
  }

  /**
   * Paired percentile bootstrap over seed-level differences. Resampling seeds
   * rather than episodes is what keeps the pairing intact.
   */
  function pairedBootstrap(deltas, samples = BOOTSTRAP_SAMPLES, seed = BOOTSTRAP_SEED) {
    if (deltas.length < 2) {
      return { meanDelta: deltas.length ? deltas[0] : null, ci95: null, samples, seed };
    }
    const prng = new MulberryPRNG(seed);
    const resampled = new Array(samples);
    for (let s = 0; s < samples; s++) {
      let total = 0;
      for (let i = 0; i < deltas.length; i++) total += deltas[prng.int(deltas.length)];
      resampled[s] = total / deltas.length;
    }
    resampled.sort((a, b) => a - b);
    return {
      meanDelta: mean(deltas),
      ci95: [quantile(resampled, 0.025), quantile(resampled, 0.975)],
      samples,
      seed
    };
  }

  /**
   * Share of seeds each arm wins, with ties split evenly between everyone tied
   * for best. Awarding a tie to whichever arm comes first in the list quietly
   * favours the arm listed first, which is how a baseline ends up looking
   * stronger than it is.
   *
   * @param {Object<string, Array<number>>} scoresByArm - per-seed scores, same order per arm
   * @returns {Object<string, number>} win share per arm, in percent
   */
  function winRates(scoresByArm) {
    const arms = Object.keys(scoresByArm);
    if (!arms.length) return {};
    const seedCount = scoresByArm[arms[0]].length;
    const counts = {};
    for (const arm of arms) counts[arm] = 0;
    for (let i = 0; i < seedCount; i++) {
      let best = -Infinity;
      for (const arm of arms) best = Math.max(best, scoresByArm[arm][i]);
      const winners = arms.filter(arm => scoresByArm[arm][i] === best);
      for (const arm of winners) counts[arm] += 1 / winners.length;
    }
    const rates = {};
    for (const arm of arms) {
      rates[arm] = seedCount > 0 ? parseFloat(((counts[arm] / seedCount) * 100).toFixed(1)) : 0;
    }
    return rates;
  }

  /**
   * Probability that a run of the arm beats a run of the reference on a matched
   * seed, ties counting half. This is the paired form of the "probability of
   * improvement" statistic and says nothing about effect size.
   */
  function probabilityOfImprovement(armScores, referenceScores) {
    const n = Math.min(armScores.length, referenceScores.length);
    if (n === 0) return null;
    let wins = 0;
    for (let i = 0; i < n; i++) {
      if (armScores[i] > referenceScores[i]) wins += 1;
      else if (armScores[i] === referenceScores[i]) wins += 0.5;
    }
    return wins / n;
  }

  // -------------------------------------------------------------
  // Benchmark Arena (Headless Environment with Chemical Diffusion)
  // -------------------------------------------------------------
  class BenchmarkArena {
    constructor(gridSize = 16, seed = 42, diamondCount = 8, hazardCount = 4) {
      this.gridSize = gridSize;
      this.seed = seed;
      this.diamondCount = diamondCount;
      this.hazardCount = hazardCount;
      this.prng = new MulberryPRNG(seed);

      this.agentX = 0;
      this.agentY = 0;
      this.agentEnergy = 100;
      this.maxEnergy = 160;

      this.diamonds = [];
      this.hazards = [];
      this.visitedCells = new Set();
      this.chemGrid = new ChemicalFieldGrid(gridSize, gridSize);

      this.diamondsCollected = 0;
      this.hazardsHit = 0;
      this.stasisEvents = 0;
      this.steps = 0;
      this.dwellTicks = 0;

      this._init();
    }

    _key(x, y) {
      return `${x},${y}`;
    }

    _init() {
      const occupied = new Set();
      this.agentX = this.prng.int(this.gridSize);
      this.agentY = this.prng.int(this.gridSize);
      occupied.add(this._key(this.agentX, this.agentY));
      this.visitedCells.add(this._key(this.agentX, this.agentY));

      while (this.diamonds.length < this.diamondCount) {
        const x = this.prng.int(this.gridSize);
        const y = this.prng.int(this.gridSize);
        const k = this._key(x, y);
        if (!occupied.has(k)) {
          this.diamonds.push({ x, y });
          occupied.add(k);
        }
      }

      while (this.hazards.length < this.hazardCount) {
        const x = this.prng.int(this.gridSize);
        const y = this.prng.int(this.gridSize);
        const k = this._key(x, y);
        if (!occupied.has(k)) {
          this.hazards.push({ x, y });
          occupied.add(k);
        }
      }

      // Initial chemical seeding
      this._diffusePlumes();
    }

    _diffusePlumes() {
      for (const d of this.diamonds) this.chemGrid.emit("foodOdor", d.x, d.y, 0.45);
      for (const h of this.hazards) this.chemGrid.emit("threatOdor", h.x, h.y, 0.45);
      this.chemGrid.step(0.18, 0.94);
    }

    getSensoryObs(heading = 0) {
      const dnX = this.agentX / this.gridSize;
      const dnY = this.agentY / this.gridSize;
      const normE = this.agentEnergy / 100;

      let nearestDiamond = 999;
      let diamondAngle = 0;
      for (const d of this.diamonds) {
        const dist = Math.hypot(d.x - this.agentX, d.y - this.agentY);
        if (dist < nearestDiamond) {
          nearestDiamond = dist;
          diamondAngle = Math.atan2(d.y - this.agentY, d.x - this.agentX);
        }
      }

      let nearestHazard = 999;
      let hazardAngle = 0;
      for (const h of this.hazards) {
        const dist = Math.hypot(h.x - this.agentX, h.y - this.agentY);
        if (dist < nearestHazard) {
          nearestHazard = dist;
          hazardAngle = Math.atan2(h.y - this.agentY, h.x - this.agentX);
        }
      }

      const diamondReward = nearestDiamond < 6 ? (6 - nearestDiamond) / 6 : 0;
      const hazardThreat = nearestHazard < 4 ? (4 - nearestHazard) / 4 : 0;

      // Bilateral antennal odor sampling
      const biFood = this.chemGrid.sampleBilateral("foodOdor", this.agentX, this.agentY, heading, 0.8);
      const leftAntenna = clamp(biFood.left, 0, 1);
      const rightAntenna = clamp(biFood.right, 0, 1);

      return [
        dnX, dnY,
        diamondReward,
        hazardThreat,
        normE,
        Math.min(nearestDiamond / this.gridSize, 1),
        Math.sin(diamondAngle), Math.cos(diamondAngle),
        Math.sin(hazardAngle), Math.cos(hazardAngle),
        0, 0,
        leftAntenna,
        rightAntenna
      ];
    }

    step(actionIndex) {
      this.steps++;
      const lastX = this.agentX;
      const lastY = this.agentY;

      // 0=up, 1=down, 2=left, 3=right
      const dx = [0, 0, -1, 1][actionIndex] || 0;
      const dy = [-1, 1, 0, 0][actionIndex] || 0;

      const targetX = clamp(this.agentX + dx, 0, this.gridSize - 1);
      const targetY = clamp(this.agentY + dy, 0, this.gridSize - 1);

      this.agentX = targetX;
      this.agentY = targetY;
      this.visitedCells.add(this._key(this.agentX, this.agentY));

      // Inactivity / Stasis check: 4 still ticks triggers stasis penalty
      if (this.agentX === lastX && this.agentY === lastY) {
        this.dwellTicks++;
        if (this.dwellTicks >= 4) {
          this.stasisEvents++;
          this.agentEnergy = Math.max(0, this.agentEnergy - 8);
        }
      } else {
        this.dwellTicks = 0;
      }

      // Base step energy consumption
      this.agentEnergy = Math.max(0, this.agentEnergy - 1);

      let collectedDiamond = false;
      let hitHazard = false;

      // Diamond collision
      for (let i = this.diamonds.length - 1; i >= 0; i--) {
        if (this.diamonds[i].x === this.agentX && this.diamonds[i].y === this.agentY) {
          this.diamonds.splice(i, 1);
          this.diamondsCollected++;
          this.agentEnergy = Math.min(this.maxEnergy, this.agentEnergy + 25);
          collectedDiamond = true;

          // Respawn diamond in empty location
          const occupied = new Set([
            this._key(this.agentX, this.agentY),
            ...this.hazards.map(h => this._key(h.x, h.y)),
            ...this.diamonds.map(d => this._key(d.x, d.y))
          ]);
          let rx, ry;
          let attempts = 0;
          do {
            rx = this.prng.int(this.gridSize);
            ry = this.prng.int(this.gridSize);
            attempts++;
          } while (occupied.has(this._key(rx, ry)) && attempts < 50);
          this.diamonds.push({ x: rx, y: ry });
          break;
        }
      }

      // Hazard collision
      for (const h of this.hazards) {
        if (h.x === this.agentX && h.y === this.agentY) {
          this.hazardsHit++;
          this.agentEnergy = Math.max(0, this.agentEnergy - 20);
          hitHazard = true;
          break;
        }
      }

      this._diffusePlumes();

      const done = this.agentEnergy <= 0;
      return {
        done,
        agentX: this.agentX,
        agentY: this.agentY,
        agentEnergy: this.agentEnergy,
        diamondsCollected: this.diamondsCollected,
        hazardsHit: this.hazardsHit,
        stasisEvents: this.stasisEvents,
        stepDx: this.agentX - lastX,
        stepDy: this.agentY - lastY,
        collectedDiamond,
        hitHazard
      };
    }
  }

  // -------------------------------------------------------------
  // Policy Definitions
  // -------------------------------------------------------------

  class RandomWalkPolicy {
    constructor(seed = 42) {
      this.name = "RandomWalk";
      this.prng = new MulberryPRNG(seed);
    }
    act(obs, stepDx, stepDy, energy, stepIndex, currentX = 0, currentY = 0, gridSize = 16) {
      const legalActions = [];
      const dxs = [0, 0, -1, 1], dys = [-1, 1, 0, 0];
      for (let a = 0; a < 4; a++) {
        const nx = currentX + dxs[a], ny = currentY + dys[a];
        if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
          legalActions.push(a);
        }
      }
      return legalActions[this.prng.int(legalActions.length)] || 0;
    }
    reinforce() {}
  }

  class SingleBrainPolicy {
    constructor() {
      this.name = "SingleBrain_AL";
      this.brain = new DrosophilaBrain(0, "forager");
      this.heading = 0;
    }
    act(sensoryObs, stepDx, stepDy, energy, stepIndex, currentX = 0, currentY = 0, gridSize = 16) {
      const outputs = this.brain.forward(sensoryObs, 0, null, null);
      const sorted = [0, 1, 2, 3].sort((a, b) => outputs[b] - outputs[a]);
      const dxs = [0, 0, -1, 1], dys = [-1, 1, 0, 0];
      let chosen = sorted[0];
      for (const a of sorted) {
        const nx = currentX + dxs[a], ny = currentY + dys[a];
        if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) { chosen = a; break; }
      }
      // Nothing else sets this on a brain used outside a syncytium, and the
      // dopamine-gated rule reads it to decide which channel coincided with the
      // outcome. Left at -1 it treats every channel as the taken one, so the
      // update carries no direction at all and this arm never learns.
      this.brain.lastActionIndex = chosen;
      return chosen;
    }
    reinforce(rew, haz) {
      this.brain.applyPlasticity(rew > 0 ? 1.0 : 0, haz > 0 ? 1.0 : 0);
    }
  }

  class CentralComplex8Policy {
    constructor(seed = 42) {
      this.name = "CentralComplex_8B";
      this.syncytium = new SixteenFlyBrainSyncytium(seed);
      this.syncytium.brainCount = 8;
      this.heading = 0;
    }
    act(sensoryObs, stepDx = 0, stepDy = 0, energy = 100, stepIndex = 0, currentX = 0, currentY = 0, gridSize = 16) {
      const probs = this.syncytium.step(sensoryObs, turnRate(this, stepDx, stepDy), 0, energy, {
        dx: 0, dy: 0, dist: 5, sunAngle: 0, stepDx, stepDy
      });
      const sorted = [0, 1, 2, 3].sort((a, b) => probs[b] - probs[a]);
      const dxs = [0, 0, -1, 1], dys = [-1, 1, 0, 0];
      for (const a of sorted) {
        const nx = currentX + dxs[a], ny = currentY + dys[a];
        if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) return a;
      }
      return sorted[0];
    }
    reinforce(rew, haz, coords) {
      this.syncytium.applyReinforcement(rew, haz, coords);
    }
  }

  class SixteenBrainSyncytiumPolicy {
    /**
     * @param {number} seed
     * @param {object|string|null} [config] - "legacy" selects the pre-upgrade
     *   circuit models, which is how the legacy arm is built.
     */
    constructor(seed = 42, config = null) {
      this.name = config === "legacy" ? "Syncytium_16B_Legacy" : "Syncytium_16B";
      this.syncytium = new SixteenFlyBrainSyncytium(seed, config);
      PreTrainingEngine.runPreTraining(this.syncytium, 15);
      this.heading = 0;
      this.latchAction = -1;
      this.latchTimer = 0;
      // A fixed celestial azimuth for this world. The sun moves over a day,
      // but not over a foraging bout, which is what makes it usable as a
      // reference at all.
      this.skyReference = (seed % 360) * Math.PI / 180;
    }
    act(sensoryObs, stepDx = 0, stepDy = 0, energy = 100, stepIndex = 0, currentX = 0, currentY = 0, gridSize = 16) {
      const sunAngle = ((stepIndex % 120) / 120) * Math.PI * 2;
      const probs = this.syncytium.step(sensoryObs, turnRate(this, stepDx, stepDy), 0, energy, {
        dx: 0, dy: 0, dist: 99, sunAngle, skyReference: this.skyReference, stepDx, stepDy
      });

      const dxs = [0, 0, -1, 1], dys = [-1, 1, 0, 0];
      const sorted = [0, 1, 2, 3].sort((a, b) => probs[b] - probs[a]);

      // Break latch if near diamond or threat
      if ((sensoryObs[2] || 0) > 0.05 || (sensoryObs[3] || 0) > 0.25) {
        this.latchTimer = 0;
      }

      // SMP Action commitment latching
      if (this.latchTimer > 0 && this.latchAction >= 0) {
        const lx = currentX + dxs[this.latchAction];
        const ly = currentY + dys[this.latchAction];
        if (lx >= 0 && lx < gridSize && ly >= 0 && ly < gridSize) {
          this.latchTimer--;
          return this.latchAction;
        } else {
          this.latchTimer = 0;
        }
      }

      let chosen = sorted[0];
      for (const a of sorted) {
        const nx = currentX + dxs[a];
        const ny = currentY + dys[a];
        if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
          chosen = a;
          break;
        }
      }

      this.latchAction = chosen;
      this.latchTimer = 2;
      return chosen;
    }
    reinforce(rew, haz, coords) {
      this.syncytium.applyReinforcement(rew, haz, coords);
    }
  }

  /**
   * Drives the spiking mushroom body from the sensory vector and reads the four
   * output neurons as action preferences. Neural time per environment step is
   * short on purpose: this arm exists to check that a spiking implementation of
   * the same circuit behaves sensibly in the loop, not to win the benchmark.
   */
  class SpikingMushroomBodyPolicy {
    constructor(seed = 42, neuralMsPerStep = 30) {
      this.name = "Spiking_MB";
      this.neuralMsPerStep = neuralMsPerStep;
      this.circuit = FlyLifCircuit.buildMushroomBodyCircuit({ seed, glomeruli: 14 });
      this.mbonIndices = this.circuit.groupIndices("mbon");
      this.pnIds = Array.from({ length: 14 }, (_, i) => `pn${i}`);
      this.prng = new MulberryPRNG(seed ^ 0x51f1);
    }

    act(sensoryObs, stepDx, stepDy, energy, stepIndex, currentX = 0, currentY = 0, gridSize = 16) {
      // Sensory channels become projection-neuron drive; the 1.6 mV/ms scale is
      // the level calibrated to give tens-of-Hz projection neuron rates.
      this.circuit.clearDrive();
      for (let g = 0; g < this.pnIds.length; g++) {
        const value = Number.isFinite(sensoryObs[g]) ? Math.max(0, sensoryObs[g]) : 0;
        this.circuit.setDrive([this.pnIds[g]], clamp(value, 0, 1) * 1.6);
      }
      const counts = this.circuit.run(this.neuralMsPerStep);

      const preference = this.mbonIndices.map(i => counts[i]);
      const dxs = [0, 0, -1, 1];
      const dys = [-1, 1, 0, 0];
      const order = [0, 1, 2, 3].sort((a, b) => {
        if (preference[b] !== preference[a]) return preference[b] - preference[a];
        return a - b;
      });
      // Output rates saturate into ties often enough that a deterministic
      // tie-break would collapse into one direction; break ties on the seeded
      // stream instead.
      if (preference[order[0]] === preference[order[1]]) {
        const legal = [];
        for (let a = 0; a < 4; a++) {
          const nx = currentX + dxs[a];
          const ny = currentY + dys[a];
          if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) legal.push(a);
        }
        return legal.length ? legal[this.prng.int(legal.length)] : 0;
      }
      for (const a of order) {
        const nx = currentX + dxs[a];
        const ny = currentY + dys[a];
        if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) return a;
      }
      return order[0];
    }

    reinforce() {
      // This module has no plasticity: it is a fixed spiking circuit.
    }
  }

  // -------------------------------------------------------------
  // Connectome Benchmark Runner
  // -------------------------------------------------------------
  class ConnectomeBenchmarkRunner {
    constructor() {
      this.supportedArms = [
        "RandomWalk",
        "SingleBrain_AL",
        "CentralComplex_8B",
        "Syncytium_16B_Legacy",
        "Syncytium_16B"
      ];
      // Available but off the default list: an episode costs roughly an order
      // of magnitude more than a rate-coded arm.
      this.optionalArms = ["Spiking_MB"];
    }

    knownArms() {
      return this.supportedArms.concat(this.optionalArms);
    }

    _createPolicy(armName, seed) {
      switch (armName) {
        case "RandomWalk":
          return new RandomWalkPolicy(seed);
        case "SingleBrain_AL":
          return new SingleBrainPolicy();
        case "CentralComplex_8B":
          return new CentralComplex8Policy(seed);
        case "Syncytium_16B":
          return new SixteenBrainSyncytiumPolicy(seed);
        case "Syncytium_16B_Legacy":
          return new SixteenBrainSyncytiumPolicy(seed, "legacy");
        case "Spiking_MB":
          return new SpikingMushroomBodyPolicy(seed);
        default:
          throw new Error(`Unsupported benchmark arm: ${armName}`);
      }
    }

    runEpisode(armName, seed = 42, stepLimit = 100) {
      const arena = new BenchmarkArena(16, seed, 8, 4);
      const policy = this._createPolicy(armName, seed);

      let lastDx = 0, lastDy = 0;
      let heading = 0;

      for (let t = 0; t < stepLimit; t++) {
        const obs = arena.getSensoryObs(heading);
        const action = policy.act(
          obs, lastDx, lastDy, arena.agentEnergy, t, arena.agentX, arena.agentY, arena.gridSize
        );

        const res = arena.step(action);
        lastDx = res.stepDx;
        lastDy = res.stepDy;
        heading = Math.atan2(lastDy, lastDx || 0.0001);

        if (res.collectedDiamond) {
          policy.reinforce(1.0, 0, { x: arena.agentX, y: arena.agentY });
        }
        if (res.hitHazard) {
          policy.reinforce(0, 1.0, { x: arena.agentX, y: arena.agentY });
        }

        if (res.done) break;
      }

      // Net score calculation
      const netScore =
        arena.diamondsCollected * 25 -
        arena.hazardsHit * 20 -
        arena.stasisEvents * 8 +
        Math.floor(arena.agentEnergy * 0.2);

      return {
        arm: armName,
        seed,
        stepsSurvived: arena.steps,
        diamondsCollected: arena.diamondsCollected,
        hazardsHit: arena.hazardsHit,
        stasisEvents: arena.stasisEvents,
        finalEnergy: arena.agentEnergy,
        uniqueCells: arena.visitedCells.size,
        netScore
      };
    }

    /**
     * @param {object} [options]
     * @param {number} [options.episodesPerArm]
     * @param {number} [options.stepLimit]
     * @param {Array<number>} [options.seeds] - every arm runs this exact seed set
     * @param {Array<string>} [options.arms] - defaults to supportedArms
     * @param {string} [options.reference] - arm that comparisons are measured
     *   against; defaults to RandomWalk when present
     * @param {number} [options.bootstrapSamples]
     * @param {number} [options.bootstrapSeed]
     * @param {Function} [options.onProgress]
     */
    async runComparativeBenchmark({
      episodesPerArm = 5,
      stepLimit = 100,
      seeds = null,
      arms: requestedArms = null,
      reference = null,
      bootstrapSamples = BOOTSTRAP_SAMPLES,
      bootstrapSeed = BOOTSTRAP_SEED,
      onProgress = null
    } = {}) {
      const arms = requestedArms && requestedArms.length ? requestedArms.slice() : this.supportedArms.slice();
      if (new Set(arms).size !== arms.length) {
        throw new Error("Benchmark arms must be distinct: results are keyed by arm name.");
      }
      for (const arm of arms) {
        if (!this.knownArms().includes(arm)) throw new Error(`Unsupported benchmark arm: ${arm}`);
      }
      const baseSeeds = seeds && seeds.length
        ? seeds
        : Array.from({ length: episodesPerArm }, (_, i) => 1001 + i * 73);
      if (seeds && seeds.length === 1) {
        throw new Error("Paired intervals need at least two seeds; one seed gives a difference with no interval.");
      }
      if (new Set(baseSeeds).size !== baseSeeds.length) {
        throw new Error("Benchmark seeds must be distinct: paired statistics need one pair per seed.");
      }
      const rawResults = {};
      arms.forEach(arm => (rawResults[arm] = []));

      const totalRuns = arms.length * baseSeeds.length;

      let completed = 0;

      for (const arm of arms) {
        for (const seed of baseSeeds) {
          const ep = this.runEpisode(arm, seed, stepLimit);
          rawResults[arm].push(ep);
          completed++;
          if (onProgress) {
            onProgress({
              arm,
              seed,
              completed,
              totalRuns,
              percent: Math.round((completed / totalRuns) * 100)
            });
            if (typeof setTimeout !== "undefined") {
              await new Promise(r => setTimeout(r, 0));
            }
          }
        }
      }

      // Aggregate metrics per arm
      const aggregated = arms.map(arm => {
        const eps = rawResults[arm];
        const n = eps.length || 1;
        const netScores = eps.map(e => e.netScore);
        const meanDiamonds = eps.reduce((acc, e) => acc + e.diamondsCollected, 0) / n;
        const meanHazards = eps.reduce((acc, e) => acc + e.hazardsHit, 0) / n;
        const meanStasis = eps.reduce((acc, e) => acc + e.stasisEvents, 0) / n;
        const meanFinalEnergy = eps.reduce((acc, e) => acc + e.finalEnergy, 0) / n;
        const meanStepsSurvived = eps.reduce((acc, e) => acc + e.stepsSurvived, 0) / n;
        const meanUniqueCells = eps.reduce((acc, e) => acc + e.uniqueCells, 0) / n;
        const meanNetScore = eps.reduce((acc, e) => acc + e.netScore, 0) / n;

        return {
          arm,
          episodes: n,
          meanDiamonds: parseFloat(meanDiamonds.toFixed(2)),
          meanHazards: parseFloat(meanHazards.toFixed(2)),
          meanStasis: parseFloat(meanStasis.toFixed(2)),
          meanFinalEnergy: parseFloat(meanFinalEnergy.toFixed(2)),
          meanStepsSurvived: parseFloat(meanStepsSurvived.toFixed(2)),
          meanUniqueCells: parseFloat(meanUniqueCells.toFixed(2)),
          meanNetScore: parseFloat(meanNetScore.toFixed(2)),
          // Robust to a single outlying seed, unlike the mean above.
          iqmNetScore: parseFloat(interquartileMean(netScores).toFixed(2)),
          raw: eps
        };
      });

      const scoresByArm = {};
      for (const arm of arms) scoresByArm[arm] = rawResults[arm].map(e => e.netScore);
      const rates = winRates(scoresByArm);
      aggregated.forEach(item => { item.winRate = rates[item.arm]; });

      // Paired comparisons against a reference arm.
      const referenceArm = reference
        || (arms.includes("RandomWalk") ? "RandomWalk" : arms[0]);
      if (!arms.includes(referenceArm)) {
        throw new Error(`Reference arm ${referenceArm} is not among the arms being run.`);
      }

      const referenceScores = rawResults[referenceArm].map(e => e.netScore);
      const comparisons = arms
        .filter(arm => arm !== referenceArm)
        .map(arm => {
          const armScores = rawResults[arm].map(e => e.netScore);
          const deltas = armScores.map((score, i) => score - referenceScores[i]);
          const bootstrap = pairedBootstrap(deltas, bootstrapSamples, bootstrapSeed);
          const ci = bootstrap.ci95;
          return {
            arm,
            reference: referenceArm,
            pairCount: deltas.length,
            meanDelta: parseFloat(bootstrap.meanDelta.toFixed(3)),
            ci95: ci ? [parseFloat(ci[0].toFixed(3)), parseFloat(ci[1].toFixed(3))] : null,
            probabilityOfImprovement: probabilityOfImprovement(armScores, referenceScores),
            perSeedDeltas: deltas,
            // An interval that straddles zero is not evidence either way.
            separatesFromZero: ci ? (ci[0] > 0 || ci[1] < 0) : null
          };
        });

      return {
        protocol: {
          version: "connectome-benchmark/2",
          metric: "netScore = 25*diamonds - 20*hazards - 8*stasis + floor(0.2*energy)",
          statistics: "paired percentile bootstrap over seed-level differences, 95% interval",
          bootstrapSamples,
          bootstrapSeed,
          limitations: "A reduced 16x16 arena over a small seed set. Equal step budgets are not equal computation, and these seeds are not a held-out evaluation set."
        },
        generatedAt: new Date().toISOString(),
        episodesPerArm: baseSeeds.length,
        stepLimit,
        seeds: baseSeeds,
        reference: referenceArm,
        arms: aggregated,
        comparisons
      };
    }
  }

  return {
    BenchmarkArena,
    RandomWalkPolicy,
    SingleBrainPolicy,
    CentralComplex8Policy,
    SixteenBrainSyncytiumPolicy,
    SpikingMushroomBodyPolicy,
    ConnectomeBenchmarkRunner,
    interquartileMean,
    pairedBootstrap,
    winRates,
    probabilityOfImprovement,
    BOOTSTRAP_SAMPLES,
    BOOTSTRAP_SEED
  };
});
