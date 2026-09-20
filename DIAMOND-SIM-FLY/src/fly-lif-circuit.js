/**
 * @file fly-lif-circuit.js
 * Leaky integrate-and-fire spiking circuits over a connectome-style graph.
 *
 * The rate-coded engine in fly-brain-engine.js answers "what does this circuit
 * compute". This module answers a different question -- "what happens when the
 * same wiring runs in spikes" -- using the neuron model applied to the whole
 * adult Drosophila brain by Shiu et al., A Drosophila computational brain model
 * reveals sensorimotor processing, Nature 634:210-219 (2024):
 *
 *   resting potential      -52 mV
 *   reset potential        -52 mV
 *   firing threshold       -45 mV
 *   membrane time constant  20 ms
 *   synaptic time constant   5 ms
 *   refractory period      2.2 ms
 *   spike -> PSP delay     1.8 ms
 *   weight per synapse   0.275 mV
 *
 * A connection's sign comes from the presynaptic neuron's transmitter, as in
 * that model: acetylcholine excites, while GABA and glutamate inhibit in
 * Drosophila. Integration here is explicit forward Euler at a caller-chosen
 * timestep, which is not the Brian2 integration used in the paper, so spike
 * timing is comparable in character rather than numerically identical.
 *
 * Everything is deterministic given a seed: stochastic drive is drawn from the
 * seeded generator in fly-brain-engine.js, never from Math.random.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./fly-brain-engine.js"));
  } else {
    root.FlyLifCircuit = factory(root.FlyBrainEngine);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (FlyBrainEngine) {
  "use strict";

  const { MulberryPRNG } = FlyBrainEngine;

  /** Shiu et al. (2024) neuron and synapse parameters, in mV and ms. */
  const LIF_PARAMS = Object.freeze({
    restingPotential: -52,
    resetPotential: -52,
    threshold: -45,
    membraneTau: 20,
    synapticTau: 5,
    refractoryPeriod: 2.2,
    propagationDelay: 1.8,
    weightPerSynapse: 0.275
  });

  /** Transmitter sign convention: ACh excitatory, GABA and glutamate inhibitory. */
  const TRANSMITTER_SIGN = Object.freeze({
    acetylcholine: 1,
    ach: 1,
    gaba: -1,
    glutamate: -1,
    glu: -1,
    dopamine: 0,
    octopamine: 0,
    serotonin: 0,
    unknown: 1
  });

  function transmitterSign(name) {
    const key = String(name || "unknown").toLowerCase();
    return TRANSMITTER_SIGN[key] !== undefined ? TRANSMITTER_SIGN[key] : 1;
  }

  class LIFConnectomeCircuit {
    /**
     * @param {object} spec
     * @param {Array<{id:string, transmitter?:string, group?:string}>} spec.neurons
     * @param {Array<{pre:string, post:string, synapses?:number}>} spec.connections
     * @param {number} [spec.dt] - integration step in ms (default 0.5)
     * @param {number|string} [spec.seed]
     * @param {object} [spec.params] - overrides for LIF_PARAMS
     */
    constructor(spec) {
      const {
        neurons, connections, dt = 0.5, seed = 1, params = null,
        backgroundNoise = 0
      } = spec;
      if (!Array.isArray(neurons) || neurons.length === 0) {
        throw new Error("LIFConnectomeCircuit requires at least one neuron");
      }

      this.params = Object.assign({}, LIF_PARAMS, params || {});
      this.dt = dt;
      this.prng = new MulberryPRNG(seed);
      this.stepIndex = 0;
      // Derived from the step index rather than accumulated, so a long run
      // cannot drift away from the true elapsed time.
      this.time = 0;
      /**
       * Per-neuron membrane noise, in mV per ms. Without it every neuron under
       * identical drive spikes on the identical timestep, so Kenyon-cell
       * recruitment depends only on how many claws are driven and sparseness
       * comes out quantized. Real projection neurons are not synchronous.
       * Draws come from the seeded generator, so runs stay reproducible.
       */
      this.backgroundNoise = backgroundNoise;

      this.neurons = neurons.map((n, index) => ({
        index,
        id: n.id !== undefined ? String(n.id) : `n${index}`,
        transmitter: n.transmitter || "acetylcholine",
        group: n.group || "unassigned"
      }));

      this.indexById = new Map(this.neurons.map(n => [n.id, n.index]));
      if (this.indexById.size !== this.neurons.length) {
        throw new Error("LIFConnectomeCircuit neuron ids must be unique");
      }

      const count = this.neurons.length;
      this.count = count;
      this.potential = new Float32Array(count).fill(this.params.restingPotential);
      this.synapticDrive = new Float32Array(count);
      this.refractoryUntil = new Float32Array(count).fill(-Infinity);
      this.spikeCounts = new Uint32Array(count);
      this.spiked = new Uint8Array(count);
      this.externalDrive = new Float32Array(count);

      // Flat CSR-style edge lists keep the inner loop allocation free.
      const edges = [];
      for (const c of connections || []) {
        const pre = this.indexById.get(String(c.pre));
        const post = this.indexById.get(String(c.post));
        if (pre === undefined || post === undefined) {
          throw new Error(`LIFConnectomeCircuit connection names an unknown neuron: ${c.pre} -> ${c.post}`);
        }
        const synapses = c.synapses === undefined ? 1 : c.synapses;
        const sign = transmitterSign(this.neurons[pre].transmitter);
        if (sign === 0 || synapses === 0) continue; // modulatory or empty: no direct PSP
        edges.push({ pre, post, weight: sign * this.params.weightPerSynapse * synapses });
      }
      edges.sort((a, b) => a.pre - b.pre || a.post - b.post);

      this.edgePost = new Int32Array(edges.length);
      this.edgeWeight = new Float32Array(edges.length);
      this.edgeStart = new Int32Array(count + 1);
      let cursor = 0;
      for (let n = 0; n < count; n++) {
        this.edgeStart[n] = cursor;
        while (cursor < edges.length && edges[cursor].pre === n) {
          this.edgePost[cursor] = edges[cursor].post;
          this.edgeWeight[cursor] = edges[cursor].weight;
          cursor++;
        }
      }
      this.edgeStart[count] = cursor;
      this.edgeCount = edges.length;

      // Delay line: postsynaptic drive arrives propagationDelay ms after a
      // spike, quantised to the timestep. effectiveDelay is what the circuit
      // actually applies; a finer dt brings it closer to the parameter.
      this.delaySlots = Math.max(1, Math.round(this.params.propagationDelay / this.dt));
      this.effectiveDelay = this.delaySlots * this.dt;
      this.delayBuffer = [];
      for (let i = 0; i < this.delaySlots; i++) this.delayBuffer.push(new Float32Array(count));
      this.delayCursor = 0;
    }

    groupIndices(group) {
      return this.neurons.filter(n => n.group === group).map(n => n.index);
    }

    /**
     * Hold a constant depolarising current on the named neurons, in mV per ms.
     * This is the model's stand-in for driving sensory neurons directly.
     */
    setDrive(ids, mvPerMs) {
      for (const id of Array.isArray(ids) ? ids : [ids]) {
        const index = typeof id === "number" ? id : this.indexById.get(String(id));
        if (index === undefined) throw new Error(`unknown neuron: ${id}`);
        this.externalDrive[index] = mvPerMs;
      }
      return this;
    }

    clearDrive() {
      this.externalDrive.fill(0);
      return this;
    }

    /** Advance one timestep. Returns the indices that spiked. */
    step() {
      const p = this.params;
      const dt = this.dt;
      const arriving = this.delayBuffer[this.delayCursor];

      // Deliver PSPs scheduled for now, then decay the synaptic trace.
      const decay = Math.exp(-dt / p.synapticTau);
      for (let n = 0; n < this.count; n++) {
        this.synapticDrive[n] = this.synapticDrive[n] * decay + arriving[n];
        arriving[n] = 0;
      }

      const fired = [];
      const leak = dt / p.membraneTau;
      for (let n = 0; n < this.count; n++) {
        this.spiked[n] = 0;
        if (this.time < this.refractoryUntil[n]) {
          this.potential[n] = p.resetPotential;
          continue;
        }
        const v = this.potential[n];
        const noise = this.backgroundNoise > 0
          ? this.backgroundNoise * (this.prng.next() * 2 - 1)
          : 0;
        const next = v + leak * (p.restingPotential - v)
          + dt * (this.synapticDrive[n] / p.synapticTau)
          + dt * (this.externalDrive[n] + noise);
        if (next >= p.threshold) {
          this.potential[n] = p.resetPotential;
          this.refractoryUntil[n] = this.time + p.refractoryPeriod;
          this.spikeCounts[n]++;
          this.spiked[n] = 1;
          fired.push(n);
        } else {
          this.potential[n] = next;
        }
      }

      // Schedule this step's spikes into the delay line. The slot just drained
      // above is the one read delaySlots steps from now, which is the full
      // delay; writing one slot earlier would deliver a step too soon.
      const target = arriving;
      for (const n of fired) {
        const end = this.edgeStart[n + 1];
        for (let e = this.edgeStart[n]; e < end; e++) {
          target[this.edgePost[e]] += this.edgeWeight[e];
        }
      }

      this.delayCursor = (this.delayCursor + 1) % this.delaySlots;
      this.stepIndex++;
      this.time = this.stepIndex * dt;
      return fired;
    }

    /** Run for a duration in ms. Returns spike counts accumulated over that window. */
    run(durationMs) {
      const before = Uint32Array.from(this.spikeCounts);
      const steps = Math.max(1, Math.round(durationMs / this.dt));
      for (let i = 0; i < steps; i++) this.step();
      const window = new Uint32Array(this.count);
      for (let n = 0; n < this.count; n++) window[n] = this.spikeCounts[n] - before[n];
      return window;
    }

    /** Firing rates in Hz over a window of spike counts. */
    static ratesFrom(counts, durationMs) {
      const seconds = durationMs / 1000;
      return Array.from(counts, c => (seconds > 0 ? c / seconds : 0));
    }

    /** Mean firing rate in Hz for one group over a counts window. */
    groupRate(counts, group, durationMs) {
      const indices = this.groupIndices(group);
      if (indices.length === 0 || durationMs <= 0) return 0;
      let total = 0;
      for (const i of indices) total += counts[i];
      return total / indices.length / (durationMs / 1000);
    }

    reset() {
      this.potential.fill(this.params.restingPotential);
      this.synapticDrive.fill(0);
      this.refractoryUntil.fill(-Infinity);
      this.spikeCounts.fill(0);
      this.spiked.fill(0);
      this.externalDrive.fill(0);
      for (const slot of this.delayBuffer) slot.fill(0);
      this.delayCursor = 0;
      this.stepIndex = 0;
      this.time = 0;
      return this;
    }
  }

  /**
   * Build the spiking counterpart of the rate model's mushroom body:
   * glomerular projection neurons diverge sparsely onto Kenyon cells, Kenyon
   * cells converge onto output neurons, and one GABAergic APL neuron closes an
   * all-to-all feedback loop over the Kenyon cell population.
   *
   * @param {object} [options]
   * @returns {LIFConnectomeCircuit}
   */
  function buildMushroomBodyCircuit(options = {}) {
    const {
      glomeruli = 14,
      kenyonCells = 64,
      outputNeurons = 4,
      claws = 4,
      seed = 7,
      dt = 0.5,
      // Calibrated so that a Kenyon cell needs several coincident claws rather
      // than one, which is what makes the representation sparse, and so that
      // output rates land in the tens of Hz. Sparseness in this reduced circuit
      // is looser than in the animal because 4 claws out of 14 glomeruli
      // oversamples relative to the fly's roughly 7 of 58; passing
      // {glomeruli: 58, claws: 7, kenyonCells: 160} reproduces that ratio and
      // the active fraction falls accordingly.
      pnToKcSynapses = 10,
      kcToMbonSynapses = 2,
      aplFeedbackSynapses = 6,
      kcToAplSynapses = 3,
      backgroundNoise = 0.9,
      params = null
    } = options;

    const prng = new MulberryPRNG(seed);
    const neurons = [];
    const connections = [];

    for (let g = 0; g < glomeruli; g++) {
      neurons.push({ id: `pn${g}`, transmitter: "acetylcholine", group: "pn" });
    }
    for (let k = 0; k < kenyonCells; k++) {
      neurons.push({ id: `kc${k}`, transmitter: "acetylcholine", group: "kc" });
    }
    for (let m = 0; m < outputNeurons; m++) {
      neurons.push({ id: `mbon${m}`, transmitter: "glutamate", group: "mbon" });
    }
    neurons.push({ id: "apl", transmitter: "gaba", group: "apl" });

    // Each Kenyon cell samples a few glomeruli at random, which is the claw
    // structure that makes the representation sparse and high dimensional.
    for (let k = 0; k < kenyonCells; k++) {
      const chosen = new Set();
      while (chosen.size < Math.min(claws, glomeruli)) chosen.add(prng.int(glomeruli));
      for (const g of chosen) {
        connections.push({ pre: `pn${g}`, post: `kc${k}`, synapses: pnToKcSynapses });
      }
      connections.push({ pre: `kc${k}`, post: "apl", synapses: kcToAplSynapses });
      connections.push({ pre: "apl", post: `kc${k}`, synapses: aplFeedbackSynapses });
      for (let m = 0; m < outputNeurons; m++) {
        connections.push({ pre: `kc${k}`, post: `mbon${m}`, synapses: kcToMbonSynapses });
      }
    }

    return new LIFConnectomeCircuit({ neurons, connections, dt, seed, params, backgroundNoise });
  }

  return {
    LIF_PARAMS,
    TRANSMITTER_SIGN,
    transmitterSign,
    LIFConnectomeCircuit,
    buildMushroomBodyCircuit
  };
});
