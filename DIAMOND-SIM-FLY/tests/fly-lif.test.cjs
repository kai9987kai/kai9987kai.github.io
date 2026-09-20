const test = require("node:test");
const assert = require("node:assert/strict");
const Lif = require("../src/fly-lif-circuit.js");

const { LIF_PARAMS, transmitterSign, LIFConnectomeCircuit, buildMushroomBodyCircuit } = Lif;

// ─────────────────────────────────────────────────────────────────────────────
// Neuron model
// ─────────────────────────────────────────────────────────────────────────────
test("parameters match the published whole-brain leaky integrate-and-fire model", () => {
  assert.equal(LIF_PARAMS.restingPotential, -52);
  assert.equal(LIF_PARAMS.resetPotential, -52);
  assert.equal(LIF_PARAMS.threshold, -45);
  assert.equal(LIF_PARAMS.membraneTau, 20);
  assert.equal(LIF_PARAMS.synapticTau, 5);
  assert.equal(LIF_PARAMS.refractoryPeriod, 2.2);
  assert.equal(LIF_PARAMS.propagationDelay, 1.8);
  assert.equal(LIF_PARAMS.weightPerSynapse, 0.275);
});

test("transmitter identity sets the sign of a connection", () => {
  assert.equal(transmitterSign("acetylcholine"), 1);
  assert.equal(transmitterSign("GABA"), -1);
  assert.equal(transmitterSign("glutamate"), -1);
  assert.equal(transmitterSign("dopamine"), 0, "modulators carry no direct PSP");
  assert.equal(transmitterSign(undefined), 1, "unknown transmitters default to excitatory");
});

test("an unconnected neuron rests at the resting potential and does not fire", () => {
  const circuit = new LIFConnectomeCircuit({
    neurons: [{ id: "a" }],
    connections: []
  });
  circuit.run(200);
  assert.equal(circuit.spikeCounts[0], 0);
  assert.ok(Math.abs(circuit.potential[0] - LIF_PARAMS.restingPotential) < 1e-3);
});

test("sustained drive produces spikes and the refractory period caps the rate", () => {
  const circuit = new LIFConnectomeCircuit({
    neurons: [{ id: "a" }],
    connections: [],
    dt: 0.1
  });
  circuit.setDrive(["a"], 50);
  const counts = circuit.run(1000);
  const rate = counts[0];
  const ceiling = 1000 / LIF_PARAMS.refractoryPeriod;
  assert.ok(rate > 50, `drive should evoke spiking, saw ${rate} in 1 s`);
  assert.ok(rate <= ceiling, `rate ${rate} Hz must respect the ${ceiling.toFixed(0)} Hz refractory ceiling`);
});

test("drive below the threshold current never reaches threshold", () => {
  // Steady state is rest + drive * membraneTau; 0.3 mV/ms lands at -46 mV.
  const circuit = new LIFConnectomeCircuit({ neurons: [{ id: "a" }], connections: [], dt: 0.1 });
  circuit.setDrive(["a"], 0.3);
  circuit.run(2000);
  assert.equal(circuit.spikeCounts[0], 0, "subthreshold drive must stay subthreshold");
  assert.ok(circuit.potential[0] > -47 && circuit.potential[0] < LIF_PARAMS.threshold);
});

test("an excitatory spike depolarises its target only after the propagation delay", () => {
  const circuit = new LIFConnectomeCircuit({
    neurons: [
      { id: "pre", transmitter: "acetylcholine" },
      { id: "post", transmitter: "acetylcholine" }
    ],
    connections: [{ pre: "pre", post: "post", synapses: 20 }],
    dt: 0.2
  });
  circuit.setDrive(["pre"], 40);

  let firstPreSpike = -1;
  let firstPostChange = -1;
  for (let i = 0; i < 200; i++) {
    const before = circuit.potential[1];
    circuit.step();
    if (firstPreSpike < 0 && circuit.spiked[0]) firstPreSpike = circuit.time;
    if (firstPostChange < 0 && circuit.potential[1] > before + 1e-6) firstPostChange = circuit.time;
    if (firstPreSpike >= 0 && firstPostChange >= 0) break;
  }
  assert.ok(firstPreSpike > 0, "the driven neuron must spike");
  // Exactly the quantised delay: a slack of one timestep here would hide an
  // off-by-one in the delay line, which is where one was hiding.
  assert.ok(
    Math.abs(circuit.effectiveDelay - LIF_PARAMS.propagationDelay) < 1e-9,
    "1.8 ms lands exactly on a 0.2 ms grid"
  );
  assert.ok(
    Math.abs((firstPostChange - firstPreSpike) - circuit.effectiveDelay) < 1e-9,
    `target depolarised ${(firstPostChange - firstPreSpike).toFixed(2)} ms after the spike, expected ${circuit.effectiveDelay}`
  );
});

