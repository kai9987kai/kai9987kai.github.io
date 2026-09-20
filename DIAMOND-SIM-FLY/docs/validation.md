# Validation and measured improvement

## Fly Lab: upgraded circuits versus the legacy ones

Three circuits in the Fly Lab carried the name of a fly structure without its mechanism, and the descending vote treated all sixteen neuropils as equals. Each replacement is selectable, so the comparison is against the code it replaced rather than against nothing. The [raw receipt](benchmarks/connectome-upgrade.json) records source SHA-256 hashes, the seed set, every per-seed episode and the bootstrap settings.

Protocol: seeds 1001 to 2388 in steps of 73, 200 steps per episode, a 16×16 arena with 8 diamonds and 4 hazards, every arm on the same seeds. Intervals are paired percentile bootstrap over seed-level differences, 2,000 resamples, bootstrap seed 20260912.

### One of the four mechanisms is not comparable to what it replaced

The legacy compass adds the caller's angular velocity to a scalar. Every caller derives that velocity from the direction the fly actually travelled, so the legacy mode hands the network its own heading, exactly and without drift — measured worst error against ground truth, 0.0000°. It is not a model of a compass; it is the answer. The ring attractor has to estimate heading from turns alone and drifts, as continuous attractors and real flies in the dark both do.

So "upgraded versus legacy" as a bundle measures mostly "does free heading help", and the answer is obviously yes. The comparison worth reporting holds the compass constant. Over 40 seeds:

| Comparison | Upgraded | Legacy | Difference | 95% interval | P(improvement) | Clears zero |
| --- | ---: | ---: | ---: | --- | ---: | --- |
| APL + dopamine-gated LTD + gating, ring-attractor compass | 122.0 | 99.0 | +22.95 | [−9.2, +56.0] | 0.60 | no |
| APL + dopamine-gated LTD + gating, oracle compass | 267.0 | 224.3 | +42.75 | [−5.7, +88.6] | 0.65 | no |
| Ring attractor versus the oracle compass, everything else equal | 122.0 | 267.0 | −145.00 | [−189.3, −101.7] | 0.16 | **yes** |

**The three non-compass mechanisms point positive and are inconclusive.** Both intervals straddle zero across 40 seeds, so this is not evidence that they improve task score; it is evidence that they do not cost any, while implementing the mechanisms they are named after. **Estimating heading instead of being given it costs 145 net score**, decisively — which is a statement about the benchmark's baseline, not about the attractor being wrong.

### Every arm, 20 seeds

| Arm | Net score | IQM | Diamonds | Hazards | Cells seen | Win share |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RandomWalk | 21.80 | 11.0 | 1.75 | 1.15 | 51.45 | 0.0% |
| SingleBrain_AL | 283.60 | 179.3 | 11.10 | 0 | 45.00 | 41.3% |
| CentralComplex_8B | 130.15 | 99.5 | 5.05 | 0 | 29.45 | 6.3% |
| Syncytium_16B_Legacy (oracle compass) | 232.60 | 219.2 | 8.70 | 0 | 85.65 | 38.8% |
| Syncytium_16B | 144.45 | 142.6 | 5.55 | 0 | 48.85 | 13.8% |

Read with the oracle in mind: the legacy arm's 232.60 is achieved with free heading. A single Antennal Lobe brain scores 283.60 without one, which is the more interesting comparison and the one that still has no good answer — sixteen coupled neuropils do not beat one in this arena, and closing that gap is the clearest piece of work left. Nothing here should be read as evidence that they do.

### Corrections to earlier revisions of this page

Two earlier figures for this comparison were wrong, and both are worth recording because they show what the measurements were hiding:

- **+95.85** was measured while the ring attractor silently reversed for turns of half a circle — every direction reversal on a four-direction grid — and while the single-brain arm's plasticity was a no-op, so that arm never learned.
- **+30.65** was measured after those fixes but before offline pre-training was repaired. Pre-training was drawing all fourteen sensory channels from a uniform distribution with the four bearing channels pinned to zero, conditioning the mushroom body on statistics it never sees, and clamping every AL→KC synapse up to a floor, which took claws per Kenyon cell from 3.5 to 7.7 and destroyed the sparse code the architecture depends on. Measured over 40 seeds, that cost **51.60 net score against not pre-training at all**, 95% interval [+24.32, +78.70]. With samples drawn from the sensory contract instead, and silent synapses left silent, pre-training is now neutral: **−4.70**, 95% interval [−1.83, +12.82], straddling zero.

Neither figure survived contact with a fixed protocol and a corrected code path, which is the argument for reporting intervals and raw per-seed observations rather than means.

