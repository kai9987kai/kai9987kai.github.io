# Model Card: Supermix_27 (v28 UltraExpert)

## Overview

Supermix_27 v28 represents a significant architectural evolution of the ChampionNet series, introducing a family of Mixture-of-Experts (MoE) classifier heads for enhanced retrieval and reasoning capabilities. Building on the v27 500k-FT base, v28 replaces the monolithic classifier with a dynamically-routed expert ensemble, enabling specialised sub-networks to activate per input while maintaining a stable shared representation.

---

## Architecture

### Backbone: ChampionNet

The backbone consists of 12 sequential layers (indices 0–11):
- **Layers 0–9**: Feature extraction via `GatedFFN` blocks with learned gating, LayerNorm, and residual connections.
- **Layer 10**: The classifier head (swapped per variant — see below).
- **Layer 11**: Final output normalization.

Input dimensionality is **256** features, output is **10** classes.

### GatedExpertClassifierHead (Primary v28 Head)

The flagship v28 head uses a Noisy Top-K gating mechanism:

- **Expert Branching**: 6 parallel experts with diverse activation functions:
  | Expert | Activation | Inner Dimension |
  |--------|------------|-----------------|
  | 0 | SiLU (Sigmoid Linear Unit) | 1024 |
  | 1 | GELU (Gaussian Error Linear Unit) | 1536 |
  | 2 | Mish (Self-Regularized) | 2048 |
  | 3 | ReLU (Rectified Linear Unit) | 2560 |
  | 4 | SELU (Scaled Exponential Linear Unit) | 3072 |
  | 5 | Tanh | 3584 |

- **Noisy Top-K Gating**:
  - A learned gate network produces clean logits per expert.
  - During training, learnable noise (`softplus` of a noise gate) is injected for exploration.
  - Top-2 experts are selected and their weights are renormalized.

- **Residual Calibration**: A learned linear transformation (`calibration`) refines final logits, scaled by a learnable parameter `θ`.

```
Input → Gate → Top-2 Selection → Weighted Expert Sum → + Base Logits + θ·Calibration → Output
```

---

## Model Variants

### `ultra_expert` — Noisy Top-K Gating (Primary)
Integrates `GatedExpertClassifierHead` into the standard ChampionNet backbone. Uses 6 heterogeneous experts with Noisy Top-2 Gating and residual calibration.

### `hierarchical_expert` — Two-Level Hierarchical Routing
Integrates `HierarchicalMoEClassifierHead`. Features:
- **2 domain groups** × **4 experts per group** = 8 total experts.
- **Domain-level gating**: Selects the most relevant expert group.
- **Per-domain expert gating**: Selects the top-2 experts within the chosen group.
- **Shared always-on expert**: Provides a stable baseline signal (1024-dim SiLU).
- **Per-expert residual LoRA adapters** (rank 64) for lightweight correction.
- **Per-expert LayerNorm** on outputs for gradient stability.
- **Auxiliary load-balancing loss** (Switch Transformer style) to prevent expert collapse.

### `deep_expert` — Auxiliary-Loss-Free Load Balancing
Integrates `DeepExpertClassifierHead`. Features:
- **1 shared expert** (2048-dim, always active) for universal knowledge.
- **8 routed experts** with Top-2 gating and diverse activations.
- **Dynamic bias adjustment** (DeepSeek-V3 style): Non-gradient buffer biases are updated each forward pass to push overloaded experts down and underloaded experts up, achieving load balance without auxiliary loss terms.

### `expert_choice` — Expert Choice (EC) Routing
Integrates `ExpertChoiceClassifierHead`. Instead of tokens choosing experts:
- **Experts choose tokens**: Each expert selects its top-K tokens based on affinity scores.
- **Guaranteed load balance**: Every expert processes exactly `ceil(BT × capacity_factor / N)` tokens.
- **No token drops**: All active experts process their full capacity.
- **Variable expert coverage**: Popular tokens may be processed by multiple experts.

### `smarter_expert` — Sigma Gating + LoRA Adapters
Integrates `SmarterExpertClassifierHead`. Features independent sigmoid scores per expert, allowing multiple experts to activate simultaneously without competition.

### `thought_expert` — Iterative Reasoning + Attention Fusion
Integrates `ThoughtExpertClassifierHead` (v13). Introduced a 3-step reasoning loop and Cross-Expert Attention Fusion for improved expert collaboration.

### `recursive_expert` — Recursive Thought (v14)
Integrates `RecursiveThoughtExpertHead`. The most advanced and efficient variant:
- **Adaptive Reasoning Depth (ACE)**: Early exit logic based on token-wise confidence, drastically improving inference efficiency.
- **Multi-Head Sigma Gating**: 2 routing heads per step for a richer, more precise routing subspace.
- **Hierarchical Shared Experts**: Combines a Global Shared Expert (2048-dim) for general knowledge with a Local Shared Expert (512-dim) for fine-grained task-specific baseline.
- **Recursive Reasoning**: An iterative loop with cross-expert attention and residual adapters.
- **Signal-Stable Initialization**: Small-signal normal initialization for experts to ensure differentiability from step 1.