test("a finer timestep brings the propagation delay closer to the parameter", () => {
  const coarse = new LIFConnectomeCircuit({ neurons: [{ id: "a" }], connections: [], dt: 1.0 });
  const fine = new LIFConnectomeCircuit({ neurons: [{ id: "a" }], connections: [], dt: 0.1 });
  assert.equal(coarse.effectiveDelay, 2.0);
  assert.ok(Math.abs(fine.effectiveDelay - LIF_PARAMS.propagationDelay) < 1e-9);
});

test("an inhibitory presynaptic neuron hyperpolarises its target", () => {
  const build = transmitter => {
    const circuit = new LIFConnectomeCircuit({
      neurons: [{ id: "pre", transmitter }, { id: "post", transmitter: "acetylcholine" }],
      connections: [{ pre: "pre", post: "post", synapses: 20 }],
      dt: 0.2
    });
    circuit.setDrive(["pre"], 40);
    circuit.setDrive(["post"], 0.8);
    circuit.run(400);
    return circuit.spikeCounts[1];
  };
  assert.ok(
    build("gaba") < build("acetylcholine"),
    "a GABAergic input must suppress the target relative to a cholinergic one"
  );
});

test("reset returns every neuron to rest and clears the delay line", () => {
  const circuit = buildMushroomBodyCircuit();
  circuit.setDrive(["pn0", "pn1"], 1.6);
  circuit.run(100);
  assert.ok(circuit.spikeCounts.some(c => c > 0));

  circuit.reset();
  assert.equal(circuit.time, 0);
  assert.ok(circuit.spikeCounts.every(c => c === 0));
  assert.ok(Array.from(circuit.potential).every(v => Math.abs(v - LIF_PARAMS.restingPotential) < 1e-6));
  circuit.run(100);
  assert.equal(circuit.spikeCounts.reduce((a, b) => a + b, 0), 0, "a reset circuit has no drive left");
});