### Mechanism measurements

Each replaced circuit was measured directly, and the numbers are asserted in `tests/fly-brain-upgrades.test.cjs` and `tests/fly-lif.test.cjs` so they cannot drift silently.

| Mechanism | Measurement |
| --- | --- |
| E-PG ring attractor | Angular-velocity gain 0.99–1.01 over ±0.4 rad per tick and within ±50% out to ±3.14; heading held within 0.15 rad over 60 idle ticks; a 0.045 anchor on a fixed reference cuts accumulated drift from 0.17 rad to 0.004 rad over 300 wobbly ticks, and does not drag the bump across the ring. A turn of exactly half a circle is direction-ambiguous and is resolved consistently; the two choices reach the same heading. The compass drifts, which is what distinguishes it from being told the answer. |
| Celestial anchoring | Only a reference that holds still stabilises a compass. Anchoring to the circadian sun angle, which sweeps a full circle every period, is measurably worse than not anchoring at all; the graft now supplies a fixed per-world sky azimuth alongside it. |
| Offline pre-training | Preserves claws per Kenyon cell (3.5 before and after) while strengthening them, and leaves the clock and every per-fly register where a fresh syncytium would have them. |
| APL feedback inhibition | Active Kenyon cells 18.8% at weak drive, 15.6% at mid, 6.3% at 15× drive, with APL activity rising in step. The legacy top-k mode gives the identical fraction at every drive, by construction. |
| Dopamine-gated depression | Punishment depresses the taken channel; reward leaves the taken channel stronger relative to every alternative; with dopamine silent, depressed synapses recover toward baseline. |
| Descending gating | Threat raises the reflex group's share and lowers exploration's; a gradient raises the goal group's; hunger amplifies a weak gradient; total descending weight is conserved to within 1e-3. |
| Spiking mushroom body | APL engaged takes active Kenyon cells from 64% to 36% in the reduced circuit, and to 21% at the fly's claw-to-glomerulus ratio. Refractory ceiling respected; PSP arrival respects the 1.8 ms delay. |

### Defects found by measuring

Most of these surfaced only by driving the app and by reporting per-seed statistics instead of means.

| Defect | Effect before the fix |
| --- | --- |
| Heading derived from bearing from world centre, not travel direction | Agents drove into the nearest wall and stayed. Fixing it took the app's legacy configuration from 0.7 to 4.0 mean diamonds and 34 to 118 cells visited. |
| `resolveAgents` never checked move legality | A fly facing a wall stood still, accrued dwell ticks and was penalised for stasis it could not avoid. |
| Social resonance paid every tick it was in range | Huddling out-earned foraging: 65% of ticks in resonance with energy pinned near maximum. Now rate-limited below the metabolic cost of a tick. |
| Win rate awarded ties to the first arm listed | `RandomWalk` was listed first. |
| Neurogenesis drew from `Math.random`, snapshots restored a draw count but not generator state | The same world seed grew different Kenyon cells on every run, and a resumed run silently diverged. |
| The ring attractor's rotation wrapped past half a turn | A direction reversal, which is exactly half a turn and the commonest event on a four-direction grid, ran the compass backwards: measured gain −0.89 at π. |
| A brain used outside a syncytium was never told which action it took | The dopamine-gated rule treats "no action" as "every channel was taken", so the update carried no direction and the `SingleBrain_AL` arm did not learn at all. Its score went from 161.00 to 283.60 once fixed. |
| Plasticity credited the syncytium's own argmax | The executed action can differ after policy mixing, the legality filter or a commitment latch. Measured at 12% of ticks: those punishments depressed a channel the fly never used. |
| The value estimate behind the prediction error was a single shared scalar | One fly's outcome was scored against another fly's estimate of its situation. |
| A new fly inherited the previous one's Kenyon-cell activations | The pristine record was captured before any neurons existed, so the restore loop copied nothing and left the previous fly's activity in place. |
| The spike-to-PSP delay line was written one slot early | Postsynaptic potentials arrived 1.5 ms after a spike instead of the documented 1.8 ms, and the test's one-timestep slack hid it. |
| Telemetry read per-fly registers off the shared brains | The Circuit Mechanisms panel silently switched which individual it was describing whenever a handshake started or stopped. |

## Frozen original comparison

The recorded [raw receipt](benchmarks/original-vs-v3.json) compares the unchanged original World Lab at `3abf50785a178e1f78e216cc10dce66928ce0760` with the current full core. It records source SHA-256 hashes, runtime, parameters, per-seed initial-state hashes and raw outcomes.