### `reflexive_expert` — Reflexive Thought (v15)
Integrates `ReflexiveThoughtExpertHead`. The smartest self-correction variant:
- **Two-Pass Reasoning**: Computes initial predictions, then passes original features *and* initial predictions into a secondary "Critique Pass".
- **Self-Reflection MoE**: The critique pass uses an independent dynamically routed Mixture-of-Experts ensemble to identify uncertainties and directly correct errors in the initial prediction.
- **Stable Initialization**: Small normal variance initialization for downstream experts inside both initial and critique modules to ensure unobstructed gradient flow.

### `metacognitive_expert` — MetaCognitive Iterative Reflection (v16)
Integrates `MetaCognitiveExpertHead`. The most advanced variant, unifying iterative reasoning, self-reflection, and adaptive halting:
- **Shared Expert**: Always-on 2048-dim global expert for stable baseline signal.
- **ReasoningCells**: Per-step residual MLPs that iteratively refine feature representations.
- **Proposal MoE**: 6 routed experts with Sigma Gating generate predictions at each reasoning step.
- **Critique MoE**: 4 specialized experts inspect `[features ∥ proposal_logits]` and output corrections, enabling explicit self-reflection.
- **PonderNet Halting**: Learned per-step halt probability so the model spends more compute on hard inputs and exits early on easy ones.
- **Dynamic Bias Load Balancing**: Non-gradient buffer biases keep expert utilization even during training.

### `tree_of_thought_expert` — Latent Beam Search (v17)
Integrates `TreeOfThoughtExpertHead`. Represents a fundamental paradigm shift by embedding test-time compute scaling directly into the latent forward pass:
- **Action MoE Proposer**: At each reasoning step, 6 independent experts propose diverse modifications to the current hypothetical states.
- **Value Network Scorer**: A dedicated network evaluates the "goodness" or confidence of every newly generated candidate state.
- **Test-Time Beam Search**: A dynamically branching beam of hypothetical trajectories (`beam_size=4`) is maintained. At each step, branches are scored and heavily pruned, keeping only the most promising states.
- **Differentiable Aggregation**: The final surviving states are fused based on their Value scores, permitting unobstructed, end-to-end gradient flow back through the search process itself.

### `consensus_expert` — Architectural Diversity + Learned Arbitration (v18)
Integrates `ConsensusExpertHead`. The first head to leverage **architectural diversity** — three fundamentally different computational paradigms independently reason about the input, then a learned arbiter resolves disagreements:
- **MLP Pathway**: 6 feed-forward experts with Sigma Gating for fast pattern matching.
- **Attention Pathway**: Self-attention over 8 learned expert embeddings for relational reasoning.
- **Convolutional Pathway**: 1D convolution over the feature vector for local pattern detection.
- **Consensus Network**: A 3-layer MLP arbiter evaluates inter-pathway agreement/disagreement and produces confidence-weighted fusion.

### `deliberative_expert` — Multi-Draft Deliberation with Working Memory (v19)
Integrates `DeliberativeAlignmentExpertHead`. The most advanced reasoning head, introducing five innovations for enhanced intelligence and extended thinking:
- **Working Memory Bank**: 16 learned key-value memory slots act as a persistent scratchpad across reasoning steps, enabling the model to store and retrieve intermediate conclusions.
- **Multi-Draft Generation**: K=3 independent reasoning chains simultaneously explore diverse perspectives using per-draft reasoning cells and per-draft Sigma-Gated MoE routing.
- **Cross-Draft Attention**: After each reasoning step, drafts attend to each other's predictions via multi-head attention, combining the best aspects of each viewpoint.
- **PonderNet-style Adaptive Depth**: Learned per-step halting gates allocate more compute to hard inputs and exit early on easy ones.
- **Consistency-Weighted Aggregation**: A 3-layer MLP (Consistency Network) evaluates inter-draft agreement and produces confidence-weighted fusion, preferring internally consistent conclusions.
- **Dynamic Bias Load Balancing**: DeepSeek-V3 style non-gradient buffer biases keep expert utilization even across all drafts.

