/**
 * @file fly-brain-engine.js
 * Biologically-inspired computational simulation of 11 interconnected Drosophila
 * (fruit fly) brain connectomes with offline Pre-Training, dynamic neurogenesis,
 * 3-factor LTM plasticity, tri-neuromodulation (Dopamine, Octopamine, Serotonin),
 * Central Complex vector navigation, Optic Lobe motion flow, Subesophageal Zone (SEZ)
 * metabolic homeostasis, Lateral Accessory Lobe (LAL) flip-flop casting, VNC CPG gait
 * rhythm, Johnston's Organ AMMC mechanosensory signals, and Dual-Agent Graph Grafting
 * with Stagnation Inactivity Hazards.
 *
 * Grounded in connectomic architectures catalogued in Drosophila male CNS
 * research (e.g. malecns / Janelia FlyEM):
 *  - Antennal Lobe (AL): Glomerular sensory projection neurons & local interneurons
 *  - Mushroom Body (MB): Sparse Kenyon Cells (KCs), APL inhibition, MBON readout
 *  - Central Complex (CX): Ring attractor compass (E-PG, P-EN) and Fan-Shaped Body (FB) vector steering
 *  - Optic Lobe (OL): Medulla and Lobula motion flow & visual gradient processing
 *  - Executive Fan-Shaped Body (FB): Working memory goal vector pursuit & trajectory planning
 *  - Subesophageal Zone (SEZ / GNG): Taste & metabolic homeostasis, satiety, and feeding arousal
 *  - Lateral Accessory Lobe (LAL): Premotor flip-flop zigzagging cast-and-surge maneuvers
 *  - Ventral Nerve Cord CPG (VNC): Thoracic central pattern generator gait velocity & motor torque
 *  - Johnston's Organ AMMC: Antennal mechanosensory, acoustic chirp & vibration peer communication
 *  - Inter-Brain Commissures: 11x11x4 cross-brain synthetic synaptic projections
 *  - Dual Grafted Multi-Agent Graph: Coordinated Harvester & Sentinel-Pioneer agents
 *  - Stagnation / Stasis Inactivity Hazard: Dwell-time penalty forcing kinetic exploration
 *  - Resumable State: Complete JSON serialization/deserialization with localStorage and file export
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.FlyBrainEngine = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
  }

  function softmax(arr, temperature = 1.0) {
    const max = Math.max(...arr);
    const exp = arr.map(v => Math.exp(clamp((v - max) / temperature, -20, 20)));
    const sum = exp.reduce((a, b) => a + b, 0) || 1e-6;
    return exp.map(v => v / sum);
  }

  /** Shortest signed angular difference, in (-pi, pi]. */
  function angleDelta(a, b) {
    let d = (a - b) % (2 * Math.PI);
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d <= -Math.PI) d += 2 * Math.PI;
    return d;
  }

  function wrapAngle(a) {
    const t = a % (2 * Math.PI);
    return t < 0 ? t + 2 * Math.PI : t;
  }

  /**
   * What each neuropil's descending vote is for. Used only by the gated
   * consensus: escape circuits, goal-directed circuits and exploratory
   * circuits should not all speak at once with the same authority.
   */
  const DESCENDING_GROUPS = Object.freeze({
    sentinel: "reflex",   // Lateral Horn threat reflex and giant fibre escape
    smp: "reflex",        // action commitment during an escape
    forager: "goal",      // appetitive odour gradient
    navigator: "goal",    // compass heading toward the goal
    executive: "goal",    // Fan-Shaped Body goal vector
    metabolic: "goal",    // sugar drive
    optic: "goal",        // visual pursuit of the gradient
    pioneer: "explore",   // novelty
    lal: "explore",       // cast-and-surge zigzag search
    aotu: "explore",      // celestial straight-line dispersal
    eb: "explore",        // landmark-anchored forward momentum
    pb: "explore",        // bilateral steering jitter
    vault: "support",     // memory readout
    vnc_cpg: "support",   // gait rhythm
    ammc: "support",      // peer spacing
    no: "support"         // odometry and homing
  });

  /**
   * Mechanism selection. Each option names a circuit model; the "legacy" values
   * reproduce the behaviour of earlier versions so that an upgrade can be
   * measured against it rather than merely asserted.
   *
   * compass:     "attractor" - recurrent E-PG/P-EN ring attractor in the CX,
   *                            heading persists in population activity and is
   *                            integrated from angular velocity, with the drift
   *                            that implies.
   *              "kinematic" - legacy: the caller's angular velocity is added
   *                            to a scalar, so when the caller derives it from
   *                            the true travel direction the network is simply
   *                            handed its heading, exactly and without drift.
   *                            Useful as an upper bound; it is not a model of
   *                            anything, and it scores better for that reason.
   * mbInhibition:"apl"       - APL pools Kenyon-cell output and feeds back
   *                            divisive plus subtractive inhibition, so
   *                            sparseness emerges from gain control.
   *              "topk"      - legacy: hard top-15% selection by sorting.
   * plasticity:  "dan-ltd"   - dopamine-gated depression of coincidently active
   *                            KC->MBON synapses, with slow recovery.
   *              "hebbian"   - legacy: symmetric potentiation and depression on
   *                            a net modulation term.
   * consensus:   "gated"     - the descending vote is re-weighted by the fly's
   *                            state, so threat, an appetitive gradient or
   *                            neither each hand the motor pathway to a
   *                            different set of neuropils.
   *              "flat"      - legacy: one fixed weight per role, always.
   */
  const DEFAULT_CONFIG = Object.freeze({
    compass: "attractor",
    mbInhibition: "apl",
    plasticity: "dan-ltd",
    consensus: "gated",
    // The APL loop has no set point: sparseness is whatever this gain and the
    // current input produce. kcTargetSparsity records the design target the
    // gains were calibrated against (Kenyon-cell responses are reported in the
    // few-percent to ~20% range) and is not enforced.
    kcTargetSparsity: 0.1,
    aplFeedbackGain: 3.4,
    aplDivisiveGain: 2.6,
    aplSubtractiveGain: 0.55,
    ringExcitation: 1.6,
    ringInhibition: 0.55,
    ringSigma: 0.62,
    ringRate: 0.9,
    // Calibrated so decoded heading tracks integrated angular velocity with
    // gain 0.99-1.01 over +/-0.4 rad per tick; relaxation at ringRate would
    // otherwise leave the bump lagging by that factor.
    ringShiftGain: 1.1,
    ltdRate: 0.055,
    ltdRecovery: 0.004,
    kcMbonBaseline: 0.25
  });

  const LEGACY_CONFIG = Object.freeze(Object.assign({}, DEFAULT_CONFIG, {
    compass: "kinematic",
    mbInhibition: "topk",
    plasticity: "hebbian",
    consensus: "flat"
  }));

  function resolveConfig(overrides) {
    if (overrides === "legacy") return Object.assign({}, LEGACY_CONFIG);
    if (overrides === "default" || !overrides) return Object.assign({}, DEFAULT_CONFIG);
    const base = overrides.preset === "legacy" ? LEGACY_CONFIG : DEFAULT_CONFIG;
    const merged = Object.assign({}, base, overrides);
    delete merged.preset;
    return merged;
  }

  // -------------------------------------------------------------
  // Deterministic PRNG: Mulberry32
  // -------------------------------------------------------------
  class MulberryPRNG {
    constructor(seed = 42) {
      this.initialSeed = typeof seed === "string" ? this._hashString(seed) : (seed >>> 0);
      this.state = this.initialSeed;
      this.drawCount = 0;
    }

    _hashString(str) {
      let hash = 1779033703 ^ str.length;
      for (let i = 0; i < str.length; i++) {
        hash = Math.imul(hash ^ str.charCodeAt(i), 3432918353);
        hash = (hash << 13) | (hash >>> 19);
      }
      return hash >>> 0;
    }

    next() {
      this.drawCount++;
      let t = (this.state += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    int(max) {
      return Math.floor(this.next() * max);
    }

    /**
     * Capture the full generator state. `state` is the only value that
     * determines future draws; `drawCount` is bookkeeping. Restoring
     * `drawCount` alone leaves the stream where it started, so both are
     * required for an exact resume.
     */
    getState() {
      return { initialSeed: this.initialSeed, state: this.state, drawCount: this.drawCount };
    }

    setState(snapshot) {
      if (!snapshot || typeof snapshot !== "object") return this;
      if (Number.isFinite(snapshot.initialSeed)) this.initialSeed = snapshot.initialSeed >>> 0;
      if (Number.isFinite(snapshot.state)) this.state = snapshot.state >>> 0;
      if (Number.isFinite(snapshot.drawCount)) this.drawCount = snapshot.drawCount;
      return this;
    }

    /** Fork an independent stream so a subsystem cannot perturb the caller's draws. */
    fork(salt = 0) {
      const child = new MulberryPRNG(0);
      child.initialSeed = (this.initialSeed ^ Math.imul(salt + 1, 0x9e3779b9)) >>> 0;
      child.state = child.initialSeed;
      return child;
    }
  }

  // -------------------------------------------------------------
  // Dynamic 2D Chemical & Pheromone Layer (Odor Plumes & Scent Trails)
  // -------------------------------------------------------------
  class ChemicalFieldGrid {
    /**
     * @param {number} width
     * @param {number} height
     */
    constructor(width = 20, height = 20) {
      this.width = width;
      this.height = height;
      const size = width * height;
      this.foodOdor = new Float32Array(size);
      this.threatOdor = new Float32Array(size);
      this.foragerTrail = new Float32Array(size);
      this.sentinelTrail = new Float32Array(size);
      this.customPheromone = new Float32Array(size);
    }

    _idx(x, y) {
      const cx = Math.max(0, Math.min(this.width - 1, Math.floor(x)));
      const cy = Math.max(0, Math.min(this.height - 1, Math.floor(y)));
      return cy * this.width + cx;
    }

    emit(channel, x, y, amount) {
      if (!this[channel]) return;
      const idx = this._idx(x, y);
      this[channel][idx] = Math.min(3.0, this[channel][idx] + amount);
    }

    sample(channel, x, y) {
      if (!this[channel]) return 0;
      const x0 = Math.max(0, Math.min(this.width - 1, Math.floor(x)));
      const y0 = Math.max(0, Math.min(this.height - 1, Math.floor(y)));
      const x1 = Math.min(this.width - 1, x0 + 1);
      const y1 = Math.min(this.height - 1, y0 + 1);
      const fx = x - x0;
      const fy = y - y0;

      const arr = this[channel];
      const top = arr[y0 * this.width + x0] * (1 - fx) + arr[y0 * this.width + x1] * fx;
      const bottom = arr[y1 * this.width + x0] * (1 - fx) + arr[y1 * this.width + x1] * fx;
      return top * (1 - fy) + bottom * fy;
    }

    /**
     * Bilateral antennal sampling: evaluates odor concentration at left and right antenna
     * @param {string} channel
     * @param {number} x
     * @param {number} y
     * @param {number} heading
     * @param {number} antennaDist
     */
    sampleBilateral(channel, x, y, heading = 0, antennaDist = 0.8) {
      const leftAngle = heading - Math.PI / 2;
      const rightAngle = heading + Math.PI / 2;
      const lx = x + Math.cos(leftAngle) * antennaDist;
      const ly = y + Math.sin(leftAngle) * antennaDist;
      const rx = x + Math.cos(rightAngle) * antennaDist;
      const ry = y + Math.sin(rightAngle) * antennaDist;

      const left = this.sample(channel, lx, ly);
      const right = this.sample(channel, rx, ry);
      return { left, right, diff: left - right };
    }

    step(diffusionRate = 0.15, decayRate = 0.95) {
      this._diffuseChannel(this.foodOdor, diffusionRate, decayRate);
      this._diffuseChannel(this.threatOdor, diffusionRate, decayRate);
      this._diffuseChannel(this.foragerTrail, diffusionRate, 0.93);
      this._diffuseChannel(this.sentinelTrail, diffusionRate, 0.93);
      this._diffuseChannel(this.customPheromone, diffusionRate, 0.96);
    }

    _diffuseChannel(grid, diffRate, decay) {
      const w = this.width;
      const h = this.height;
      const next = new Float32Array(grid.length);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          let sumNeighbors = 0;
          let numNeighbors = 0;

          if (x > 0) { sumNeighbors += grid[i - 1]; numNeighbors++; }
          if (x < w - 1) { sumNeighbors += grid[i + 1]; numNeighbors++; }
          if (y > 0) { sumNeighbors += grid[i - w]; numNeighbors++; }
          if (y < h - 1) { sumNeighbors += grid[i + w]; numNeighbors++; }

          const laplacian = (sumNeighbors / numNeighbors) - grid[i];
          const val = (grid[i] + diffRate * laplacian) * decay;
          next[i] = val > 0.001 ? val : 0;
        }
      }
      grid.set(next);
    }

    clear() {
      this.foodOdor.fill(0);
      this.threatOdor.fill(0);
      this.foragerTrail.fill(0);
      this.sentinelTrail.fill(0);
      this.customPheromone.fill(0);
    }
  }

  // -------------------------------------------------------------
  // Simulated Drosophila Single Brain Subsystem (11 Specialized Roles)
  // -------------------------------------------------------------
  class DrosophilaBrain {
    /**
     * @param {number} id - Brain ID (0 to 10)
     * @param {string} role - Specialized computational role
     */
    constructor(id, role = "general", config = null) {
      this.id = id;
      this.role = role;
      this.config = resolveConfig(config);

      // Neuropil dimensions
      this.GLOMERULI_COUNT = 14;
      this.KC_BASE_COUNT = 32;
      this.MBON_COUNT = 4;
      this.COMPASS_COUNT = 8;

      // Activations
      this.alProjection = new Float32Array(this.GLOMERULI_COUNT);
      this.kcActivations = new Float32Array(this.KC_BASE_COUNT);
      this.mbonActivations = new Float32Array(this.MBON_COUNT);
      this.compassRing = new Float32Array(this.COMPASS_COUNT);
      this.compassHeading = 0;

      // E-PG ring attractor state (Central Complex compass). Unlike compassRing,
      // which is only a readout, this is the recurrent activity that carries
      // heading between ticks.
      this.epgRing = new Float32Array(this.COMPASS_COUNT);
      this.epgRing[0] = 1.0;
      this.ringAmplitude = 1.0;
      this.ringCertainty = 1.0;

      // Mushroom-body gain control readouts
      this.aplActivity = 0;
      this.kcSparsity = 0;
      this.lastActionIndex = -1;

      // Brain 5: Optic Lobe motion flow
      this.opticMotionFlow = new Float32Array(4);
      this.lastVisualSensors = [0, 0, 0, 0];

      // Brain 6: Executive FB target vector
      this.targetVector = { x: 0, y: 0, distance: 0, heading: 0, active: false };

      // Brain 7: SEZ Metabolic registers
      this.metabolicSatiety = 1.0;
      this.sugarDrive = 0.5;
      this.bitterAversion = 0.0;
      this.neuropeptideNPF = 0.0;
      this.neuropeptideSIFamide = 0.0;

      // Brain 8: Lateral Accessory Lobe (LAL) Flip-Flop state
      this.lalFlipFlop = 0; // -1 (left cast), 1 (right cast)
      this.lalTimer = 0;

      // Brain 9: Ventral Nerve Cord (VNC) CPG Gait Phase
      this.vncGaitPhase = 0;
      this.vncTorque = 1.0;

      // Brain 10: Johnston's Organ AMMC Mechanosensory & Peer Acoustic Signals
      this.ammcVibration = 0.0;
      this.ammcPeerAcoustic = [0, 0]; // dx, dy to peer agent

      // Brain 11: Protocerebral Bridge (PB) Bilateral Phase Shift Steering
      this.pbPhaseShift = 0.0;

      // Brain 12: Ellipsoid Body (EB) Toroid Landmark Ring
      this.ebRingAttractor = new Float32Array(8);
      this.ebStabilization = 0.0;

      // Brain 13: Noduli (NO) Odometry & Path Integration
      this.noOdometryDistance = 0.0;
      this.noHomeVector = [0, 0];
      this.homeHeading = 0.0;

      // Brain 14: Anterior Optic Tubercle (AOTU) Celestial Sun Compass
      this.aotuSunHeading = 0.0;
      this.aotuEVectorAlignment = 0.0;

      // Brain 15: Superior Medial Protocerebrum (SMP) Action Commitment Latch
      this.smpLatchedAction = -1;
      this.smpLatchTimer = 0;

      // Tri-Neuromodulatory signaling:
      this.dopaminePAM = 0.0;
      this.dopaminePPL1 = 0.0;
      this.octopamineOA = 0.2;
      this.serotonin5HT = 0.5;
      this.pdfArousal = 1.0; // Circadian Pigment-Dispersing Factor motor vigor scaling

      // Giant Fiber (GF) Looming-Stimulus Escape System
      this.giantFiberTriggered = false;
      this.lastHazardSense = 0.0;
      this.loomingVelocity = 0.0;

      // Drosophila Neuropeptides: NPF (Hunger Risk-Seeking) & SIFamide (Satiety Social/Calm)
      this.neuropeptideNPF = 0.0;
      this.neuropeptideSIFamide = 0.0;

      // Dynamic Neurogenesis Pool (born Kenyon Cells)
      this.bornNeurons = [];

      // Synaptic weight matrices:
      this.alToKcWeights = this._initSparseAlKcWeights(this.KC_BASE_COUNT);
      this.kcToMbonWeights = this._initKcMbonWeights(this.KC_BASE_COUNT);
      this.eligibilityTraces = new Float32Array(this.KC_BASE_COUNT * this.MBON_COUNT);
      this.descendingOutputs = new Float32Array(4);
    }

    /**
     * Registers that belong to one individual fly rather than to the shared
     * connectome: heading, gait phase, metabolic titres, latches, activations.
     * Learned synaptic weights are deliberately absent -- those are shared.
     */
    static EGO_SCALARS = [
      "compassHeading", "lalFlipFlop", "lalTimer", "vncGaitPhase", "vncTorque",
      "ammcVibration", "pbPhaseShift", "ebStabilization",
      "noOdometryDistance", "homeHeading", "aotuSunHeading", "aotuEVectorAlignment",
      "smpLatchedAction", "smpLatchTimer",
      "metabolicSatiety", "sugarDrive", "bitterAversion",
      "neuropeptideNPF", "neuropeptideSIFamide",
      "dopaminePAM", "dopaminePPL1", "octopamineOA", "serotonin5HT", "pdfArousal",
      "lastHazardSense", "loomingVelocity", "giantFiberTriggered",
      "ringAmplitude", "ringCertainty", "aplActivity", "kcSparsity", "lastActionIndex"
    ];

    static EGO_ARRAYS = [
      "alProjection", "kcActivations", "mbonActivations", "compassRing",
      "opticMotionFlow", "ebRingAttractor", "descendingOutputs", "epgRing"
    ];

    /** Copy this brain's per-individual registers into a reusable container. */
    captureEgo(into = null) {
      const ego = into || { scalars: Object.create(null), arrays: Object.create(null), born: null };
      for (const key of DrosophilaBrain.EGO_SCALARS) ego.scalars[key] = this[key];
      for (const key of DrosophilaBrain.EGO_ARRAYS) {
        const src = this[key];
        if (!src) continue;
        let dst = ego.arrays[key];
        if (!dst || dst.length !== src.length) dst = ego.arrays[key] = new Float32Array(src.length);
        dst.set(src);
      }
      // These three live as plain arrays on the brain, so copy them into reused
      // buffers rather than allocating three per brain on every forward pass.
      for (const [key, source] of [
        ["lastVisualSensors", this.lastVisualSensors],
        ["ammcPeerAcoustic", this.ammcPeerAcoustic],
        ["noHomeVector", this.noHomeVector]
      ]) {
        let buffer = ego.arrays[key];
        if (!buffer || buffer.length !== source.length) buffer = ego.arrays[key] = new Float32Array(source.length);
        for (let i = 0; i < source.length; i++) buffer[i] = source[i];
      }
      const born = ego.born && ego.born.length === this.bornNeurons.length
        ? ego.born
        : new Float32Array(this.bornNeurons.length);
      for (let i = 0; i < this.bornNeurons.length; i++) born[i] = this.bornNeurons[i].activation;
      ego.born = born;
      return ego;
    }

    /** Load per-individual registers previously captured by captureEgo. */
    restoreEgo(ego) {
      if (!ego) return;
      for (const key of DrosophilaBrain.EGO_SCALARS) {
        if (ego.scalars[key] !== undefined) this[key] = ego.scalars[key];
      }
      for (const key of DrosophilaBrain.EGO_ARRAYS) {
        const src = ego.arrays[key];
        if (src && this[key] && this[key].length === src.length) this[key].set(src);
      }
      // Written in place: these are read every forward pass and loadEgo runs
      // several times a tick, so reallocating them is pure churn.
      for (const [key, target] of [
        ["lastVisualSensors", this.lastVisualSensors],
        ["ammcPeerAcoustic", this.ammcPeerAcoustic],
        ["noHomeVector", this.noHomeVector]
      ]) {
        const source = ego.arrays[key];
        if (!source) continue;
        const n = Math.min(source.length, target.length);
        for (let i = 0; i < n; i++) target[i] = source[i];
      }
      // Neurons grown since this record was captured hold the previous fly's
      // activity; a record that does not mention a neuron means it was silent,
      // not that whatever is there should carry over.
      const stored = ego.born ? ego.born.length : 0;
      for (let i = 0; i < this.bornNeurons.length; i++) {
        this.bornNeurons[i].activation = i < stored ? ego.born[i] : 0;
      }
    }

    /**
     * One update of the E-PG ring attractor.
     *
     * Local recurrent excitation sustains a single activity bump; pooled
     * inhibition keeps exactly one bump alive; and an angular-velocity input
     * shifts it, which is the P-EN contribution. Heading is then read out as
     * the population vector average, so it is held by the network rather than
     * supplied by the caller.
     *
     * @param {number} angularVelocity - radians per tick
     * @param {number} [anchorHeading] - external reference (landmark or sun)
     * @param {number} [anchorGain] - how strongly the anchor pins the bump
     */
    updateRingAttractor(angularVelocity = 0, anchorHeading = null, anchorGain = 0) {
      const n = this.COMPASS_COUNT;
      const cfg = this.config;
      const ring = this.epgRing;

      let pooled = 0;
      for (let i = 0; i < n; i++) pooled += ring[i];
      const inhibition = (cfg.ringInhibition * pooled) / n;

      // P-EN shift, as a rotation of the recurrent kernel rather than a
      // finite-difference nudge. E-PG cells excite P-EN cells that project back
      // one wedge over, in the direction the fly is turning, so the bump moves
      // by the angular velocity itself: the integrator has unit gain by
      // construction instead of needing a tuned coefficient.
      //
      // The rotation is clamped just inside a half turn. Beyond that the wrap
      // is genuinely ambiguous -- a turn of exactly pi is as much left as right
      // -- and letting it wrap silently reverses the compass, which grid worlds
      // hit constantly because a direction reversal is exactly pi.
      const limit = Math.PI - 1e-6;
      const shift = clamp(cfg.ringShiftGain * angleDelta(angularVelocity, 0), -limit, limit);
      const sigma = cfg.ringSigma;
      const twoSigmaSq = 2 * sigma * sigma;

      // The kernel depends only on the wedge separation, so one row of n
      // weights serves every wedge and the mass is the same for all of them.
      const kernel = this._ringKernel(n, shift, twoSigmaSq);
      let kernelSum = 0;
      for (let d = 0; d < n; d++) kernelSum += kernel[d];

      const next = this._ringScratch && this._ringScratch.length === n
        ? this._ringScratch
        : (this._ringScratch = new Float32Array(n));
      for (let i = 0; i < n; i++) {
        let acc = 0;
        for (let j = 0; j < n; j++) acc += kernel[(i - j + n) % n] * ring[j];
        // Normalising by the kernel mass keeps the recurrent term on the same
        // scale as the activity it drives, so the wedge lattice cannot pin the
        // bump and the integrator keeps unit gain.
        const recurrent = kernelSum > 0 ? acc / kernelSum : 0;

        let drive = cfg.ringExcitation * recurrent - inhibition;

        if (anchorHeading !== null && anchorGain > 0) {
          const d = angleDelta((i / n) * 2 * Math.PI, anchorHeading);
          drive += anchorGain * Math.exp(-(d * d) / twoSigmaSq);
        }

        // Activity relaxes toward the network drive at ringRate; this is the
        // membrane time constant of the standard continuous-attractor model.
        next[i] = Math.max(0, ring[i] + cfg.ringRate * (drive - ring[i]));
      }

      let total = 0;
      for (let i = 0; i < n; i++) total += next[i];
      if (total < 1e-6) {
        next.fill(0);
        // The bump died; re-seed it at the last decoded heading rather than
        // silently reporting an all-zero compass.
        const seed = Math.round((this.compassHeading / (2 * Math.PI)) * n) % n;
        next[(seed + n) % n] = 1.0;
        total = 1.0;
      }
      // Normalising keeps total activity bounded without capping any wedge.
      for (let i = 0; i < n; i++) ring[i] = next[i] / total;

      let sx = 0;
      let sy = 0;
      for (let i = 0; i < n; i++) {
        const prefAngle = (i / n) * 2 * Math.PI;
        sx += ring[i] * Math.cos(prefAngle);
        sy += ring[i] * Math.sin(prefAngle);
      }
      this.ringAmplitude = Math.hypot(sx, sy);
      // Population vector length: 1 for a single sharp wedge, 0 for a flat ring.
      this.ringCertainty = clamp(this.ringAmplitude, 0, 1);
      this.compassHeading = wrapAngle(Math.atan2(sy, sx));
      return this.compassHeading;
    }

    /** One row of the rotated excitation kernel, indexed by wedge separation. */
    _ringKernel(n, shift, twoSigmaSq) {
      let kernel = this._ringKernelBuffer;
      if (!kernel || kernel.length !== n) kernel = this._ringKernelBuffer = new Float32Array(n);
      const step = (2 * Math.PI) / n;
      for (let d = 0; d < n; d++) {
        const separation = angleDelta(d * step - shift, 0);
        kernel[d] = Math.exp(-(separation * separation) / twoSigmaSq);
      }
      return kernel;
    }

    /**
     * APL feedback inhibition over the Kenyon-cell population.
     *
     * The APL neuron pools Kenyon-cell output and inhibits the whole
     * population, both divisively and subtractively. Sparseness therefore
     * emerges from the strength of the input instead of being pinned to a fixed
     * fraction, and a few fixed-point iterations settle the loop in O(cells).
     *
     * @param {Array<{isBorn:boolean,idx:number,val:number}>} pool
     * @returns {number} the settled APL activity
     */
    _settleApl(pool) {
      if (!pool.length) return 0;
      const cfg = this.config;
      const n = pool.length;
      const relax = 0.6;
      let apl = 0;
      // Damped iteration. Solving the loop undamped overshoots and then
      // collapses to zero inhibition on alternating passes, which is how a
      // feedback circuit with too much loop gain misbehaves in simulation as
      // well as in a cell.
      for (let iteration = 0; iteration < 8; iteration++) {
        let sum = 0;
        for (let i = 0; i < n; i++) {
          const v = pool[i].val / (1 + cfg.aplDivisiveGain * apl) - cfg.aplSubtractiveGain * apl;
          if (v > 0) sum += v;
        }
        const target = cfg.aplFeedbackGain * (sum / n);
        apl += relax * (target - apl);
        if (apl < 0) apl = 0;
      }
      return apl;
    }

    _initSparseAlKcWeights(kcCount) {
      const weights = new Float32Array(this.GLOMERULI_COUNT * kcCount);
      for (let k = 0; k < kcCount; k++) {
        const numInputs = 3 + (k % 2);
        for (let i = 0; i < numInputs; i++) {
          const g = (k * 3 + i * 5 + this.id) % this.GLOMERULI_COUNT;
          weights[k * this.GLOMERULI_COUNT + g] = 0.4 + 0.2 * ((k + i) % 3);
        }
      }
      return weights;
    }

    _initKcMbonWeights(kcCount) {
      const w = new Float32Array(kcCount * this.MBON_COUNT);
      for (let i = 0; i < w.length; i++) {
        w[i] = 0.25;
      }
      return w;
    }

    forward(sensoryInput, headingDelta = 0, executiveContext = null, peerContext = null) {
      // 1. Antennal Lobe (AL) Divisive Normalization
      let meanSensory = 0;
      for (let i = 0; i < this.GLOMERULI_COUNT; i++) {
        const val = sensoryInput[i] || 0;
        this.alProjection[i] = Math.max(0, val);
        meanSensory += this.alProjection[i];
      }
      meanSensory /= this.GLOMERULI_COUNT;

      for (let i = 0; i < this.GLOMERULI_COUNT; i++) {
        this.alProjection[i] = this.alProjection[i] / (0.2 + meanSensory);
      }

      // Brain 5: Optic Lobe Motion Flow
      if (this.role === "optic") {
        const visualSensors = sensoryInput.slice(6, 10);
        for (let v = 0; v < 4; v++) {
          const delta = visualSensors[v] - this.lastVisualSensors[v];
          this.opticMotionFlow[v] = 0.6 * this.opticMotionFlow[v] + 0.4 * delta;
          this.lastVisualSensors[v] = visualSensors[v];
        }
      }

      // Brain 6: Executive Fan-Shaped Body Vector Navigation
      if (this.role === "executive" && executiveContext) {
        this.targetVector = executiveContext;
      }

      // Brain 7: SEZ Metabolic Satiety, Taste & Neuropeptides
      if (this.role === "metabolic") {
        const energyNorm = sensoryInput[4] || 0.5;
        this.metabolicSatiety = energyNorm;
        this.sugarDrive = clamp(1.2 - energyNorm, 0.2, 1.8);
        this.bitterAversion = clamp((sensoryInput[3] || 0) * 2.0, 0, 2.0);
        this.octopamineOA = clamp(0.2 + (1.0 - energyNorm) * 0.8, 0.2, 1.0);
        this.serotonin5HT = clamp(energyNorm * 0.9, 0.1, 1.0);

        // Drosophila Neuropeptides: NPF (Hunger Risk-Taking) & SIFamide (Satiety Social/Calm)
        this.neuropeptideNPF = clamp((0.55 - energyNorm) * 2.2, 0, 1.0);
        this.neuropeptideSIFamide = clamp((energyNorm - 0.5) * 2.0, 0, 1.0);
      }

      // Brain 8: Lateral Accessory Lobe (LAL) Bistable Flip-Flop
      if (this.role === "lal") {
        this.lalTimer++;
        if (this.lalTimer > 3) {
          this.lalTimer = 0;
          this.lalFlipFlop = this.lalFlipFlop <= 0 ? 1 : -1;
        }
      }

      // Brain 9: Ventral Nerve Cord (VNC) CPG Gait Stride
      if (this.role === "vnc_cpg") {
        this.vncGaitPhase = (this.vncGaitPhase + 0.25) % (Math.PI * 2);
        this.vncTorque = 0.85 + 0.3 * Math.sin(this.vncGaitPhase);
      }

      // Brain 10: Johnston's Organ AMMC (Peer Acoustic & Tactile Signals)
      if (this.role === "ammc" && peerContext) {
        this.ammcPeerAcoustic = [peerContext.dx, peerContext.dy];
        this.ammcVibration = clamp(1.0 / (peerContext.dist + 0.1), 0, 2.0);
      }

      // Brain 11: Protocerebral Bridge (PB) Bilateral Phase Shift Steering
      if (this.role === "pb") {
        this.pbPhaseShift = Math.sin(this.compassHeading * 2);
      }

      // Brain 12: Ellipsoid Body (EB) Landmark Stabilization
      if (this.role === "eb") {
        for (let r = 0; r < 8; r++) {
          this.ebRingAttractor[r] = Math.cos(this.compassHeading - (r * Math.PI / 4));
        }
        this.ebStabilization = (this.ebRingAttractor[0] + this.ebRingAttractor[2]) * 0.5;
      }

      // Brain 13: Noduli (NO) Odometry & Path Integration
      if (this.role === "no" && peerContext) {
        const sDx = peerContext.stepDx || 0;
        const sDy = peerContext.stepDy || 0;
        const stepDist = Math.hypot(sDx, sDy);
        this.noOdometryDistance += stepDist;
        this.noHomeVector[0] += sDx;
        this.noHomeVector[1] += sDy;
        this.homeHeading = Math.atan2(-this.noHomeVector[1], -this.noHomeVector[0]);
      }

      // Brain 14: Anterior Optic Tubercle (AOTU) Celestial Sun Compass
      if (this.role === "aotu" && peerContext && peerContext.sunAngle !== undefined) {
        this.aotuSunHeading = peerContext.sunAngle;
        let sunDiff = Math.abs(this.compassHeading - this.aotuSunHeading);
        if (sunDiff > Math.PI) sunDiff = 2 * Math.PI - sunDiff;
        this.aotuEVectorAlignment = Math.cos(sunDiff);
      }

      // Brain 15: Superior Medial Protocerebrum (SMP) Action Commitment Latch
      if (this.role === "smp") {
        if (this.smpLatchTimer > 0) {
          this.smpLatchTimer--;
        }
      }

      // 2. Mushroom Body Kenyon Cells Sparse Coding
      for (let k = 0; k < this.KC_BASE_COUNT; k++) {
        let sum = 0;
        const offset = k * this.GLOMERULI_COUNT;
        for (let g = 0; g < this.GLOMERULI_COUNT; g++) {
          sum += this.alProjection[g] * this.alToKcWeights[offset + g];
        }
        this.kcActivations[k] = sum;
      }

      for (let b = 0; b < this.bornNeurons.length; b++) {
        const neuron = this.bornNeurons[b];
        let sum = 0;
        for (let g = 0; g < this.GLOMERULI_COUNT; g++) {
          sum += this.alProjection[g] * neuron.weights[g];
        }
        neuron.activation = sum;
      }

      const allKc = [];
      for (let k = 0; k < this.KC_BASE_COUNT; k++) {
        allKc.push({ isBorn: false, idx: k, val: this.kcActivations[k] });
      }
      for (let b = 0; b < this.bornNeurons.length; b++) {
        allKc.push({ isBorn: true, idx: b, val: this.bornNeurons[b].activation });
      }

      let activeCount = 0;
      if (this.config.mbInhibition === "apl") {
        const apl = this._settleApl(allKc);
        this.aplActivity = apl;
        for (let i = 0; i < allKc.length; i++) {
          const item = allKc[i];
          const inhibited = item.val / (1 + this.config.aplDivisiveGain * apl)
            - this.config.aplSubtractiveGain * apl;
          const actVal = inhibited > 0 ? clamp(inhibited, 0, 1) : 0.0;
          if (actVal > 0) activeCount++;
          if (!item.isBorn) {
            this.kcActivations[item.idx] = actVal;
          } else {
            this.bornNeurons[item.idx].activation = actVal;
          }
        }
      } else {
        allKc.sort((a, b) => b.val - a.val);
        const topK = Math.max(2, Math.floor(allKc.length * 0.15));
        for (let i = 0; i < allKc.length; i++) {
          const item = allKc[i];
          const actVal = i < topK ? clamp(item.val, 0, 1) : 0.0;
          if (actVal > 0) activeCount++;
          if (!item.isBorn) {
            this.kcActivations[item.idx] = actVal;
          } else {
            this.bornNeurons[item.idx].activation = actVal;
          }
        }
        this.aplActivity = 0;
      }
      this.kcSparsity = allKc.length > 0 ? activeCount / allKc.length : 0;

      // 3. MBON Readout
      for (let m = 0; m < this.MBON_COUNT; m++) {
        let sum = 0;
        for (let k = 0; k < this.KC_BASE_COUNT; k++) {
          sum += this.kcActivations[k] * this.kcToMbonWeights[k * this.MBON_COUNT + m];
        }
        for (let b = 0; b < this.bornNeurons.length; b++) {
          const neuron = this.bornNeurons[b];
          sum += neuron.activation * neuron.mbonWeights[m];
        }
        this.mbonActivations[m] = clamp(sum, 0, 2);
      }

      // 4. Central Complex compass.
      //
      // In attractor mode the navigator brain holds the only true compass: a
      // recurrent E-PG ring that integrates angular velocity and is anchored,
      // weakly, to the celestial reference. Other neuropils receive the decoded
      // heading by commissural broadcast, one tick behind, and only draw their
      // readout from it. In kinematic (legacy) mode every brain integrates the
      // same scalar independently and the ring is decorative.
      if (this.config.compass === "attractor" && this.role === "navigator") {
        // An anchor stabilises a compass only if it points somewhere fixed in
        // the world. peerContext.skyReference is that fixed azimuth; the older
        // sunAngle sweeps a full circle every circadian period, so using it
        // drags the bump around with the clock rather than pinning it.
        const anchor = peerContext && Number.isFinite(peerContext.skyReference)
          ? peerContext.skyReference
          : null;
        this.updateRingAttractor(headingDelta, anchor, anchor === null ? 0 : 0.045);
        this.compassRing.set(this.epgRing);
      } else {
        if (this.config.compass !== "attractor") {
          this.compassHeading = (this.compassHeading + headingDelta + 2 * Math.PI) % (2 * Math.PI);
        }
        for (let c = 0; c < this.COMPASS_COUNT; c++) {
          const prefAngle = (c / this.COMPASS_COUNT) * 2 * Math.PI;
          let diff = Math.abs(this.compassHeading - prefAngle);
          if (diff > Math.PI) diff = 2 * Math.PI - diff;
          this.compassRing[c] = Math.exp(-((diff * diff) / (2 * 0.4 * 0.4)));
        }
      }

      // 5. Lateral Horn Innate Avoidance, Giant Fiber (GF) Looming Reflex & Action Geometry
      const actionAngles = [-Math.PI / 2, Math.PI / 2, Math.PI, 0];
      const hazardSense = sensoryInput[3] || 0;
      const hazardAngle = Math.atan2(sensoryInput[8] || 0, sensoryInput[9] || 0);

      // Giant Fiber looming detection (rapid looming expansion or imminent hazard proximity)
      this.loomingVelocity = hazardSense - this.lastHazardSense;
      this.lastHazardSense = hazardSense;
      this.giantFiberTriggered = hazardSense > 0.65 || (hazardSense > 0.35 && this.loomingVelocity > 0.25);
      if (this.giantFiberTriggered) {
        this.smpLatchedAction = -1;
        this.smpLatchTimer = 0;
      }

      // 6. Descending Motor Output Synthesis
      for (let a = 0; a < 4; a++) {
        let diffHeading = Math.abs(this.compassHeading - actionAngles[a]);
        if (diffHeading > Math.PI) diffHeading = 2 * Math.PI - diffHeading;
        const compassBias = 0.25 * Math.cos(diffHeading);

        let mbonDrive = this.mbonActivations[a] || 0;

        let diffHaz = Math.abs(hazardAngle - actionAngles[a]);
        if (diffHaz > Math.PI) diffHaz = 2 * Math.PI - diffHaz;
        const hazAlign = Math.max(0, Math.cos(diffHaz));
        const innateAvoidance = hazardSense * 1.5 * hazAlign;

        // Giant Fiber emergency escape override: explosive drive directly opposite to threat
        if (this.giantFiberTriggered) {
          const escapeAngle = (hazardAngle + Math.PI) % (2 * Math.PI);
          let diffEsc = Math.abs(escapeAngle - actionAngles[a]);
          if (diffEsc > Math.PI) diffEsc = 2 * Math.PI - diffEsc;
          mbonDrive += Math.max(0, Math.cos(diffEsc)) * 3.0;
        }

        if (this.role === "optic") {
          mbonDrive += Math.max(0, this.opticMotionFlow[a]) * 0.8;
        }

        if (this.role === "executive" && this.targetVector && this.targetVector.active) {
          let angleDiff = Math.abs(this.targetVector.heading - actionAngles[a]);
          if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
          const vectorAlignment = Math.max(0, Math.cos(angleDiff));
          mbonDrive += vectorAlignment * 1.8;
        }

        if (this.role === "forager" || this.role === "navigator" || this.role === "metabolic") {
          const leftOdor = sensoryInput[12] || 0;
          const rightOdor = sensoryInput[13] || 0;
          const odorDiff = leftOdor - rightOdor;
          // Bilateral tropotaxis: steer left (a=2) or right (a=3) toward odor gradient
          if (a === 2 && odorDiff > 0.04) mbonDrive += clamp(odorDiff * 1.6, 0, 1.2);
          if (a === 3 && odorDiff < -0.04) mbonDrive += clamp(-odorDiff * 1.6, 0, 1.2);

          // Direct appetitive diamond scent attraction along diamond angle vector
          const diamondSense = sensoryInput[2] || 0;
          if (diamondSense > 0.02) {
            const diamondAngle = Math.atan2(sensoryInput[6] || 0, sensoryInput[7] || 0);
            let diffD = Math.abs(diamondAngle - actionAngles[a]);
            if (diffD > Math.PI) diffD = 2 * Math.PI - diffD;
            mbonDrive += Math.max(0, Math.cos(diffD)) * clamp(diamondSense * 2.2, 0, 2.0);
          }
        }

        if (this.role === "metabolic") {
          mbonDrive *= this.sugarDrive;
        }

        if (this.role === "lal") {
          // LAL bistable turn casting: alternates left (index 2) vs right (index 3) bias
          if (a === 2 && this.lalFlipFlop < 0) mbonDrive += 0.9;
          if (a === 3 && this.lalFlipFlop > 0) mbonDrive += 0.9;
        }

        if (this.role === "vnc_cpg") {
          mbonDrive *= this.vncTorque;
        }

        if (this.role === "ammc" && peerContext) {
          // AMMC peer alignment: gentle attraction/repulsion
          if (peerContext.dist < 2.0) {
            // Repel if too close (prevent collision)
            const repelAngle = Math.atan2(-peerContext.dy, -peerContext.dx);
            let diff = Math.abs(repelAngle - actionAngles[a]);
            if (diff > Math.PI) diff = 2 * Math.PI - diff;
            mbonDrive += Math.max(0, Math.cos(diff)) * 0.7;
          }
        }

        if (this.role === "pb") {
          // Protocerebral Bridge: bilateral phase-shift steering bias
          if (a === 2 && this.pbPhaseShift < 0) mbonDrive += clamp(-this.pbPhaseShift * 0.9, 0, 1.2);
          if (a === 3 && this.pbPhaseShift > 0) mbonDrive += clamp(this.pbPhaseShift * 0.9, 0, 1.2);
        }

        if (this.role === "eb") {
          // Ellipsoid Body: egocentric landmark anchoring and forward momentum
          if (a === 0 || a === 1) mbonDrive += 0.4 * Math.max(0, this.ebStabilization);
        }

        if (this.role === "no") {
          // Noduli translational odometry: homing drive when energy is low
          const normE = sensoryInput[4] || 0.5;
          if (normE < 0.25) {
            let diff = Math.abs(this.homeHeading - actionAngles[a]);
            if (diff > Math.PI) diff = 2 * Math.PI - diff;
            mbonDrive += Math.max(0, Math.cos(diff)) * 1.3;
          }
        }

        if (this.role === "aotu") {
          // Anterior Optic Tubercle: polarized celestial skylight navigation
          mbonDrive += Math.max(0, this.aotuEVectorAlignment) * 0.6;
        }

        if (this.role === "smp") {
          // Superior Medial Protocerebrum: Action commitment latching
          if (this.smpLatchedAction >= 0 && this.smpLatchTimer > 0) {
            if (a === this.smpLatchedAction) mbonDrive += 1.1;
          }
        }

        const vigor = (0.8 + this.octopamineOA * 0.4) * (this.pdfArousal || 1.0);
        this.descendingOutputs[a] = (mbonDrive + compassBias - innateAvoidance) * vigor;
      }

      return this.descendingOutputs;
    }

    applyPlasticity(rewardDelta, hazardDelta) {
      this.dopaminePAM = clamp(rewardDelta, 0, 2);
      this.dopaminePPL1 = clamp(hazardDelta, 0, 2);

      if (this.config.plasticity === "dan-ltd") {
        this._applyDopamineGatedDepression();
        return;
      }

      const netModulation = (this.dopaminePAM * 1.2) - (this.dopaminePPL1 * 1.5);
      const learningRate = 0.05 * (0.8 + this.serotonin5HT * 0.4);
      const decay = 0.001;

      for (let k = 0; k < this.KC_BASE_COUNT; k++) {
        const pre = this.kcActivations[k];
        if (pre < 0.01) continue;

        for (let m = 0; m < this.MBON_COUNT; m++) {
          const post = this.mbonActivations[m];
          const idx = k * this.MBON_COUNT + m;
          this.eligibilityTraces[idx] = 0.8 * this.eligibilityTraces[idx] + pre * post;
          const deltaW = learningRate * this.eligibilityTraces[idx] * netModulation;
          this.kcToMbonWeights[idx] = clamp(this.kcToMbonWeights[idx] + deltaW - decay * this.kcToMbonWeights[idx], 0.01, 2.0);
        }
      }

      for (let b = 0; b < this.bornNeurons.length; b++) {
        const neuron = this.bornNeurons[b];
        const pre = neuron.activation;
        if (pre < 0.01) continue;

        for (let m = 0; m < this.MBON_COUNT; m++) {
          const post = this.mbonActivations[m];
          const deltaW = learningRate * (pre * post) * netModulation;
          neuron.mbonWeights[m] = clamp(neuron.mbonWeights[m] + deltaW - decay * neuron.mbonWeights[m], 0.01, 2.0);
        }
      }
    }

    /**
     * Dopamine-gated, depression-dominant plasticity at KC->MBON synapses.
     *
     * Coincidence of Kenyon-cell activity with dopaminergic input depresses the
     * synapse, which is how olfactory learning is expressed in the mushroom
     * body: the readout is the difference between MBON channels, so weakening
     * one channel strengthens the alternative. Here punishment (PPL1) depresses
     * the channel that was actually taken, and reward (PAM) depresses the
     * channels that were not, with a smaller potentiation of the taken channel
     * for the bidirectional component. Depressed synapses recover slowly toward
     * baseline, which is this model's forgetting term.
     */
    _applyDopamineGatedDepression() {
      const cfg = this.config;
      const rate = cfg.ltdRate * (0.8 + this.serotonin5HT * 0.4);
      const action = this.lastActionIndex;
      const pam = this.dopaminePAM;
      const ppl1 = this.dopaminePPL1;
      const baseline = cfg.kcMbonBaseline;
      const recovery = cfg.ltdRecovery;

      const applyToRow = (pre, readWeight, writeWeight, traceIndex) => {
        for (let m = 0; m < this.MBON_COUNT; m++) {
          const taken = action < 0 || m === action;
          let trace = pre;
          if (traceIndex >= 0) {
            const idx = traceIndex + m;
            this.eligibilityTraces[idx] = 0.8 * this.eligibilityTraces[idx] + pre;
            trace = clamp(this.eligibilityTraces[idx], 0, 4);
          }

          let delta = 0;
          if (ppl1 > 0) delta -= (taken ? ppl1 : ppl1 * 0.25) * rate * trace;
          if (pam > 0) {
            delta -= (taken ? 0 : pam * 0.5) * rate * trace;
            if (taken) delta += pam * rate * 0.45 * trace;
          }

          const current = readWeight(m);
          const recovered = current + recovery * (baseline - current);
          writeWeight(m, clamp(recovered + delta, 0.01, 2.0));
        }
      };

      for (let k = 0; k < this.KC_BASE_COUNT; k++) {
        const pre = this.kcActivations[k];
        if (pre < 0.01) continue;
        const rowBase = k * this.MBON_COUNT;
        applyToRow(
          pre,
          m => this.kcToMbonWeights[rowBase + m],
          (m, v) => { this.kcToMbonWeights[rowBase + m] = v; },
          rowBase
        );
      }

      for (let b = 0; b < this.bornNeurons.length; b++) {
        const neuron = this.bornNeurons[b];
        const pre = neuron.activation;
        if (pre < 0.01) continue;
        applyToRow(pre, m => neuron.mbonWeights[m], (m, v) => { neuron.mbonWeights[m] = v; }, -1);
      }
    }

    applyHomeostaticScaling(targetMean = 0.25) {
      let sumW = 0;
      for (let i = 0; i < this.kcToMbonWeights.length; i++) {
        sumW += this.kcToMbonWeights[i];
      }
      const currentMean = sumW / this.kcToMbonWeights.length;
      if (currentMean > 0.01) {
        const scale = 0.95 * 1.0 + 0.05 * (targetMean / currentMean);
        for (let i = 0; i < this.kcToMbonWeights.length; i++) {
          this.kcToMbonWeights[i] = clamp(this.kcToMbonWeights[i] * scale, 0.01, 2.0);
        }
      }
    }
  }

  // -------------------------------------------------------------
  // Dynamic Algorithmic Neurogenesis Engine
  // -------------------------------------------------------------
  class NeurogenesisEngine {
    /**
     * @param {number} maxBornPerBrain
     * @param {MulberryPRNG} [prng] - seeded stream for birth weights. Supplied by
     *   the syncytium so that two runs from the same world seed grow identical
     *   Kenyon cells; without it the pool would depend on Math.random().
     */
    constructor(maxBornPerBrain = 24, prng = null) {
      this.maxBornPerBrain = maxBornPerBrain;
      this.noveltyThreshold = 0.25;
      this.mitosisCount = 0;
      this.apoptosisCount = 0;
      this.birthCounter = 0;
      this.prng = prng || new MulberryPRNG(0x5eed1e55);
    }

    evaluate(brain, noveltyError, agentEnergy) {
      for (let i = brain.bornNeurons.length - 1; i >= 0; i--) {
        const neuron = brain.bornNeurons[i];
        neuron.age++;
        if (neuron.maturity < 1.0) {
          neuron.maturity = Math.min(1.0, neuron.maturity + 0.05);
        }

        if (neuron.age > 100 && neuron.activation < 0.01 && neuron.maturity < 0.5) {
          brain.bornNeurons.splice(i, 1);
          this.apoptosisCount++;
        }
      }

      if (noveltyError > this.noveltyThreshold && brain.bornNeurons.length < this.maxBornPerBrain) {
        if (agentEnergy > 20) {
          this._spawnKenyonCell(brain);
          this.mitosisCount++;
        }
      }
    }

    _spawnKenyonCell(brain) {
      const rng = this.prng;
      const id = `${brain.id}_born_${this.birthCounter++}`;
      const weights = new Float32Array(brain.GLOMERULI_COUNT);
      for (let i = 0; i < 3; i++) {
        const g = rng.int(brain.GLOMERULI_COUNT);
        weights[g] = 0.3 + rng.next() * 0.4;
      }

      const mbonWeights = new Float32Array(brain.MBON_COUNT);
      for (let m = 0; m < brain.MBON_COUNT; m++) {
        mbonWeights[m] = 0.2 + rng.next() * 0.1;
      }

      brain.bornNeurons.push({
        id,
        age: 0,
        maturity: 0.1,
        activation: 0,
        weights,
        mbonWeights
      });
    }
  }

  // -------------------------------------------------------------
  // Offline Pre-Training Engine
  // -------------------------------------------------------------
  class PreTrainingEngine {
    static runPreTraining(syncytium, epochs = 60, onProgress = null) {
      const prng = new MulberryPRNG(syncytium.worldSeed || 101);

      for (let ep = 0; ep < epochs; ep++) {
        // Samples follow the sensory contract the engine is actually given:
        // bearings as sin/cos pairs on the unit circle, a reward channel that
        // falls off with distance, bilateral antennae that agree with the
        // bearing they are sampling. Drawing all fourteen channels from a
        // uniform distribution instead, with the four bearing channels pinned
        // to zero, conditions the mushroom body on statistics it will never
        // see: measured over 40 seeds, that cost 51.60 net score against no
        // pre-training at all, 95% interval [24.32, 78.70].
        const rewardBearing = prng.next() * 2 * Math.PI;
        const hazardBearing = prng.next() * 2 * Math.PI;
        const rewardDistance = prng.next();
        const hazardDistance = prng.next();
        const reward = Math.max(0, 1 - rewardDistance);
        const hazard = Math.max(0, 1 - hazardDistance) * 0.6;
        const antennaBias = Math.sin(rewardBearing) * reward * 0.5;

        const sensory = [
          prng.next(), prng.next(),
          reward,
          hazard,
          0.3 + prng.next() * 0.9,
          rewardDistance,
          Math.sin(rewardBearing), Math.cos(rewardBearing),
          Math.sin(hazardBearing), Math.cos(hazardBearing),
          (prng.next() - 0.5) * 0.4, (prng.next() - 0.5) * 0.4,
          Math.max(0, reward * 0.6 + antennaBias),
          Math.max(0, reward * 0.6 - antennaBias)
        ];

        // Turn rates the animal can produce, not arbitrary reorientations.
        const headingShift = (prng.next() - 0.5) * Math.PI;
        syncytium.step(sensory, headingShift, 0.05, 90);

        for (let b = 0; b < syncytium.brainCount; b++) {
          const brain = syncytium.brains[b];
          for (let k = 0; k < brain.KC_BASE_COUNT; k++) {
            const preAct = brain.kcActivations[k];
            if (preAct > 0.2) {
              const offset = k * brain.GLOMERULI_COUNT;
              for (let g = 0; g < brain.GLOMERULI_COUNT; g++) {
                // Strengthen the claws this cell has; do not grow it new ones.
                // A Kenyon cell samples a few glomeruli, and that is what makes
                // the representation sparse and separable. Clamping every
                // synapse up to a floor recruited the silent ones instead:
                // claws per cell went from 3.5 to 7.7 over a short
                // pre-training run, and the arm scored worse than with no
                // pre-training at all.
                const weight = brain.alToKcWeights[offset + g];
                if (weight <= 0) continue;
                brain.alToKcWeights[offset + g] = clamp(weight + 0.005 * brain.alProjection[g], 0.01, 1.2);
              }
            }
          }
        }

        if (onProgress && ep % 10 === 0) {
          onProgress(Math.round(((ep + 1) / epochs) * 100));
        }
      }

      // Pre-training is a conditioning phase, not part of the run: leave the
      // clock and the per-fly registers where a fresh syncytium would have
      // them, so an agent does not start its first tick mid-afternoon with a
      // compass pointing somewhere it never turned.
      syncytium.tickCount = 0;
      syncytium.syncytiumSteps = 0;
      syncytium.circadianClock = 0;
      syncytium.pdfArousal = 1.0;
      syncytium._tickOpen = false;
      syncytium._tickAuto = false;
      for (let i = 0; i < syncytium.brains.length; i++) {
        syncytium.brains[i].restoreEgo(syncytium._pristineEgo[i]);
      }
      syncytium.egoStates.clear();
      syncytium.egoValues.clear();
      syncytium.activeEgoId = null;

      syncytium.isPretrained = true;
      syncytium.pretrainingEpochs = epochs;
      if (onProgress) onProgress(100);
      return syncytium;
    }
  }

  // -------------------------------------------------------------
  // Sixteen-Fly-Brain Syncytium Connectome
  // Interconnects 16 specialized fly brains with 16x16x4 commissural bridges (1024 synapses)
  // -------------------------------------------------------------
  class SixteenFlyBrainSyncytium {
    /**
     * @param {number|string} worldSeed
     * @param {object|string|null} [config] - mechanism selection, or the string
     *   "legacy" for the pre-upgrade circuit models. See DEFAULT_CONFIG.
     */
    constructor(worldSeed = 42, config = null) {
      this.worldSeed = worldSeed;
      this.prng = new MulberryPRNG(worldSeed);
      this.config = resolveConfig(config);

      // 16 Specialized biological roles (grounded in malecns and Central Complex connectomics)
      this.roles = [
        "forager",    // Brain 0: Antennal Lobe & PAM appetitive reward
        "navigator",  // Brain 1: Central Complex E-PG compass ring
        "sentinel",   // Brain 2: Lateral Horn threat reflex & PPL1 aversion
        "vault",      // Brain 3: Kenyon Cell associative LTM engrams
        "pioneer",    // Brain 4: Neurogenesis mitosis hub & novelty exploration
        "optic",      // Brain 5: Optic Lobe motion flow & visual contrast
        "executive",  // Brain 6: Central Complex Fan-Shaped Body (FB) vector planner
        "metabolic",  // Brain 7: Subesophageal Zone (SEZ) taste & satiety drive
        "lal",        // Brain 8: Lateral Accessory Lobe flip-flop zigzag casting
        "vnc_cpg",    // Brain 9: Ventral Nerve Cord CPG locomotion rhythm & torque
        "ammc",       // Brain 10: Johnston's Organ AMMC mechanosensory & peer vibration
        "pb",         // Brain 11: Protocerebral Bridge bilateral phase-shift steering
        "eb",         // Brain 12: Ellipsoid Body toroidal landmark ring attractor
        "no",         // Brain 13: Noduli odometry & path integration translational memory
        "aotu",       // Brain 14: Anterior Optic Tubercle celestial sun compass
        "smp"         // Brain 15: Superior Medial Protocerebrum action commitment latch
      ];

      this.brainCount = 16;
      this.brains = [];
      for (let i = 0; i < this.brainCount; i++) {
        this.brains.push(new DrosophilaBrain(i, this.roles[i], this.config));
      }

      // Forked so neurogenesis draws cannot shift any other seeded stream.
      this.neurogenesis = new NeurogenesisEngine(24, this.prng.fork(1));
      this.commissuralWeights = this._initCommissuralWeights();

      this.engramBank = [];
      this.lastEstimatedValue = 0;
      this.tdGamma = 0.85;
      this.lastRPE = 0;
      this.lastActionIndex = -1;
      this.lastDescendingGains = null;
      this.syncytiumSteps = 0;
      this.isPretrained = false;
      this.pretrainingEpochs = 0;

      // Circadian Clock (120-tick period) & PDF (Pigment-Dispersing Factor)
      this.circadianClock = 0;
      this.circadianPeriod = 120;
      this.pdfArousal = 1.0;

      // Environment ticks, distinct from forward passes. One tick may contain
      // several forward passes (one per fly), so the clock and the homeostatic
      // schedule are driven from tickCount rather than from syncytiumSteps.
      this.tickCount = 0;
      this._tickOpen = false;
      this._tickAuto = false;

      // Shared connectome, separate bodies: one ego record per fly holds the
      // registers that must not leak between individuals.
      this.egoStates = new Map();
      // The value estimate feeding the reward-prediction error is per fly too:
      // a shared scalar means one individual's outcome is scored against
      // whichever individual stepped last.
      this.egoValues = new Map();
      this._pristineEgo = this.brains.map(b => b.captureEgo());
      this.activeEgoId = null;
    }

    /**
     * Open an environment tick: advance the circadian clock and run the
     * homeostatic schedule exactly once, however many flies step afterwards.
     */
    beginTick() {
      this._advanceTick();
      this._tickOpen = true;
      this._tickAuto = false;
      return this;
    }

    /** Close a tick opened by beginTick. */
    endTick() {
      this._tickOpen = false;
      this._tickAuto = false;
      return this;
    }

    _advanceTick() {
      this.tickCount++;
      this.circadianClock = (this.circadianClock + 1) % this.circadianPeriod;
      const isDay = this.circadianClock < this.circadianPeriod / 2;
      this.pdfArousal = isDay
        ? 1.0 + 0.25 * Math.sin((this.circadianClock / (this.circadianPeriod / 2)) * Math.PI)
        : 0.65;
      if (this.tickCount % 50 === 0) {
        for (let i = 0; i < this.brainCount; i++) this.brains[i].applyHomeostaticScaling(0.25);
      }
    }

    _egoRecord(egoId) {
      let record = this.egoStates.get(egoId);
      if (!record) {
        // A new fly starts from the pristine registers, not from whichever
        // individual happened to step last.
        record = this._pristineEgo.map(ego => ({
          scalars: Object.assign(Object.create(null), ego.scalars),
          arrays: Object.fromEntries(Object.entries(ego.arrays).map(([k, v]) => [k, Float32Array.from(v)])),
          born: Float32Array.from(ego.born)
        }));
        this.egoStates.set(egoId, record);
      }
      return record;
    }

    /** Swap a fly's registers into the shared brains. */
    loadEgo(egoId) {
      if (egoId === null || egoId === undefined) return this;
      const record = this._egoRecord(egoId);
      for (let i = 0; i < this.brains.length; i++) this.brains[i].restoreEgo(record[i]);
      this.activeEgoId = egoId;
      return this;
    }

    /** Copy the shared brains' current registers back into a fly's record. */
    saveEgo(egoId) {
      if (egoId === null || egoId === undefined) return this;
      const record = this._egoRecord(egoId);
      for (let i = 0; i < this.brains.length; i++) this.brains[i].captureEgo(record[i]);
      return this;
    }

    _initCommissuralWeights() {
      const weights = new Float32Array(16 * 16 * 4);
      for (let src = 0; src < 16; src++) {
        for (let dst = 0; dst < 16; dst++) {
          if (src === dst) continue;
          for (let a = 0; a < 4; a++) {
            const idx = (src * 16 + dst) * 4 + a;
            weights[idx] = 0.08;
          }
        }
      }
      return weights;
    }

    _computeExecutiveGoalVector(sensoryInput) {
      if (this.engramBank.length > 0) {
        let bestEngram = this.engramBank[0];
        for (let i = 1; i < this.engramBank.length; i++) {
          if (this.engramBank[i].salience > bestEngram.salience) {
            bestEngram = this.engramBank[i];
          }
        }

        const agentX = sensoryInput[0] || 0.5;
        const agentY = sensoryInput[1] || 0.5;
        const targetX = bestEngram.targetX !== undefined ? bestEngram.targetX : 0.8;
        const targetY = bestEngram.targetY !== undefined ? bestEngram.targetY : 0.8;

        const dx = targetX - agentX;
        const dy = targetY - agentY;
        const distance = Math.hypot(dx, dy);
        const heading = Math.atan2(dy, dx);

        return { x: dx, y: dy, distance, heading, active: distance > 0.05 };
      }

      const diamondSense = sensoryInput[2] || 0;
      if (diamondSense > 0.02) {
        const diamondAngle = Math.atan2(sensoryInput[6] || 0, sensoryInput[7] || 0);
        return { x: Math.cos(diamondAngle), y: Math.sin(diamondAngle), distance: 1.0, heading: diamondAngle, active: true };
      }

      return { x: 0, y: 0, distance: 0, heading: 0, active: false };
    }

    /**
     * Per-brain descending gains for this tick.
     *
     * Roles are grouped by what they are for, and the groups are boosted or
     * suppressed according to the fly's situation. Total weight is conserved,
     * so this redistributes the motor vote rather than turning the gain up:
     * the softmax that follows stays on the same scale.
     *
     * @param {ArrayLike<number>} sensoryInput
     * @param {Object<string, number>} roleWeights - baseline weight per role
     * @returns {Float32Array} one gain per brain
     */
    _descendingGains(sensoryInput, roleWeights) {
      const threat = clamp(sensoryInput[3] || 0, 0, 1);
      const appetitive = clamp(sensoryInput[2] || 0, 0, 1);
      const energy = Number.isFinite(sensoryInput[4]) ? sensoryInput[4] : 0.8;
      const hunger = clamp(1 - energy, 0, 1);
      // Hunger raises the value of a weak gradient: NPF-driven food seeking
      // makes a hungry fly act on a scent a sated one would ignore.
      const pursue = clamp(Math.max(appetitive, appetitive * 0.5 + hunger * 0.6), 0, 1);
      const explore = clamp(1 - Math.max(pursue, threat), 0, 1);

      const groupBoost = {
        reflex: 1 + threat * 2.6,
        goal: 1 + pursue * 2.2 - threat * 0.5,
        explore: 1 + explore * 1.4 - pursue * 0.7 - threat * 0.6,
        support: 1
      };

      const gains = new Float32Array(this.brainCount);
      let total = 0;
      let baseline = 0;
      for (let i = 0; i < this.brainCount; i++) {
        const role = this.brains[i].role;
        const base = roleWeights[role] || 1.0;
        const group = DESCENDING_GROUPS[role] || "support";
        const gain = base * Math.max(0.15, groupBoost[group]);
        gains[i] = gain;
        total += gain;
        baseline += base;
      }
      if (total > 1e-6) {
        const scale = baseline / total;
        for (let i = 0; i < this.brainCount; i++) gains[i] *= scale;
      }
      return gains;
    }

    /**
     * One forward pass through the syncytium for a single fly.
     *
     * @param {ArrayLike<number>} sensoryInput - 14-channel sensory vector
     * @param {number} headingDelta - angular velocity for the compass
     * @param {number} noveltyError - drives neurogenesis
     * @param {number} agentEnergy - metabolic budget
     * @param {object|null} peerContext - peer geometry, sun angle, step vector
     * @param {*} [egoId] - identifies the fly; its registers are swapped in and
     *   out so several flies can share one connectome without leaking heading,
     *   odometry, gait phase or metabolic state into each other. Omit for the
     *   single-fly case.
     */
    step(sensoryInput, headingDelta = 0, noveltyError = 0, agentEnergy = 100, peerContext = null, egoId = null) {
      this.syncytiumSteps++;

      // A caller that never opens a tick explicitly (the single-fly case) gets
      // one tick per forward pass, as before.
      if (!this._tickOpen) {
        this._advanceTick();
        this._tickAuto = true;
      }
      const isDay = this.circadianClock < this.circadianPeriod / 2;

      if (egoId !== null && egoId !== undefined) this.loadEgo(egoId);

      const execContext = this._computeExecutiveGoalVector(sensoryInput);

      // 1. Forward pass for each of the 16 brains
      const individualOutputs = [];
      for (let i = 0; i < this.brainCount; i++) {
        const brain = this.brains[i];
        brain.pdfArousal = this.pdfArousal;

        // Day promotes octopaminergic vigor; night promotes serotonergic memory consolidation
        if (isDay) {
          brain.octopamineOA = clamp(brain.octopamineOA * 1.005, 0.1, 1.2);
        } else {
          brain.serotonin5HT = clamp(brain.serotonin5HT * 1.005, 0.1, 1.2);
        }

        const modulatedSensory = sensoryInput.slice();
        if (brain.role === "forager") {
          modulatedSensory[4] = (modulatedSensory[4] || 0) * 1.3;
        } else if (brain.role === "sentinel") {
          modulatedSensory[3] = (modulatedSensory[3] || 0) * 1.5;
        }

        const out = brain.forward(modulatedSensory, headingDelta, execContext, peerContext);
        individualOutputs.push(out);

        this.neurogenesis.evaluate(brain, noveltyError, agentEnergy);
      }

      // 2. Inter-Brain Commissural Cross-Talk (16x16x4 = 1024 synapses)
      const commInteractions = Array.from({ length: this.brainCount }, () => new Float32Array(4));
      for (let src = 0; src < this.brainCount; src++) {
        for (let dst = 0; dst < this.brainCount; dst++) {
          if (src === dst) continue;
          for (let a = 0; a < 4; a++) {
            const w = this.commissuralWeights[(src * 16 + dst) * 4 + a];
            commInteractions[dst][a] += individualOutputs[src][a] * w;
          }
        }
      }

      // 3. Heading distribution.
      //
      // Attractor mode broadcasts the navigator's decoded heading, because the
      // compass lives in the Central Complex and other neuropils read it.
      // Averaging scalars from 16 independent integrators, as legacy mode does,
      // also wraps incorrectly near 0/2pi -- a mean of 0.01 and 6.27 lands at
      // pi, pointing backwards.
      if (this.config.compass === "attractor") {
        const reference = this.brains[1].compassHeading;
        for (let i = 0; i < this.brainCount; i++) {
          if (i === 1) continue;
          const brain = this.brains[i];
          brain.compassHeading = wrapAngle(
            brain.compassHeading + 0.6 * angleDelta(reference, brain.compassHeading)
          );
        }
      } else {
        let meanHeading = 0;
        for (let i = 0; i < this.brainCount; i++) {
          meanHeading += this.brains[i].compassHeading;
        }
        meanHeading /= this.brainCount;
        for (let i = 0; i < this.brainCount; i++) {
          this.brains[i].compassHeading = 0.85 * this.brains[i].compassHeading + 0.15 * meanHeading;
        }
      }

      // 4. Descending motor synthesis.
      //
      // Sixteen neuropils do not vote as equals in an animal. The descending
      // pathway is gated: a looming threat hands control to the escape
      // circuits, an appetitive gradient hands it to the goal-directed ones,
      // and in the absence of either, exploration takes over. With one fixed
      // weight per role, as legacy mode does, the forager's odour gradient is
      // one vote in sixteen and the exploratory biases outvote it, which is
      // measurably worse than using fewer brains at all.
      const roleWeights = {
        forager: 1.2,
        navigator: 1.1,
        sentinel: 1.4,
        vault: 1.0,
        pioneer: 0.9,
        optic: 1.15,
        executive: 1.35,
        metabolic: 1.25,
        lal: 1.1,
        vnc_cpg: 1.05,
        ammc: 1.15,
        pb: 1.2,
        eb: 1.15,
        no: 1.05,
        aotu: 1.1,
        smp: 1.3
      };

      const gains = this.config.consensus === "gated"
        ? this._descendingGains(sensoryInput, roleWeights)
        : null;
      this.lastDescendingGains = gains;

      const consensusLogits = [0, 0, 0, 0];
      for (let i = 0; i < this.brainCount; i++) {
        const brain = this.brains[i];
        const rW = gains ? gains[i] : (roleWeights[brain.role] || 1.0);
        for (let a = 0; a < 4; a++) {
          const direct = individualOutputs[i][a];
          const cross = commInteractions[i][a];
          consensusLogits[a] += (direct + 0.2 * cross) * rW;
        }
      }

      this.lastEstimatedValue = (consensusLogits[0] + consensusLogits[1] + consensusLogits[2] + consensusLogits[3]) / 4;

      // The channel this syncytium favoured. A caller that then executes a
      // different action -- because it mixes in its own policy, filters out
      // illegal moves or holds a commitment latch -- must say so through
      // setExecutedAction, or dopamine will depress a channel the fly did not
      // use and spare the one it did.
      let chosen = 0;
      for (let a = 1; a < 4; a++) if (consensusLogits[a] > consensusLogits[chosen]) chosen = a;
      this.lastActionIndex = chosen;
      for (let i = 0; i < this.brainCount; i++) this.brains[i].lastActionIndex = chosen;

      if (egoId !== null && egoId !== undefined) {
        this.egoValues.set(egoId, this.lastEstimatedValue);
        this.saveEgo(egoId);
      }
      if (this._tickAuto) {
        this._tickOpen = false;
        this._tickAuto = false;
      }

      return softmax(consensusLogits);
    }

    /**
     * @param {number} rewardDelta
     * @param {number} hazardDelta
     * @param {object|null} currentCoordinates
     * @param {*} [egoId] - the fly being credited. Plasticity reads the KC and
     *   MBON activations that produced the action, so crediting a shared
     *   connectome without naming the fly would train whichever individual
     *   stepped last.
     */
    /**
     * Record the action a fly actually executed, so plasticity credits the
     * channel that drove it.
     *
     * @param {number} actionIndex
     * @param {*} [egoId]
     */
    setExecutedAction(actionIndex, egoId = null) {
      if (!Number.isInteger(actionIndex) || actionIndex < 0 || actionIndex > 3) return this;
      const restore = this.activeEgoId;
      if (egoId !== null && egoId !== undefined) this.loadEgo(egoId);
      this.lastActionIndex = actionIndex;
      for (let i = 0; i < this.brainCount; i++) this.brains[i].lastActionIndex = actionIndex;
      if (egoId !== null && egoId !== undefined) {
        this.saveEgo(egoId);
        if (restore !== null && restore !== undefined && restore !== egoId) this.loadEgo(restore);
      }
      return this;
    }

    applyReinforcement(rewardDelta, hazardDelta, currentCoordinates = null, egoId = null) {
      if (egoId !== null && egoId !== undefined) this.loadEgo(egoId);
      const estimate = egoId !== null && egoId !== undefined && this.egoValues.has(egoId)
        ? this.egoValues.get(egoId)
        : this.lastEstimatedValue;
      const netExtrinsic = rewardDelta - (hazardDelta * 1.5);
      const rpe = netExtrinsic + (this.tdGamma * estimate * 0.1) - (estimate * 0.1);
      this.lastRPE = rpe;

      const pamBurst = Math.max(0, rpe > 0 ? rpe : rewardDelta);
      const ppl1Burst = Math.max(0, rpe < 0 ? Math.abs(rpe) : hazardDelta);

      for (let i = 0; i < this.brainCount; i++) {
        this.brains[i].applyPlasticity(pamBurst, ppl1Burst);
      }

      if (rewardDelta > 0.4 || pamBurst > 0.5) {
        this._consolidateEngram(Math.max(rewardDelta, pamBurst), currentCoordinates);
      }

      if (egoId !== null && egoId !== undefined) this.saveEgo(egoId);
    }

    _consolidateEngram(salience, coords = null) {
      const engram = {
        step: this.syncytiumSteps,
        salience,
        compassMean: this.brains[1].compassHeading,
        activeKCs: this.brains[3].kcActivations.slice(0, 10),
        targetX: coords ? coords.x : 0.8,
        targetY: coords ? coords.y : 0.8,
        valence: salience
      };

      this.engramBank.push(engram);
      if (this.engramBank.length > 64) {
        this.engramBank.shift();
      }
    }

    getTelemetry() {
      let totalBornNeurons = 0;
      let totalMatureNeurons = 0;
      for (let i = 0; i < this.brainCount; i++) {
        totalBornNeurons += this.brains[i].bornNeurons.length;
        for (const n of this.brains[i].bornNeurons) {
          if (n.maturity >= 0.9) totalMatureNeurons++;
        }
      }

      return {
        step: this.syncytiumSteps,
        worldSeed: this.worldSeed,
        brainCount: this.brainCount,
        isPretrained: this.isPretrained,
        pretrainingEpochs: this.pretrainingEpochs,
        totalBornNeurons,
        totalMatureNeurons,
        mitosisEvents: this.neurogenesis.mitosisCount,
        apoptosisEvents: this.neurogenesis.apoptosisCount,
        engramsStored: this.engramBank.length,
        compassHeadingDeg: Math.round((this.brains[1].compassHeading * 180) / Math.PI),
        brainRoles: this.brains.map(b => b.role),
        dopaminePAM: this.brains[0].dopaminePAM,
        dopaminePPL1: this.brains[2].dopaminePPL1,
        octopamineOA: this.brains[7].octopamineOA,
        serotonin5HT: this.brains[7].serotonin5HT,
        lastRPE: this.lastRPE,
        executiveVectorActive: this.brains[6].targetVector?.active || false,
        lalFlipFlop: this.brains[8].lalFlipFlop,
        vncTorque: this.brains[9].vncTorque,
        ammcVibration: this.brains[10].ammcVibration,
        pbPhaseShift: this.brains[11].pbPhaseShift,
        ebStabilization: this.brains[12].ebStabilization,
        noDistance: this.brains[13].noOdometryDistance,
        aotuSunHeading: this.brains[14].aotuSunHeading,
        aotuEVectorAlignment: this.brains[14].aotuEVectorAlignment,
        smpLatchedAction: this.brains[15].smpLatchedAction,
        neuropeptideNPF: this.brains[7].neuropeptideNPF || 0,
        neuropeptideSIFamide: this.brains[7].neuropeptideSIFamide || 0,
        giantFiberTriggered: this.brains[2].giantFiberTriggered || false,
        loomingVelocity: this.brains[2].loomingVelocity || 0,
        circadianClock: this.circadianClock,
        circadianPhase: this.circadianClock < this.circadianPeriod / 2 ? "DAY" : "NIGHT",
        pdfArousal: this.pdfArousal,
        tick: this.tickCount,
        // Per-fly fields below (ring, sparseness, neuromodulators, compass)
        // describe this individual, not an average over the swarm.
        activeEgoId: this.activeEgoId,
        compassMode: this.config.compass,
        mbInhibition: this.config.mbInhibition,
        plasticityRule: this.config.plasticity,
        // Population-vector length of the E-PG bump: 1 is a sharp, confident
        // heading estimate, 0 a flat ring with no heading at all.
        ringCertainty: this.brains[1].ringCertainty,
        ringAmplitude: this.brains[1].ringAmplitude,
        epgRing: Array.from(this.brains[1].epgRing),
        kcSparsity: this.brains[3].kcSparsity,
        aplActivity: this.brains[3].aplActivity,
        lastActionIndex: this.lastActionIndex,
        consensusMode: this.config.consensus,
        descendingGains: this.lastDescendingGains ? Array.from(this.lastDescendingGains) : null
      };
    }

    getSyncytiumTelemetry() {
      return this.getTelemetry();
    }
  }

  // Aliases for full backward compatibility
  const ElevenFlyBrainSyncytium = SixteenFlyBrainSyncytium;
  const EightFlyBrainSyncytium = SixteenFlyBrainSyncytium;
  const SevenFlyBrainSyncytium = SixteenFlyBrainSyncytium;
  const FiveFlyBrainSyncytium = SixteenFlyBrainSyncytium;

  // -------------------------------------------------------------
  // Dual-Agent Graph Grafting with Stagnation Inactivity Hazard
  // -------------------------------------------------------------
  // Stable ego identifiers so the same fly always maps to the same registers.
  const EGO_AGENT1 = "agent1";
  const EGO_AGENT2 = "agent2";
  const EGO_AGENT3 = "agent3";

  class MultiAgentGraphGraft {
    /**
     * @param {SixteenFlyBrainSyncytium} syncytium
     * @param {number} graftInfluence
     */
    constructor(syncytium = null, graftInfluence = 0.55) {
      this.syncytium = syncytium || new SixteenFlyBrainSyncytium(42);
      this.graftInfluence = clamp(graftInfluence, 0, 1);
      this.actionNames = ["up", "down", "left", "right"];
      this.sunAngle = 0;
      // A fixed celestial azimuth for this world. The sun moves over a day but
      // not over a foraging bout, and only something that holds still can
      // anchor a compass; sunAngle, which sweeps a full circle every circadian
      // period, cannot.
      this.skyReference = ((this.syncytium.worldSeed || 0) % 360) * Math.PI / 180;

      // Agent 1: Harvester (Appetitive forage specialist)
      this.agent1 = {
        id: 1,
        name: "Harvester",
        role: "harvester",
        behavioralRegime: "FORAGE",
        dwellTicks: 0,
        lastX: -1,
        lastY: -1,
        committedAction: -1,
        commitmentTimer: 0,
        isStasisHazard: false,
        lastFlyProbabilities: [0.25, 0.25, 0.25, 0.25],
        lastHeading: 0
      };

      // Agent 2: Sentinel-Pioneer (Frontier exploration & hazard sweep)
      this.agent2 = {
        id: 2,
        name: "Sentinel-Pioneer",
        role: "sentinel_pioneer",
        behavioralRegime: "PIONEER",
        dwellTicks: 0,
        lastX: -1,
        lastY: -1,
        committedAction: -1,
        commitmentTimer: 0,
        isStasisHazard: false,
        isGFEscape: false,
        lastFlyProbabilities: [0.25, 0.25, 0.25, 0.25],
        lastHeading: 0
      };

      // Agent 3: Cartographer-Scout (Spatial mapping, celestial scouts, and beacon planting)
      this.agent3 = {
        id: 3,
        name: "Cartographer-Scout",
        role: "cartographer",
        behavioralRegime: "SCOUT",
        dwellTicks: 0,
        lastX: -1,
        lastY: -1,
        committedAction: -1,
        commitmentTimer: 0,
        isStasisHazard: false,
        isGFEscape: false,
        lastFlyProbabilities: [0.25, 0.25, 0.25, 0.25],
        lastHeading: 0
      };

      this.stasisThreshold = 4; // Stagnation hazard triggers after 4 still ticks
      this.stasisEnergyDrain = 8;

      /**
       * Social signalling has a refractory period, and its energy payoff is
       * smaller than the cost of the ticks it takes. Paid every tick, huddling
       * beat foraging: three agents within range gained more energy than moving
       * costs, so the swarm settled into a corner and farmed the bonus while
       * the diamonds went uncollected. Wing song is a signal, not a meal.
       */
      this.socialRefractory = 12;
      this.handshakeEnergy = 2;
      this.triSwarmEnergy = 3;
      this.handshakeCooldown = 0;
      this.triSwarmCooldown = 0;
      this.stasisEvents = 0;
      this.handshakeEvents = 0; // AMMC acoustic synergy events
      this.triSwarmResonanceEvents = 0; // Triangular 3-agent acoustic swarm events
      this.giantFiberEvents = 0; // Giant Fiber emergency looming escape saccades
      this.beaconWaypoints = []; // Cartographer luminescent beacon waypoints
    }

    /**
     * Highest-preference action the fly can actually take.
     *
     * Without bounds the caller clamps the move instead, so a fly whose
     * preferred direction is a wall simply does not move, accrues dwell ticks
     * and is penalised for stasis it cannot avoid. Given bounds, illegal
     * directions are skipped, as the benchmark policies already do.
     *
     * @param {Array<number>} probabilities
     * @param {number} x
     * @param {number} y
     * @param {{width:number, height:number}|null} bounds
     * @returns {number} action index
     */
    _bestLegalAction(probabilities, x, y, bounds) {
      let best = 0;
      for (let a = 1; a < 4; a++) if (probabilities[a] > probabilities[best]) best = a;
      if (!bounds) return best;
      const order = [0, 1, 2, 3].sort((a, b) => probabilities[b] - probabilities[a] || a - b);
      for (const a of order) {
        if (this._isLegal(a, x, y, bounds)) return a;
      }
      return best;
    }

    _isLegal(action, x, y, bounds) {
      if (!bounds) return true;
      const nx = x + [0, 0, -1, 1][action];
      const ny = y + [-1, 1, 0, 0][action];
      return nx >= 0 && nx < bounds.width && ny >= 0 && ny < bounds.height;
    }

    /**
     * Grid bounds, if the caller supplied them on the environment. Accepts
     * gridSize for a square world or width/height for a rectangular one.
     */
    _boundsOf(env) {
      if (!env) return null;
      if (Number.isFinite(env.width) && Number.isFinite(env.height)) {
        return { width: env.width, height: env.height };
      }
      if (Number.isFinite(env.gridSize)) return { width: env.gridSize, height: env.gridSize };
      return null;
    }

    /**
     * Heading and angular velocity for one fly.
     *
     * Heading is the direction the fly actually travelled. Deriving it from the
     * fly's bearing from the centre of the world instead, as this did before,
     * makes the compass encode which side of the arena the fly is on: an agent
     * left of centre reads a heading of pi, the compass bias then favours
     * moving further left, and the fly drives itself into the wall and stays
     * there. A fly that did not move keeps the heading it had.
     *
     * @param {object} agentData - per-agent record holding lastHeading
     * @param {number} stepDx
     * @param {number} stepDy
     * @returns {{heading:number, angularVelocity:number}}
     */
    _resolveHeading(agentData, stepDx, stepDy) {
      const moved = stepDx !== 0 || stepDy !== 0;
      const heading = moved ? Math.atan2(stepDy, stepDx) : agentData.lastHeading;
      return { heading, angularVelocity: angleDelta(heading, agentData.lastHeading) };
    }

    _updateAgentRegime(agentData, sensoryState) {
      const hazardSense = sensoryState[3] || 0;
      const energyNorm = sensoryState[4] || 0.5;
      const rewardSense = sensoryState[2] || 0;

      if (hazardSense > 0.45) {
        agentData.behavioralRegime = "EVADE";
      } else if (agentData.role === "cartographer") {
        agentData.behavioralRegime = rewardSense > 0.3 ? "MAP_BEACON" : "SCOUT";
      } else if (energyNorm < 0.35 || (agentData.role === "harvester" && rewardSense > 0.3)) {
        agentData.behavioralRegime = "FORAGE";
      } else if (sensoryState[5] < 0.25 || agentData.role === "sentinel_pioneer") {
        agentData.behavioralRegime = "PIONEER";
      } else {
        agentData.behavioralRegime = "CONSOLIDATE";
      }
    }

    /**
     * Resolve actions for agents (supporting dual and tri-agent swarms) with inter-agent graph communication,
     * triangular swarm resonance, beacon planting, and Giant Fiber looming escapes.
     */
    resolveAgents(
      env,
      agent1Obs,
      agent2Obs,
      agent3Obs = null,
      agent1Logits = [0.25, 0.25, 0.25, 0.25],
      agent2Logits = [0.25, 0.25, 0.25, 0.25],
      agent3Logits = [0.25, 0.25, 0.25, 0.25]
    ) {
      // One environment tick, however many flies are resolved inside it.
      this.syncytium.beginTick();
      const bounds = this._boundsOf(env);

      // 1. Calculate Inter-Agent Graph Metrics & Celestial Sun Angle
      const dx12 = env.agent2X - env.agent1X;
      const dy12 = env.agent2Y - env.agent1Y;
      const peerDist = Math.hypot(dx12, dy12);
      const dist12 = peerDist;

      const hasAgent3 = Boolean(agent3Obs && env.agent3X !== undefined && env.agent3Y !== undefined);
      let dist23 = 999, dist31 = 999;
      let dx23 = 0, dy23 = 0, dx31 = 0, dy31 = 0;

      if (hasAgent3) {
        dx23 = env.agent3X - env.agent2X;
        dy23 = env.agent3Y - env.agent2Y;
        dist23 = Math.hypot(dx23, dy23);

        dx31 = env.agent1X - env.agent3X;
        dy31 = env.agent1Y - env.agent3Y;
        dist31 = Math.hypot(dx31, dy31);
      }

      const sunAngle = (this.syncytium.circadianClock / this.syncytium.circadianPeriod) * Math.PI * 2;
      this.sunAngle = sunAngle;

      const stepDx1 = this.agent1.lastX >= 0 ? env.agent1X - this.agent1.lastX : 0;
      const stepDy1 = this.agent1.lastY >= 0 ? env.agent1Y - this.agent1.lastY : 0;
      const stepDx2 = this.agent2.lastX >= 0 ? env.agent2X - this.agent2.lastX : 0;
      const stepDy2 = this.agent2.lastY >= 0 ? env.agent2Y - this.agent2.lastY : 0;
      const stepDx3 = hasAgent3 && this.agent3.lastX >= 0 ? env.agent3X - this.agent3.lastX : 0;
      const stepDy3 = hasAgent3 && this.agent3.lastY >= 0 ? env.agent3Y - this.agent3.lastY : 0;

      // 2. Check Stagnation Dwell Times for Agent 1
      if (env.agent1X === this.agent1.lastX && env.agent1Y === this.agent1.lastY) {
        this.agent1.dwellTicks++;
      } else {
        this.agent1.dwellTicks = 0;
      }
      this.agent1.lastX = env.agent1X;
      this.agent1.lastY = env.agent1Y;
      this.agent1.isStasisHazard = this.agent1.dwellTicks >= this.stasisThreshold;
      if (this.agent1.isStasisHazard) {
        this.stasisEvents++;
        env.agent1Energy = Math.max(0, env.agent1Energy - this.stasisEnergyDrain);
        this.syncytium.applyReinforcement(0, 1.2, null, EGO_AGENT1);
      }

      // Check Stagnation Dwell Times for Agent 2
      if (env.agent2X === this.agent2.lastX && env.agent2Y === this.agent2.lastY) {
        this.agent2.dwellTicks++;
      } else {
        this.agent2.dwellTicks = 0;
      }
      this.agent2.lastX = env.agent2X;
      this.agent2.lastY = env.agent2Y;
      this.agent2.isStasisHazard = this.agent2.dwellTicks >= this.stasisThreshold;
      if (this.agent2.isStasisHazard) {
        this.stasisEvents++;
        env.agent2Energy = Math.max(0, env.agent2Energy - this.stasisEnergyDrain);
        this.syncytium.applyReinforcement(0, 1.2, null, EGO_AGENT2);
      }

      // Check Stagnation Dwell Times for Agent 3
      if (hasAgent3) {
        if (env.agent3X === this.agent3.lastX && env.agent3Y === this.agent3.lastY) {
          this.agent3.dwellTicks++;
        } else {
          this.agent3.dwellTicks = 0;
        }
        this.agent3.lastX = env.agent3X;
        this.agent3.lastY = env.agent3Y;
        this.agent3.isStasisHazard = this.agent3.dwellTicks >= this.stasisThreshold;
        if (this.agent3.isStasisHazard) {
          this.stasisEvents++;
          if (env.agent3Energy !== undefined) {
            env.agent3Energy = Math.max(0, env.agent3Energy - this.stasisEnergyDrain);
          }
          this.syncytium.applyReinforcement(0, 1.2, null, EGO_AGENT3);
        }
      }

      // 3. Resolve Agent 1 (Harvester)
      this._updateAgentRegime(this.agent1, agent1Obs);
      const motion1 = this._resolveHeading(this.agent1, stepDx1, stepDy1);
      const h1 = motion1.heading;
      const flyProbs1 = this.syncytium.step(agent1Obs, motion1.angularVelocity, 0, env.agent1Energy, {
        dx: dx12, dy: dy12, dist: peerDist, sunAngle, skyReference: this.skyReference, stepDx: stepDx1, stepDy: stepDy1
      }, EGO_AGENT1);
      this.agent1.lastHeading = h1;
      this.agent1.lastFlyProbabilities = flyProbs1;

      // Giant fiber check for Agent 1
      this.agent1.isGFEscape = Boolean(agent1Obs[3] > 0.65 || (agent1Obs[3] > 0.35 && this.syncytium.brains[2].loomingVelocity > 0.25));
      if (this.agent1.isGFEscape) {
        this.giantFiberEvents++;
        this.agent1.commitmentTimer = 0;
      }

      const dynamicBeta1 = clamp(this.graftInfluence + (this.agent1.behavioralRegime === "EVADE" ? 0.25 : 0.1), 0.1, 0.95);
      const combProbs1 = [0, 0, 0, 0];
      for (let a = 0; a < 4; a++) {
        combProbs1[a] = (1 - dynamicBeta1) * agent1Logits[a] + dynamicBeta1 * flyProbs1[a];
      }
      const finalProbs1 = softmax(combProbs1, 0.8);
      let maxA1 = this._bestLegalAction(finalProbs1, env.agent1X, env.agent1Y, bounds);

      if (this.agent1.isGFEscape) {
        this.agent1.committedAction = maxA1;
        this.agent1.commitmentTimer = 0;
      } else if (this.agent1.commitmentTimer > 0 && this.agent1.behavioralRegime !== "EVADE"
        && this._isLegal(this.agent1.committedAction, env.agent1X, env.agent1Y, bounds)) {
        this.agent1.commitmentTimer--;
        maxA1 = this.agent1.committedAction;
      } else {
        this.agent1.committedAction = maxA1;
        this.agent1.commitmentTimer = 2;
      }

      // 4. Resolve Agent 2 (Sentinel-Pioneer)
      this._updateAgentRegime(this.agent2, agent2Obs);
      const motion2 = this._resolveHeading(this.agent2, stepDx2, stepDy2);
      const h2 = motion2.heading;
      const flyProbs2 = this.syncytium.step(agent2Obs, motion2.angularVelocity, 0.5, env.agent2Energy, {
        dx: -dx12, dy: -dy12, dist: peerDist, sunAngle, skyReference: this.skyReference, stepDx: stepDx2, stepDy: stepDy2
      }, EGO_AGENT2);
      this.agent2.lastHeading = h2;
      this.agent2.lastFlyProbabilities = flyProbs2;

      // Giant fiber check for Agent 2
      this.agent2.isGFEscape = Boolean(agent2Obs[3] > 0.65 || (agent2Obs[3] > 0.35 && this.syncytium.brains[2].loomingVelocity > 0.25));
      if (this.agent2.isGFEscape) {
        this.giantFiberEvents++;
        this.agent2.commitmentTimer = 0;
      }

      const dynamicBeta2 = clamp(this.graftInfluence + 0.15, 0.1, 0.95);
      const combProbs2 = [0, 0, 0, 0];
      for (let a = 0; a < 4; a++) {
        combProbs2[a] = (1 - dynamicBeta2) * agent2Logits[a] + dynamicBeta2 * flyProbs2[a];
      }
      const finalProbs2 = softmax(combProbs2, 0.8);
      let maxA2 = this._bestLegalAction(finalProbs2, env.agent2X, env.agent2Y, bounds);

      if (this.agent2.isGFEscape) {
        this.agent2.committedAction = maxA2;
        this.agent2.commitmentTimer = 0;
      } else if (this.agent2.commitmentTimer > 0 && this.agent2.behavioralRegime !== "EVADE"
        && this._isLegal(this.agent2.committedAction, env.agent2X, env.agent2Y, bounds)) {
        this.agent2.commitmentTimer--;
        maxA2 = this.agent2.committedAction;
      } else {
        this.agent2.committedAction = maxA2;
        this.agent2.commitmentTimer = 2;
      }

      // 5. Resolve Agent 3 (Cartographer-Scout)
      let maxA3 = 0, finalProbs3 = [0.25, 0.25, 0.25, 0.25];
      if (hasAgent3) {
        this._updateAgentRegime(this.agent3, agent3Obs);
        const motion3 = this._resolveHeading(this.agent3, stepDx3, stepDy3);
        const h3 = motion3.heading;
        const flyProbs3 = this.syncytium.step(agent3Obs, motion3.angularVelocity, 0.3, env.agent3Energy || 100, {
          dx: dx31, dy: dy31, dist: dist31, sunAngle, skyReference: this.skyReference, stepDx: stepDx3, stepDy: stepDy3
        }, EGO_AGENT3);
        this.agent3.lastHeading = h3;
        this.agent3.lastFlyProbabilities = flyProbs3;

        this.agent3.isGFEscape = Boolean(agent3Obs[3] > 0.65 || (agent3Obs[3] > 0.35 && this.syncytium.brains[2].loomingVelocity > 0.25));
        if (this.agent3.isGFEscape) {
          this.giantFiberEvents++;
          this.agent3.commitmentTimer = 0;
        }

        const dynamicBeta3 = clamp(this.graftInfluence + 0.1, 0.1, 0.95);
        const combProbs3 = [0, 0, 0, 0];
        for (let a = 0; a < 4; a++) {
          combProbs3[a] = (1 - dynamicBeta3) * agent3Logits[a] + dynamicBeta3 * flyProbs3[a];
        }
        finalProbs3 = softmax(combProbs3, 0.8);
        maxA3 = this._bestLegalAction(finalProbs3, env.agent3X, env.agent3Y, bounds);

        if (this.agent3.isGFEscape) {
          this.agent3.committedAction = maxA3;
          this.agent3.commitmentTimer = 0;
        } else if (this.agent3.commitmentTimer > 0 && this.agent3.behavioralRegime !== "EVADE"
          && this._isLegal(this.agent3.committedAction, env.agent3X, env.agent3Y, bounds)) {
          this.agent3.commitmentTimer--;
          maxA3 = this.agent3.committedAction;
        } else {
          this.agent3.committedAction = maxA3;
          this.agent3.commitmentTimer = 2;
        }

        // Cartographer Beacon Planting near diamond clusters
        if (this.agent3.behavioralRegime === "MAP_BEACON") {
          const alreadyHasNearby = this.beaconWaypoints.some(b => Math.hypot(b.x - env.agent3X, b.y - env.agent3Y) < 3.0);
          if (!alreadyHasNearby) {
            this.beaconWaypoints.push({
              x: env.agent3X,
              y: env.agent3Y,
              strength: 1.0,
              step: this.syncytium.syncytiumSteps
            });
            if (this.beaconWaypoints.length > 8) this.beaconWaypoints.shift();
          }
        }
      }

      if (this.handshakeCooldown > 0) this.handshakeCooldown--;
      if (this.triSwarmCooldown > 0) this.triSwarmCooldown--;

      // 6. AMMC Acoustic Courtship/Wing-Song Handshake & Energy Resonance (Dual Pair)
      const handshakeInRange = peerDist <= 2.5
        && !this.agent1.isStasisHazard && !this.agent2.isStasisHazard;
      let isAcousticHandshake = false;
      if (handshakeInRange && this.handshakeCooldown === 0) {
        isAcousticHandshake = true;
        this.handshakeEvents++;
        this.handshakeCooldown = this.socialRefractory;
        if (env.agent1Energy !== undefined) env.agent1Energy = Math.min(180, env.agent1Energy + this.handshakeEnergy);
        if (env.agent2Energy !== undefined) env.agent2Energy = Math.min(180, env.agent2Energy + this.handshakeEnergy);
        this.syncytium.applyReinforcement(0.4, 0.0, null, EGO_AGENT1);
        this.syncytium.applyReinforcement(0.4, 0.0, null, EGO_AGENT2);
      }

      // 7. Tri-Trophic Swarm Resonance (Triangular 3-Agent Mesh)
      const triSwarmInRange = hasAgent3 && dist12 <= 4.0 && dist23 <= 4.0 && dist31 <= 4.0;
      let isTriSwarmResonance = false;
      if (triSwarmInRange && this.triSwarmCooldown === 0) {
        isTriSwarmResonance = true;
        this.triSwarmResonanceEvents++;
        this.triSwarmCooldown = this.socialRefractory;
        if (env.agent1Energy !== undefined) env.agent1Energy = Math.min(180, env.agent1Energy + this.triSwarmEnergy);
        if (env.agent2Energy !== undefined) env.agent2Energy = Math.min(180, env.agent2Energy + this.triSwarmEnergy);
        if (env.agent3Energy !== undefined) env.agent3Energy = Math.min(180, env.agent3Energy + this.triSwarmEnergy);
        this.syncytium.applyReinforcement(0.8, 0.0, null, EGO_AGENT1);
        this.syncytium.applyReinforcement(0.8, 0.0, null, EGO_AGENT2);
        this.syncytium.applyReinforcement(0.8, 0.0, null, EGO_AGENT3);
      }

      // The executed actions, which are not necessarily the syncytium's own
      // argmax: they have been mixed with the caller's policy, filtered for
      // legality and possibly held by a commitment latch.
      this.syncytium.setExecutedAction(maxA1, EGO_AGENT1);
      this.syncytium.setExecutedAction(maxA2, EGO_AGENT2);
      if (hasAgent3) this.syncytium.setExecutedAction(maxA3, EGO_AGENT3);

      this.syncytium.endTick();

      // Leave the harvester loaded. Telemetry reads per-fly registers off the
      // shared brains, so without this the panel would describe whichever fly
      // happened to be reinforced last, switching identity whenever a handshake
      // started or stopped.
      this.syncytium.loadEgo(EGO_AGENT1);

      return {
        agent1: {
          action: this.actionNames[maxA1],
          actionIndex: maxA1,
          probabilities: finalProbs1,
          regime: this.agent1.behavioralRegime,
          isStasis: this.agent1.isStasisHazard,
          isGFEscape: this.agent1.isGFEscape || false
        },
        agent2: {
          action: this.actionNames[maxA2],
          actionIndex: maxA2,
          probabilities: finalProbs2,
          regime: this.agent2.behavioralRegime,
          isStasis: this.agent2.isStasisHazard,
          isGFEscape: this.agent2.isGFEscape || false
        },
        agent3: hasAgent3 ? {
          action: this.actionNames[maxA3],
          actionIndex: maxA3,
          probabilities: finalProbs3,
          regime: this.agent3.behavioralRegime,
          isStasis: this.agent3.isStasisHazard,
          isGFEscape: this.agent3.isGFEscape || false
        } : null,
        peerDist,
        dist12,
        dist23,
        dist31,
        sunAngle: this.sunAngle,
        isAcousticHandshake,
        // In range but inside the refractory window: the UI can still show the
        // pair as paired without implying another bonus was paid.
        isHandshakeInRange: handshakeInRange,
        handshakeEvents: this.handshakeEvents,
        isTriSwarmResonance,
        isTriSwarmInRange: triSwarmInRange,
        triSwarmResonanceEvents: this.triSwarmResonanceEvents,
        beaconWaypoints: this.beaconWaypoints
      };
    }

    // Single-agent backward compatibility wrapper
    /**
     * @param {ArrayLike<number>} agentState
     * @param {Array<number>} agentActionLogits
     * @param {number} [novelty]
     * @param {number} [agentEnergy]
     * @param {{stepDx:number, stepDy:number}} [motion] - the fly's last actual
     *   step. Without it the heading falls back to the fly's bearing from the
     *   centre of the world, which is not a heading; pass it where you can.
     */
    resolveAction(agentState, agentActionLogits, novelty = 0, agentEnergy = 100, motion = null) {
      this._updateAgentRegime(this.agent1, agentState);
      const resolved = motion
        ? this._resolveHeading(this.agent1, motion.stepDx || 0, motion.stepDy || 0)
        : (() => {
          const bearing = Math.atan2(agentState[1] - 0.5, agentState[0] - 0.5);
          return { heading: bearing, angularVelocity: angleDelta(bearing, this.agent1.lastHeading) };
        })();
      const h1 = resolved.heading;
      const flyProbs = this.syncytium.step(
        agentState, resolved.angularVelocity, novelty, agentEnergy, null, EGO_AGENT1
      );
      this.agent1.lastHeading = h1;
      this.agent1.lastFlyProbabilities = flyProbs;

      const dynamicBeta = clamp(this.graftInfluence + (this.agent1.behavioralRegime === "EVADE" ? 0.25 : 0.1), 0.1, 0.95);
      const comb = [0, 0, 0, 0];
      for (let a = 0; a < 4; a++) {
        comb[a] = (1 - dynamicBeta) * agentActionLogits[a] + dynamicBeta * flyProbs[a];
      }
      const finalProbs = softmax(comb, 0.8);
      let maxIdx = 0;
      for (let a = 1; a < 4; a++) if (finalProbs[a] > finalProbs[maxIdx]) maxIdx = a;

      return {
        action: this.actionNames[maxIdx],
        actionIndex: maxIdx,
        probabilities: finalProbs,
        flyProbabilities: flyProbs,
        regime: this.agent1.behavioralRegime,
        gatingWeight: dynamicBeta
      };
    }

    /**
     * @param {number} reward
     * @param {boolean} hitHazard
     * @param {object|null} currentCoordinates
     * @param {string} [agentKey] - "agent1" | "agent2" | "agent3". Names the fly
     *   whose activations earned the outcome so credit lands on the synapses
     *   that actually drove the action. Defaults to the harvester.
     */
    feedback(reward, hitHazard, currentCoordinates = null, agentKey = EGO_AGENT1) {
      const rewardDelta = Math.max(0, reward);
      const hazardDelta = hitHazard ? 1.0 : (reward < 0 ? Math.abs(reward) : 0);
      this.syncytium.applyReinforcement(rewardDelta, hazardDelta, currentCoordinates, agentKey);
      // Restore the telemetry fly rather than leaving the credited one loaded.
      this.syncytium.loadEgo(EGO_AGENT1);
    }
  }

  // DiamondAgentGraft alias pointing to MultiAgentGraphGraft
  const DiamondAgentGraft = MultiAgentGraphGraft;

  // -------------------------------------------------------------
  // Resumable State Serialization & Persistence Engine
  // -------------------------------------------------------------
  class FlyBrainStateSerializer {
    static STORAGE_KEY = "diamond_sim_fly_brain_state_v7";

    /** Per-fly registers, as plain arrays, for the JSON document. */
    static _egoBankToJson(sync) {
      const bank = {};
      for (const [egoId, record] of sync.egoStates.entries()) {
        bank[egoId] = record.map(ego => ({
          scalars: Object.assign({}, ego.scalars),
          arrays: Object.fromEntries(Object.entries(ego.arrays).map(([k, v]) => [k, Array.from(v)])),
          born: Array.from(ego.born || [])
        }));
      }
      return bank;
    }

    static _egoBankFromJson(sync, bank) {
      if (!bank || typeof bank !== "object") return;
      sync.egoStates.clear();
      for (const egoId of Object.keys(bank)) {
        const saved = bank[egoId];
        if (!Array.isArray(saved)) continue;
        const record = sync._egoRecord(egoId);
        for (let i = 0; i < Math.min(record.length, saved.length); i++) {
          const src = saved[i];
          if (!src) continue;
          if (src.scalars) Object.assign(record[i].scalars, src.scalars);
          if (src.arrays) {
            for (const key of Object.keys(src.arrays)) {
              record[i].arrays[key] = Float32Array.from(src.arrays[key]);
            }
          }
          if (Array.isArray(src.born)) record[i].born = Float32Array.from(src.born);
        }
      }
    }

    static serialize(graft, extraAgentData = {}) {
      const sync = graft.syncytium;
      const stateObj = {
        version: "7.0.0",
        config: Object.assign({}, sync.config),
        tickCount: sync.tickCount || 0,
        lastActionIndex: sync.lastActionIndex,
        egoStates: FlyBrainStateSerializer._egoBankToJson(sync),
        timestamp: Date.now(),
        worldSeed: sync.worldSeed,
        prngDrawCount: sync.prng ? sync.prng.drawCount : 0,
        prngState: sync.prng ? sync.prng.getState() : null,
        neurogenesisPrngState: sync.neurogenesis.prng ? sync.neurogenesis.prng.getState() : null,
        neurogenesisBirthCounter: sync.neurogenesis.birthCounter || 0,
        graftInfluence: graft.graftInfluence,
        isPretrained: sync.isPretrained,
        pretrainingEpochs: sync.pretrainingEpochs,
        syncytiumSteps: sync.syncytiumSteps,
        circadianClock: sync.circadianClock || 0,
        sunAngle: graft.sunAngle || 0,
        mitosisEvents: sync.neurogenesis.mitosisCount,
        apoptosisEvents: sync.neurogenesis.apoptosisCount,
        stasisEvents: graft.stasisEvents || 0,
        handshakeEvents: graft.handshakeEvents || 0,
        handshakeCooldown: graft.handshakeCooldown || 0,
        triSwarmCooldown: graft.triSwarmCooldown || 0,
        triSwarmResonanceEvents: graft.triSwarmResonanceEvents || 0,
        giantFiberEvents: graft.giantFiberEvents || 0,
        beaconWaypoints: graft.beaconWaypoints || [],
        commissuralWeights: Array.from(sync.commissuralWeights),
        engramBank: sync.engramBank,
        lastRPE: sync.lastRPE,
        agents: {
          agent1: { regime: graft.agent1.behavioralRegime, dwell: graft.agent1.dwellTicks },
          agent2: { regime: graft.agent2.behavioralRegime, dwell: graft.agent2.dwellTicks },
          agent3: graft.agent3 ? { regime: graft.agent3.behavioralRegime, dwell: graft.agent3.dwellTicks } : null
        },
        extraAgentData,
        brains: sync.brains.map(b => ({
          id: b.id,
          role: b.role,
          compassHeading: b.compassHeading,
          dopaminePAM: b.dopaminePAM,
          dopaminePPL1: b.dopaminePPL1,
          octopamineOA: b.octopamineOA,
          serotonin5HT: b.serotonin5HT,
          metabolicSatiety: b.metabolicSatiety,
          neuropeptideNPF: b.neuropeptideNPF || 0,
          neuropeptideSIFamide: b.neuropeptideSIFamide || 0,
          lalFlipFlop: b.lalFlipFlop,
          vncTorque: b.vncTorque,
          ammcVibration: b.ammcVibration,
          pbPhaseShift: b.pbPhaseShift || 0,
          ebStabilization: b.ebStabilization || 0,
          noOdometryDistance: b.noOdometryDistance || 0,
          noHomeVector: b.noHomeVector ? Array.from(b.noHomeVector) : [0, 0],
          aotuSunHeading: b.aotuSunHeading || 0,
          aotuEVectorAlignment: b.aotuEVectorAlignment || 0,
          smpLatchedAction: b.smpLatchedAction || -1,
          alProjection: Array.from(b.alProjection),
          kcActivations: Array.from(b.kcActivations),
          mbonActivations: Array.from(b.mbonActivations),
          compassRing: Array.from(b.compassRing),
          kcToMbonWeights: Array.from(b.kcToMbonWeights),
          eligibilityTraces: Array.from(b.eligibilityTraces),
          opticMotionFlow: Array.from(b.opticMotionFlow),
          epgRing: Array.from(b.epgRing),
          ringAmplitude: b.ringAmplitude,
          ringCertainty: b.ringCertainty,
          aplActivity: b.aplActivity,
          kcSparsity: b.kcSparsity,
          lastActionIndex: b.lastActionIndex,
          bornNeurons: b.bornNeurons.map(n => ({
            id: n.id,
            age: n.age,
            maturity: n.maturity,
            activation: n.activation,
            weights: Array.from(n.weights),
            mbonWeights: Array.from(n.mbonWeights)
          }))
        }))
      };

      return JSON.stringify(stateObj);
    }

    static deserialize(graft, stateData) {
      const data = typeof stateData === "string" ? JSON.parse(stateData) : stateData;
      if (!data || !data.brains || data.brains.length < 5) {
        throw new Error("Invalid or incompatible fly brain state data");
      }

      graft.graftInfluence = data.graftInfluence !== undefined ? data.graftInfluence : 0.55;
      graft.stasisEvents = data.stasisEvents || 0;
      if (data.sunAngle !== undefined) graft.sunAngle = data.sunAngle;
      if (data.triSwarmResonanceEvents !== undefined) graft.triSwarmResonanceEvents = data.triSwarmResonanceEvents;
      if (data.giantFiberEvents !== undefined) graft.giantFiberEvents = data.giantFiberEvents;
      if (Array.isArray(data.beaconWaypoints)) graft.beaconWaypoints = data.beaconWaypoints;

      if (data.agents) {
        if (data.agents.agent1) {
          graft.agent1.behavioralRegime = data.agents.agent1.regime || "FORAGE";
          graft.agent1.dwellTicks = data.agents.agent1.dwell || 0;
        }
        if (data.agents.agent2) {
          graft.agent2.behavioralRegime = data.agents.agent2.regime || "PIONEER";
          graft.agent2.dwellTicks = data.agents.agent2.dwell || 0;
        }
        if (data.agents.agent3 && graft.agent3) {
          graft.agent3.behavioralRegime = data.agents.agent3.regime || "SCOUT";
          graft.agent3.dwellTicks = data.agents.agent3.dwell || 0;
        }
      }

      const sync = graft.syncytium;
      sync.worldSeed = data.worldSeed !== undefined ? data.worldSeed : 42;
      sync.prng = new MulberryPRNG(sync.worldSeed);
      if (data.prngState) {
        // v7+: exact stream position. Older files carry only a draw count,
        // which cannot place the stream, so they resume from the seed.
        sync.prng.setState(data.prngState);
      } else if (data.prngDrawCount) {
        sync.prng.drawCount = data.prngDrawCount;
      }
      if (data.neurogenesisPrngState) {
        sync.neurogenesis.prng.setState(data.neurogenesisPrngState);
      } else {
        sync.neurogenesis.prng = sync.prng.fork(1);
      }
      sync.neurogenesis.birthCounter = data.neurogenesisBirthCounter || 0;

      sync.syncytiumSteps = data.syncytiumSteps || 0;
      sync.tickCount = data.tickCount !== undefined ? data.tickCount : (data.syncytiumSteps || 0);
      if (data.lastActionIndex !== undefined) sync.lastActionIndex = data.lastActionIndex;
      if (data.config) {
        // Mechanism selection is part of the run: a file saved from the legacy
        // circuit must resume on the legacy circuit.
        sync.config = resolveConfig(data.config);
        for (const brain of sync.brains) brain.config = sync.config;
      }
      if (data.circadianClock !== undefined) sync.circadianClock = data.circadianClock;
      if (data.handshakeEvents !== undefined) graft.handshakeEvents = data.handshakeEvents;
      if (data.handshakeCooldown !== undefined) graft.handshakeCooldown = data.handshakeCooldown;
      if (data.triSwarmCooldown !== undefined) graft.triSwarmCooldown = data.triSwarmCooldown;
      sync.isPretrained = data.isPretrained || false;
      sync.pretrainingEpochs = data.pretrainingEpochs || 0;
      sync.neurogenesis.mitosisCount = data.mitosisEvents || 0;
      sync.neurogenesis.apoptosisCount = data.apoptosisEvents || 0;
      sync.lastRPE = data.lastRPE || 0;

      if (data.commissuralWeights && data.commissuralWeights.length === sync.commissuralWeights.length) {
        sync.commissuralWeights.set(data.commissuralWeights);
      }
      sync.engramBank = Array.isArray(data.engramBank) ? data.engramBank : [];

      const restoreCount = Math.min(sync.brains.length, data.brains.length);
      for (let i = 0; i < restoreCount; i++) {
        const bData = data.brains[i];
        const brain = sync.brains[i];
        brain.role = bData.role || brain.role;
        brain.compassHeading = bData.compassHeading || 0;
        brain.dopaminePAM = bData.dopaminePAM || 0;
        brain.dopaminePPL1 = bData.dopaminePPL1 || 0;
        brain.octopamineOA = bData.octopamineOA !== undefined ? bData.octopamineOA : 0.2;
        brain.serotonin5HT = bData.serotonin5HT !== undefined ? bData.serotonin5HT : 0.5;
        brain.metabolicSatiety = bData.metabolicSatiety !== undefined ? bData.metabolicSatiety : 1.0;
        if (bData.neuropeptideNPF !== undefined) brain.neuropeptideNPF = bData.neuropeptideNPF;
        if (bData.neuropeptideSIFamide !== undefined) brain.neuropeptideSIFamide = bData.neuropeptideSIFamide;
        brain.lalFlipFlop = bData.lalFlipFlop || 0;
        brain.vncTorque = bData.vncTorque !== undefined ? bData.vncTorque : 1.0;
        brain.ammcVibration = bData.ammcVibration || 0;
        if (bData.pbPhaseShift !== undefined) brain.pbPhaseShift = bData.pbPhaseShift;
        if (bData.ebStabilization !== undefined) brain.ebStabilization = bData.ebStabilization;
        if (bData.noOdometryDistance !== undefined) brain.noOdometryDistance = bData.noOdometryDistance;
        if (bData.noHomeVector) brain.noHomeVector = [bData.noHomeVector[0] || 0, bData.noHomeVector[1] || 0];
        if (bData.aotuSunHeading !== undefined) brain.aotuSunHeading = bData.aotuSunHeading;
        if (bData.aotuEVectorAlignment !== undefined) brain.aotuEVectorAlignment = bData.aotuEVectorAlignment;
        if (bData.smpLatchedAction !== undefined) brain.smpLatchedAction = bData.smpLatchedAction;

        if (bData.alProjection) brain.alProjection.set(bData.alProjection);
        if (bData.kcActivations) brain.kcActivations.set(bData.kcActivations);
        if (bData.mbonActivations) brain.mbonActivations.set(bData.mbonActivations);
        if (bData.compassRing) brain.compassRing.set(bData.compassRing);
        if (bData.kcToMbonWeights) brain.kcToMbonWeights.set(bData.kcToMbonWeights);
        if (bData.eligibilityTraces) brain.eligibilityTraces.set(bData.eligibilityTraces);
        if (bData.opticMotionFlow && brain.opticMotionFlow) brain.opticMotionFlow.set(bData.opticMotionFlow);
        if (bData.epgRing && brain.epgRing && brain.epgRing.length === bData.epgRing.length) {
          brain.epgRing.set(bData.epgRing);
        }
        if (bData.ringAmplitude !== undefined) brain.ringAmplitude = bData.ringAmplitude;
        if (bData.ringCertainty !== undefined) brain.ringCertainty = bData.ringCertainty;
        if (bData.aplActivity !== undefined) brain.aplActivity = bData.aplActivity;
        if (bData.kcSparsity !== undefined) brain.kcSparsity = bData.kcSparsity;
        if (bData.lastActionIndex !== undefined) brain.lastActionIndex = bData.lastActionIndex;

        brain.bornNeurons = (bData.bornNeurons || []).map(n => ({
          id: n.id,
          age: n.age,
          maturity: n.maturity,
          activation: n.activation,
          weights: new Float32Array(n.weights),
          mbonWeights: new Float32Array(n.mbonWeights)
        }));
      }

      FlyBrainStateSerializer._egoBankFromJson(sync, data.egoStates);

      return data.extraAgentData || {};
    }

    static saveToLocalStorage(graft, extraAgentData = {}) {
      try {
        if (typeof localStorage === "undefined") return false;
        const json = this.serialize(graft, extraAgentData);
        localStorage.setItem(this.STORAGE_KEY, json);
        return true;
      } catch (err) {
        console.warn("Could not save fly brain state to localStorage:", err);
        return false;
      }
    }

    /**
     * The saved JSON document, without deserialising it. Callers that want to
     * restore a run need the document itself: loadFromLocalStorage returns only
     * the caller's extra payload, which is not a snapshot and cannot be fed
     * back into deserialize.
     *
     * @returns {string|null}
     */
    static readRawFromLocalStorage() {
      try {
        if (typeof localStorage === "undefined") return null;
        for (const key of [
          this.STORAGE_KEY,
          "diamond_sim_fly_brain_state_v6",
          "diamond_sim_fly_brain_state_v5",
          "diamond_sim_fly_brain_state_v4"
        ]) {
          const json = localStorage.getItem(key);
          if (json) return json;
        }
        return null;
      } catch (err) {
        console.warn("Could not read fly brain state from localStorage:", err);
        return null;
      }
    }

    static loadFromLocalStorage(graft) {
      try {
        const json = this.readRawFromLocalStorage();
        if (!json) return null;
        return this.deserialize(graft, json);
      } catch (err) {
        console.warn("Could not load fly brain state from localStorage:", err);
        return null;
      }
    }

    static exportToFile(graft, extraAgentData = {}, filename = "fly_diamond_state.json") {
      const json = this.serialize(graft, extraAgentData);
      if (typeof document !== "undefined") {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      return json;
    }
  }

  // -------------------------------------------------------------
  // Public Exports
  // -------------------------------------------------------------
  return {
    DEFAULT_CONFIG,
    LEGACY_CONFIG,
    DESCENDING_GROUPS,
    resolveConfig,
    angleDelta,
    wrapAngle,
    MulberryPRNG,
    ChemicalFieldGrid,
    DrosophilaBrain,
    NeurogenesisEngine,
    PreTrainingEngine,
    SixteenFlyBrainSyncytium,
    ElevenFlyBrainSyncytium,
    EightFlyBrainSyncytium,
    SevenFlyBrainSyncytium,
    FiveFlyBrainSyncytium,
    MultiAgentGraphGraft,
    DiamondAgentGraft,
    FlyBrainStateSerializer
  };
});