Protocol fixed before running: seeds 1–20, two agents, 300 ticks per run, default shared learning/world settings, beam planner for the candidate. All 20 pairs began from identical common simulation state, including model arrays and normalized RNG state. The final comparison was rerun after the energy-depletion and open-border planning fixes. No settings were tuned after inspecting this comparison.

| Mean metric | Original | Updated |
| --- | ---: | ---: |
| Cumulative extrinsic reward per agent | 145.4488 | 149.5952 |
| Cells sensed per agent | 8.3486% | 15.7472% |
| Respawns per run | 3.05 | 1.05 |
| Hazard hits per run | 0.15 | 0.15 |
| Collisions per run | 0 | 0 |
| Whole-grid model MAE | 2.4136 | 2.2167 |
| Remaining energy per agent | 45.755 | 63.280 |

The primary reward difference is **+4.1464 per agent**, with a 95% paired percentile bootstrap interval of **[+0.7665, +7.5405]** (2,000 resamples; bootstrap seed 20260912). This supports a reward advantage for this configuration. It evaluates the complete update, so it does not isolate beam search from the other correctness changes.

The seed set is a convenience sample, and some individual seeds favor the original. This is not a held-out multi-task benchmark or proof of superiority on every setting or metric. The original runs in a Node VM while the candidate uses CommonJS; recorded timings therefore cannot establish a speedup. Nexus is excluded from this reward comparison.

Reproduce with `npm run benchmark:original`. The script requires the original commit in local Git history and writes a fresh receipt to `output/comparison-original.json`. If core source hashes change, the checked-in receipt describes the recorded version until re-run.

## Planner-only comparisons

The first preliminary within-current-core comparisons used seeds 11, 29, 47, 71 and 101; 150 ticks; two agents; unchanged defaults. These compare strategies with the same surrounding fixes, unlike the frozen-version experiment above.

| Baseline | Beam minus baseline reward per agent | 95% paired interval |
| --- | ---: | --- |
| Original shooting planner | +2.0251 | −4.4564 to +11.7063 |
| Greedy + Q | +4.8262 | +0.6593 to +11.9120 |
| Random legal actions | +13.7274 | +6.6472 to +22.3298 |

The shooting-planner comparison was inconclusive and beam had +0.2 hazard hits per run in this small sample. The product retains the original planner and exposes these tradeoffs instead of selecting a universal winner.

## Regression and browser checks

Current working version: **153/154 Node tests pass** (the optional TensorFlow download test is skipped offline), and **38 Chromium browser checks pass**. The Nexus browser section needs `cdn.jsdelivr.net` for TensorFlow.js and Chart.js; where there is no route to it the suite reports that section as skipped and never as passed. JavaScript syntax, local asset and HTML ID checks pass.

Test coverage added for the Fly Lab: `tests/fly-brain-upgrades.test.cjs` (determinism, exact resume, one tick per environment step, per-fly register isolation, credit assignment, the ring attractor, APL sparseness, dopamine-gated depression, descending gating, heading from motion, legal moves, the social refractory and the snapshot contract), `tests/fly-lif.test.cjs` (the spiking neuron model) and `tests/connectome-stats.test.cjs` (the statistics and the benchmark runner's contract).

Historical figures for the previous version follow.

Earlier checks on the pre-Fly-Lab version: **40/40 tests passed** with the real TensorFlow smoke enabled, and **35/35 Chromium browser checks passed**. JavaScript syntax/local asset/HTML ID checks and `git diff --check` passed. The installed web-game client also produced valid state and inspected screenshots. Default offline tests skip only the optional TensorFlow download test.

`npm test` covers deterministic seeded behavior, low-energy planning, correct prediction residuals, exact save/resume across reward pulses and respawns, all planners, truncated history, malformed snapshots, bootstrap reproducibility, equal budgets, cooperative cancellation and Nexus lifecycle behavior.

The optional `NEXUS_TF_SMOKE=1` test uses the actual pinned TensorFlow.js CPU runtime to train a policy and check tensor ownership during evolution, reset and checkpoint replacement. Default offline tests skip this network-dependent check.

`npm run test:browser` checks both apps with actual Chromium and CDN libraries, World Lab direct-file loading, strategy/model/chart controls, precise snapshot parameters, upload/download, invalid import preservation, duplicate animation prevention, swarm labels, isolated experiments, JSON/CSV results, cancellation and desktop/mobile width. Screenshots are inspected separately for layout and visible behavior.

World Lab rendering now occurs once per live batch rather than every logical step. Live batches stop after their time budget; this is an implementation change, not a measured cross-version speedup claim. Large beam/agent settings can still be expensive. Nexus neural training remains substantially heavier.