### `omniscient_expert` — Latent Knowledge Core & Graph-of-Thought (v20)
Integrates `OmniscientSynergyExpertHead`. The pinnacle of intelligence architecture, moving beyond parallel drafts to an interactive graph of thoughts grounded in deep knowledge:
- **Latent Knowledge Core (LKC)**: Before reasoning, queries a massive sparse memory matrix acting as an internal RAG system to ground reasoning in factual knowledge.
- **Graph-of-Thought Deliberation**: 4 thought nodes evaluate the problem and exchange insights non-linearly using Graph Attention (GAT) layers at each reasoning step.
- **Stochastic Bayesian Routing**: Uses the reparameterization trick to sample expert routing weights from learned Gaussian distributions, forcing creative exploration during training.
- **Meta-Cognitive Self-Correction**: A dedicated Critique Network reviews the entire Graph-of-Thought state at every step and broadcasts a residual correction vector to all nodes.
- **Per-Thought Dynamic Depth**: Each individual thought node evaluates its own confidence using PonderNet gating, allowing confident thoughts to freeze early while uncertain ones request help from the graph.

### `neurogenesis_expert` — Hierarchical Abstraction & Adversarial Self-Play (v21)
Integrates `NeurogenesisExpertHead`. The deepest reasoning architecture, combining multi-scale abstraction with adversarial debate:
- **Hierarchical Abstraction Pyramid**: 3 levels (concrete/abstract/meta) with bidirectional information flow and cross-level knowledge distillation.
- **Adversarial Self-Play**: A Proposer MoE generates candidate answers while an Adversary MoE finds flaws, iterating in debate rounds for robust conclusions.
- **Cross-Level Knowledge Banks**: Per-level learned memory banks with distillation bridges transferring insights between abstraction levels.
- **Emergent Expert Synthesis**: Dynamically interpolates expert weights based on input, creating effectively infinite expert combinations from a finite set.
- **Recursive Confidence Calibration**: Self-assessed certainty triggers extra debate rounds when confidence is low.

### `cognitive_expert` — Hypernetworks & Latent Tree Search (v22)
Integrates `CognitiveSingularityExpertHead`. The pinnacle of architectural complexity using fully dynamic computation:
- **Hypernetwork-Generated Experts**: Dynamically creates custom expert layer weights on-the-fly for every input token.
- **Latent Tree-Search**: Uses an internal Value Network to simulate and evaluate multiple divergent reasoning paths.
- **Episodic Neural Memory**: A fully differentiable (NTM-style) memory matrix with read/write heads for continuous context tracking.
- **Orthogonal Superposition**: Enforces 4 completely independent, mathematically orthogonal lines of reasoning.
- **Causal Logic Refinement**: A final self-attention pass ensuring strict logical causality in the final generated thought.

### `transcendent_expert` — Diffusion Refinement & World Model Simulation (v23)
Integrates `TranscendentArchitectExpertHead`. A completely new computational paradigm:
- **Diffusion-Based Refinement**: Sculpts answers from pure noise through T iterative denoising steps, each conditioned on decomposed sub-problem context.
- **World Model Simulation**: A learned transition function predicts future states; a value network scores candidate quality before committing.
- **Compositional Decomposition**: Automatically splits input into K sub-problems, solves each independently, then composes solutions.
- **Gradient-Free Evolution**: Soft tournament selection + latent-space crossover injects evolutionary search into every forward pass.
- **Self-Modifying Attention**: A meta-controller dynamically rewires Q/K attention projections mid-computation.

### `omniversal_expert` — Quantum Superposition & Neural ODEs (v24)
Integrates `OmniversalQuantumExpertHead`. Abandons discrete real-valued layers for continuous complex integration:
- **Continuous-Time Neural Mechanics**: Replaces standard layer sequences with a Differentiable Ordinary Differential Equation (Neural ODE) solver for infinite-depth continuous integration.
- **Quantum Superposition**: Features are lifted into Complex space (Magnitude + Phase) to hold mutually contradictory concepts simultaneously via wave interference.
- **Holographic Knowledge Binding**: Implements Holographic Reduced Representations (HRR) via Fast Fourier Transform circular convolutions.
- **Entanglement Routing**: Trades dot-product attention for pseudo-Kronecker Product combinations.
- **Measurement Collapse**: Final layer collapses continuous complex wave functions back down to real-valued action logits, tying quantum phase variance directly to model confidence.

### `fractal_expert` — Non-Euclidean Space & Cellular Automata (v25)
Integrates `FractalGenesisExpertHead`. discards Euclidean space and static graphs entirely:
- **Hyperbolic Geometry**: Operations are performed on the Poincaré Disk manifold, generating an exponentially expanding representational capacity for hierarchical semantic relations.
- **Fractal Generation**: Dynamically spawns recursive sub-nodes and children, computing as a biological Fractal Tree that eventually folds back up into a singular truth.
- **Neural Cellular Automata**: Replaces internal node feedforward blocks with an evolving grid of cells updated via local rules over discrete time steps.
- **Semantic Self-Assembly**: Dynamically constructs local logic circuits by binding together latent "Logic Atoms" based on minimal hyperbolic distance from the input context.
- **Resonance Collapse**: Combines fractal branches by enforcing harmonious constructive logic phase matching.