test("a connection naming an unknown neuron is rejected rather than ignored", () => {
  assert.throws(
    () => new LIFConnectomeCircuit({ neurons: [{ id: "a" }], connections: [{ pre: "a", post: "ghost" }] }),
    /unknown neuron/
  );
  assert.throws(
    () => new LIFConnectomeCircuit({ neurons: [{ id: "a" }, { id: "a" }], connections: [] }),
    /unique/
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Spiking mushroom body
// ─────────────────────────────────────────────────────────────────────────────
function puff(options, drivenGlomeruli, puffMs = 60) {
  const circuit = buildMushroomBodyCircuit(options);
  circuit.run(40); // settle
  circuit.setDrive(drivenGlomeruli.map(i => `pn${i}`), 1.6);
  const counts = circuit.run(puffMs);
  const kenyon = circuit.groupIndices("kc");
  return {
    circuit,
    counts,
    kenyonCounts: kenyon.map(i => counts[i]),
    activeFraction: kenyon.filter(i => counts[i] > 0).length / kenyon.length,
    mbonRate: circuit.groupRate(counts, "mbon", puffMs),
    aplRate: circuit.groupRate(counts, "apl", puffMs)
  };
}

test("the spiking mushroom body propagates odour drive from glomeruli to output neurons", () => {
  const driven = puff({}, [0, 1, 2, 3]);
  assert.ok(driven.aplRate > 0, "APL must be recruited by Kenyon cell activity");
  assert.ok(driven.mbonRate > 0, "output neurons must respond to an odour");
  assert.ok(driven.mbonRate < 200, `output rate ${driven.mbonRate.toFixed(0)} Hz should stay physiological`);

  const silent = puff({}, []);
  assert.equal(silent.mbonRate, 0, "with no odour there should be no output spiking");
});

test("APL feedback sparsens the Kenyon cell code", () => {
  const withApl = puff({ aplFeedbackSynapses: 6 }, [0, 1, 2, 3]);
  const withoutApl = puff({ aplFeedbackSynapses: 0 }, [0, 1, 2, 3]);
  assert.ok(
    withApl.activeFraction < withoutApl.activeFraction,
    `APL should reduce the active fraction, saw ${withApl.activeFraction} vs ${withoutApl.activeFraction}`
  );
  assert.ok(withApl.mbonRate < withoutApl.mbonRate, "sparser input must lower output drive");
});

test("the sampling ratio, not the circuit size, sets how sparse the code can get", () => {
  // The fly samples about 7 of 58 glomeruli per Kenyon cell. The reduced default
  // circuit oversamples, so it cannot be as sparse; restoring the ratio restores
  // the sparseness.
  const reduced = puff({ aplFeedbackSynapses: 6 }, [0, 1, 2, 3]);
  const realistic = puff(
    { glomeruli: 58, claws: 7, kenyonCells: 160, pnToKcSynapses: 10, kcToMbonSynapses: 1, aplFeedbackSynapses: 6 },
    [0, 1, 2, 3, 4, 5, 6, 7]
  );
  assert.ok(
    realistic.activeFraction < reduced.activeFraction,
    `realistic sampling should be sparser, saw ${realistic.activeFraction} vs ${reduced.activeFraction}`
  );
  assert.ok(realistic.activeFraction < 0.35, "with fly-like sampling the code should be clearly sparse");
});

test("different odours recruit different Kenyon cells", () => {
  const a = puff({}, [0, 1, 2, 3]);
  const c = puff({}, [8, 9, 10, 11]);
  const shared = a.kenyonCounts.filter((v, i) => v > 0 && c.kenyonCounts[i] > 0).length;
  const activeA = a.kenyonCounts.filter(v => v > 0).length;
  assert.ok(activeA > 0);
  assert.ok(
    shared < activeA,
    "two odours sharing no glomeruli must not recruit an identical Kenyon cell set"
  );
});

test("the spiking circuit is reproducible from its seed", () => {
  const first = puff({ seed: 21 }, [0, 1, 2, 3]);
  const second = puff({ seed: 21 }, [0, 1, 2, 3]);
  assert.deepEqual(first.kenyonCounts, second.kenyonCounts, "identical seeds must give identical spikes");

  const other = puff({ seed: 22 }, [0, 1, 2, 3]);
  assert.notDeepEqual(first.kenyonCounts, other.kenyonCounts, "a different seed must change the wiring");
});

test("membrane noise is what desynchronises the population", () => {
  // Fraction of spikes that land on a timestep where every driven projection
  // neuron fires together. Identical drive with no noise gives perfect lockstep,
  // which quantises how many Kenyon cells can be recruited.
  const cospikeFraction = backgroundNoise => {
    const circuit = buildMushroomBodyCircuit({ backgroundNoise });
    const driven = [0, 1, 2, 3];
    circuit.setDrive(driven.map(i => `pn${i}`), 1.6);
    const indices = driven.map(i => circuit.indexById.get(`pn${i}`));
    let together = 0;
    let anySpikeSteps = 0;
    const steps = Math.round(400 / circuit.dt);
    for (let t = 0; t < steps; t++) {
      circuit.step();
      const firing = indices.filter(i => circuit.spiked[i]).length;
      if (firing > 0) {
        anySpikeSteps++;
        if (firing === indices.length) together++;
      }
    }
    return anySpikeSteps > 0 ? together / anySpikeSteps : 0;
  };

  assert.equal(cospikeFraction(0), 1, "without noise, identically driven neurons spike in lockstep");
  assert.ok(cospikeFraction(0.9) < 0.5, "noise must break the lockstep");
});
