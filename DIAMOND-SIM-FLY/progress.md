Original prompt: innovate advance and improve whole project look at best and new research to help add new features and refine and make sure its better then orignial versions in every way possible

## Design and acceptance

Upgrade both existing simulations without removing their modes. World Lab gets a reusable deterministic engine, strict complete snapshots, truthful rollout rendering, selectable beam planning, and cancellable paired-seed comparisons. Nexus gets targeted async lifecycle and single-agent fixes. A shared launch page and accurate research/usage documentation make both discoverable.

Research reviewed: DIAMOND (NeurIPS 2024), TD-MPC2 (ICLR 2024), Dreamer 4 (2025), and rliable evaluation methodology. These inform planning/evaluation design; browser heuristics are not implementations of those neural systems.

Validation: Node regression tests, paired-seed raw evidence, browser controls and snapshot round trips, desktop/mobile screenshots, JavaScript syntax checks, git diff --check. Universal superiority is not an acceptance claim; report measured gains and tradeoffs.

## Work log

- Initial checkout clean on main, baseline 3abf507. Two standalone HTML applications, no test infrastructure. README describes an older version.
- Extracted World Lab engine and UI into classic scripts, preserving direct-file use.
- Audit found incomplete snapshots, duplicate animation chains, misleading imagined paths, Nexus async mutation races and one-agent evolution crash.
- Completed World Lab classic-script extraction, energy-aware beam search, correct rollout rendering, independent agent inspection, strict v3 snapshots, paired experiments, cancellation and exports.
- Completed Nexus training/lifecycle fixes, single-agent evolution, model disposal, normalized TensorFlow policy targets, epsilon/shield behavior, staged atomic checkpoint loading and truthful partial-checkpoint messaging.
- Added launch page, research mapping, usage guide, local server, locked optional browser QA dependency and original-version comparison harness.
- Independent review reproduced open-border and energy-depletion planning errors; added failing regressions and corrected both before final measurements.
- Final validation: 40/40 tests passed with NEXUS_TF_SMOKE=1; 35/35 Chromium browser checks passed; JavaScript/local-script/HTML-ID checks and git diff --check passed. Installed web-game client passed with screenshot/text output, visually inspected. Desktop/mobile screenshots inspected; mobile Run/Step controls moved above world.
- Final frozen-original comparison: 20 identical initial-state seed pairs, 300 steps, 2 agents. Reward/agent 149.5952 vs 145.4488; paired delta +4.1464, 95% interval [0.7665, 7.5405]. Coverage 15.7472% vs 8.3486%; respawns/run 1.05 vs 3.05; hazards equal 0.15. Receipt hashes verified against current core/experiment/comparison sources.
- Evidence and reproducible commands are in docs/validation.md; raw original comparison is tracked under docs/benchmarks/. Runtime/browser artifacts remain ignored under output/.

## Fly Lab work (this branch)

Prompt: "innovate improve refine add features make it better and look at the best and new research to help and make it better in every way".

Research reviewed: Shiu et al., *A Drosophila computational brain model reveals sensorimotor processing* (Nature 2024); the male CNS connectome (Janelia FlyEM / MRC LMB, 2025), whose upstream R package is bundled here as `malecns/`; connectome-constrained ring attractor work (bioRxiv 2024, NeurIPS 2025); Lin et al. on APL-driven Kenyon-cell sparseness (2014) and localised mushroom-body inhibition (2020); reinforcement-prediction-error models of mushroom-body learning (2021); rliable evaluation methodology.