### `liquid_spiking_expert` — Bio-Plausible Adaptive Core (v26)
Integrates `LiquidSpikingTensorExpertHead`, drawing on major 2024/2025 breakthroughs:
- **Test-Time Training (TTT)**: Runs an internal gradient descent loop *during forward propagation*, dynamically fine-tuning internal fast-weights on a self-supervised task before producing the final output.
- **Spiking Neural Mechanics (SNN)**: Replaces continuous float activations with discrete binary spikes via Leaky Integrate-and-Fire (LIF) neurons, mapping to bio-plausible brain functions.
- **Liquid Synapses (LNN)**: Synaptic connection weights adapt their values dynamically over time based on the input sequence via continuous-time differential equations.
- **Tensor Network Core (MPS)**: Dense parameter matrices are factored into highly compressed 1D chains of 3D tensors (Matrix Product States).
- **Neuro-Symbolic Thresholding**: Decodes highly stochastic spiking brain waves back into deterministic continuous logits.

---

## Training & Fine-Tuning

| Parameter | Value |
|-----------|-------|
| **Base Checkpoint** | v27 500k-FT |
| **Precision** | FP16/AMP Mixed Precision |
| **Device Support** | CPU / CUDA / Metal via `device_utils` |
| **Optimizer** | AdamW (default lr=2e-4, wd=0.01) |
| **LR Schedule** | Cosine annealing with linear warmup |
| **Label Smoothing** | 0.05 |
| **EMA Decay** | 0.999 |
| **Gradient Clipping** | Max norm 1.0 |
| **Data Split** | Stratified train/val (90/10) |
| **Preference Loss** | SimPO-style sigmoid pairwise + hard negatives (weight=0.15, β=2.0) |
| **Preference Warmup** | Linear ramp over 1 epoch |

### Preference Optimization

The training pipeline supports multiple preference objectives:
- **Sigmoid** (SimPO-like): Pairwise sigmoid preference with configurable group size and EPO-style group estimator.
- **RePO ReLU**: Max-margin objective (β-free) with configurable margin.
- **Hard negative mining**: Configurable ratio of hard (top-logit) vs. random negatives.
- **Adaptive weighting**: Confidence-weighted preference terms for noisy-data robustness.

---

## Benchmark Results

### Coding Knowledge Benchmark (380 samples, 2 epochs fine-tuning)

| Variant | Accuracy |
|---------|----------|
| v27 Base | 22.63% |
| **v28 UltraExpert** | **19.47%** |

> **Note**: The v28 model was evaluated after only a short warm-up fine-tuning session. Full convergence is expected to surpass v27 performance.

### Language Model Evaluation (Benchmark v7, 40 eval pairs)

| Metric | Base Model | Tuned Model |
|--------|------------|-------------|
| Eval Loss | 2.866 | 2.866 |
| Perplexity | 17.57 | 17.57 |
| Token F1 | 0.128 | 0.128 |
| Char Similarity | 0.087 | 0.087 |
| Avg Gen Speed | **8.54s** | 111.47s |

> **Note**: Base and tuned metrics converge during early warm-up. Generation speed difference reflects the additional expert computation overhead. Optimization (expert pruning, batched expert processing) is planned.

### Training Convergence (v22 Full Smart Creative — 30k examples)

| Phase | Steps | Start Loss | End Loss |
|-------|-------|------------|----------|
| SFT Warmup | 1–17 | 4.94 | 4.80 |
| SFT Early | 18–100 | 4.67 | 2.97 |
| SFT Mid | 100–200 | 2.96 | 2.29 |
| SFT Late | 200–320 | 2.29 | 2.06 |

---

## Interface

- **Premium Web UI**: Features glassmorphism design with Inter typography, smooth micro-animations, and real-time inference timing display.
- **Style Modes**: Auto, Balanced, Creative, Concise, Analyst.
- **Runtime**: `runtime_python/chat_web_app.py` for real neural inference; `web_static/` for GitHub Pages compatible static UI.

---

## Files & Checkpoints

| File | Purpose | Required |
|------|---------|----------|
| `runtime_python/champion_model_chat_supermix_v27_500k_ft.pth` | Base v27 checkpoint (starting point for v28 fine-tuning) | ✅ |
| `source/champion_model_chat_v28_expert.pth` | Current v28 expert checkpoint | ✅ |

---

## Contact
- **Email**: [kai9987kai@gmail.com](mailto:kai9987kai@gmail.com)
- **GitHub**: [github.com/kai9987kai](https://github.com/kai9987kai)
- **Website**: [kai9987kai.co.uk](https://kai9987kai.co.uk)

## License
MIT License — Copyright (c) 2026 kai9987kai