- The Fly Lab appeared in no documentation: not the README, not the research mapping, not the validation record. It is the largest component in the repository.
- Fixed four reproducibility defects: neurogenesis drew from `Math.random`, neuron ids and engrams carried wall-clock stamps, and snapshot restore set a generator's draw count but never its state.
- The circadian clock, day/night phase and homeostatic schedule advanced once per fly rather than once per tick, so a three-fly swarm ran its day three times too fast.
- All agents shared one set of brain registers: heading, odometry, gait phase, looming history and metabolic titres bled between individuals, and reinforcement trained whichever fly had stepped last. Learned synapses stay shared; per-individual registers are now swapped per fly.
- Replaced three circuits that carried a fly structure's name without its mechanism (compass, mushroom-body sparseness, KC→MBON plasticity) and added state-dependent descending gating. Each keeps its predecessor selectable as `"legacy"`.
- Added `src/fly-lif-circuit.js`, a spiking module using the published whole-brain leaky integrate-and-fire parameters.
- Added paired bootstrap intervals, probability of improvement, an interquartile mean and tie-split win shares to the connectome benchmark, plus a reproducible CLI with source hashes.
- Wired the third agent into the app; the engine had supported it all along. Driving the app then exposed five further defects, including heading derived from bearing rather than travel, moves that walked into walls, a social bonus that out-earned foraging, and a Load State button that never worked.
- A review pass over the whole diff found nine further defects, several of which invalidated the first measurement: the ring attractor's rotation wrapped past half a turn and so ran backwards on every grid direction reversal; a brain used outside a syncytium was never told which action it took, which made the dopamine-gated rule directionless and stopped the single-brain arm learning at all; plasticity credited the syncytium's argmax rather than the executed action (12% of ticks); the prediction error used a single shared value estimate; a new fly inherited the previous one's Kenyon-cell activations; the spiking delay line was written one slot early; telemetry silently switched which fly it described. All fixed, with a regression test each.
- Chasing the remaining performance gap found two more defects. Offline pre-training drew all fourteen sensory channels from a uniform distribution with the bearing channels pinned to zero, and clamped every AL->KC synapse up to a floor, taking claws per Kenyon cell from 3.5 to 7.7 and destroying the sparse code. Measured cost: 51.60 net score against not pre-training at all, 95% interval [24.32, 78.70]. Fixed by sampling from the sensory contract and leaving silent synapses silent; now neutral at -4.70 [-1.83, 12.82]. The celestial anchor was fed the circadian sun angle, which sweeps a full circle every period and so dragged the compass rather than pinning it; the graft now supplies a fixed per-world sky azimuth.
- That work also established that the legacy compass is not a model: it adds the caller's angular velocity to a scalar, and every caller derives that from the true travel direction, so it reproduces ground-truth heading exactly (worst error 0.0000 degrees). Comparing the whole bundle against it mostly measures whether free heading helps.
- Final measurement, compass held constant, 40 seeds: the three non-compass mechanisms give +22.95 with a 95% interval of [-9.2, 56.0] on the attractor compass and +42.75 [-5.7, 88.6] on the oracle. Both straddle zero: they point positive, are inconclusive, and cost nothing while implementing the mechanisms they are named after. Estimating heading rather than being given it costs 145.00 [-189.3, -101.7]. A single Antennal Lobe brain still outscores all sixteen neuropils.
- Three successive figures for the headline comparison (+95.85, +30.65, then the isolated result above) were each invalidated by a defect the next round of measurement exposed. docs/validation.md records all three and why, as the argument for intervals and raw per-seed observations over means.
- 154 Node tests (1 skipped offline), 38 browser checks, JavaScript/HTML checks pass.

## Remaining scope limits

- Completed the earlier improvement set without committing or pushing. Existing branch remains main.
- Fly Lab limits: one reduced 16x16 arena and one convenience seed set, not a held-out benchmark. A single Antennal Lobe brain outscores all sixteen there by a wide margin; gating is the largest single contributor to the syncytium's score and still leaves it far behind. Closing that gap is the clearest piece of work left. The spiking circuit has no plasticity and is not used by the interactive app. No connectome data is read at runtime; the 16x16x4 commissures are synthetic.
- No universal superiority or speedup claim: the full-version benchmark covers one fixed configuration, and its timing uses different execution contexts. Preliminary within-core beam-vs-shooting comparison is inconclusive.
- World Lab v2 snapshots lack RNG state and are rejected for exact replay. Nexus checkpoints remain explicitly partial. Larger neural world models, faithful paper implementations, representative held-out multi-task evaluation and long-horizon performance work are future projects.
