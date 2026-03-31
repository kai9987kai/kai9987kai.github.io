# Architecture Guide: Supermix_27

This document provides an in-depth technical overview of the Supermix_27 model architecture, training pipeline, and design decisions.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [ChampionNet Backbone](#championnet-backbone)
3. [Classifier Head Evolution](#classifier-head-evolution)
4. [MoE Routing Mechanisms](#moe-routing-mechanisms)
5. [Training Pipeline](#training-pipeline)
6. [Inference Runtime](#inference-runtime)
7. [Key Design Decisions](#key-design-decisions)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Supermix_27 System                       │
├──────────────────┬──────────────────┬───────────────────────┤
│   source/        │  runtime_python/ │  web_static/          │
│   Training &     │  Real Neural     │  Static GitHub        │
│   Fine-tuning    │  Inference       │  Pages UI             │
├──────────────────┴──────────────────┴───────────────────────┤
│                  ChampionNet Backbone                        │
│            (12 layers, 256-dim features, 10 classes)         │
├─────────────────────────────────────────────────────────────┤
│              MoE Classifier Head (Layer 10)                  │
│  GatedExpert │ Hierarchical │ Deep │ ExpertChoice │ Smarter │
└─────────────────────────────────────────────────────────────┘
```

The project is split into three main deployment surfaces:
- **`source/`**: All training scripts, model definitions, dataset builders, and benchmarks.
- **`runtime_python/`**: A self-contained copy of the inference-critical files with the production checkpoint.
- **`web_static/`**: A static HTML/JS interface for GitHub Pages deployment (metadata retrieval only, no `.pth` inference).

---

## ChampionNet Backbone

Defined in [`source/run.py`](source/run.py), the `ChampionNet` is a 12-layer sequential model:

```python
class ChampionNet(nn.Module):
    # layers[0..9]:  GatedFFN feature extraction blocks
    # layers[10]:    Classifier head (swapped per variant)
    # layers[11]:    Final normalization / output projection
```

### GatedFFN Block

Each feature extraction layer is a `GatedFFN` — a feedforward block with learned gating:

```
Input x ──┬── Linear(256 → hidden) → Activation ──┐
           │                                        ├── Element-wise multiply → Linear(hidden → 256)
           └── Linear(256 → hidden) → Sigmoid ─────┘
```

Key properties:
- **Residual connections** preserve gradient flow through the 10-layer stack.
- **LayerNorm** is applied at each stage.
- **Multiple activation functions** (SiLU, GELU) are used across layers for representational diversity.

---

## Classifier Head Evolution

The project has evolved through several classifier head architectures, each building on the last:

| Generation | Head Class | Key Innovation |
|-----------|-----------|----------------|
| v1 | `nn.Linear` (base) | Simple linear classifier |
| v2 | `ExpandedClassifierHead` | Adapter branch with learnable `α` scale |
| v3 | `ExpandedClassifierHeadXL` | Dual adapters + learned router |
| v4 | `ExpandedClassifierHeadXXL` | Tri-branch + second-stage routing |
| v5 | `ExpandedClassifierHeadXXXL` | Quad-branch + third-stage routing |
| v6 | `ExpandedClassifierHeadUltra` | Five branches + domain-expert calibration |
| v7 | `ExpandedClassifierHeadMega` | Six branches + cross-attention fusion + reasoning gate |
| **v8** | **`GatedExpertClassifierHead`** | **MoE with Noisy Top-K Gating** |
| **v9** | **`HierarchicalMoEClassifierHead`** | **Two-level hierarchical routing + shared expert** |
| **v10** | **`DeepExpertClassifierHead`** | **Aux-loss-free dynamic bias load balancing** |
| **v11** | **`ExpertChoiceClassifierHead`** | **Expert Choice routing (experts pick tokens)** |
| **v12** | **`SmarterExpertClassifierHead`** | **Sigma Gating + LoRA adapters** |
| **v13** | **`ThoughtExpertClassifierHead`** | **Iterative reasoning loop + cross-expert attention fusion** |
| **v14** | **`RecursiveThoughtExpertHead`** | **Adaptive Reasoning Depth (ACE) + Multi-Head Sigma Gating** |
| **v19** | **`DeliberativeAlignmentExpertHead`** | **Multi-Draft Deliberation + Working Memory + Consistency Aggregation** |
| **v20** | **`OmniscientSynergyExpertHead`** | **Latent Knowledge Core + Graph-of-Thought + Stochastic Routing** |
| **v21** | **`NeurogenesisExpertHead`** | **Hierarchical Abstraction + Adversarial Self-Play + Emergent Expert Synthesis** |
| **v22** | **`CognitiveSingularityExpertHead`** | **Hypernetwork Experts + Latent Tree Search + Orthogonal Superposition + Episodic Memory** |
| **v23** | **`TranscendentArchitectExpertHead`** | **Diffusion Refinement + World Model + Compositional Decomposition + Evolution** |
| **v24** | **`OmniversalQuantumSimulationExpert`** | **Complex Superposition + Neural ODE + Holographic Binding + Entanglement** |
| **v25** | **`FractalGenesisExpertHead`** | **Hyperbolic Space + Fractal Recursion + Cellular Automata + Self-Assembly** |
| **v26** | **`LiquidSpikingTensorExpertHead`** | **Spiking Neurons (LIF) + Liquid Synapses + Test-Time Training + Tensor Networks** |

> **Note**: All heads preserve backward-compatible weight keys (`weight`, `bias`, `alpha`, etc.) to enable warm-starting from earlier checkpoints.

---

## MoE Routing Mechanisms

### 1. Noisy Top-K Gating (`GatedExpertClassifierHead`)

```
x → Gate(x) → clean_logits
         └──→ NoiseGate(x) → softplus → noise_std
              noise = randn() × noise_std          (training only)
              gate_logits = clean_logits + noise
              weights = softmax(gate_logits)
              top_weights, top_idx = topk(weights, k=2)
              top_weights = normalize(top_weights)
```

**Why noisy gating?** Injecting learnable noise during training encourages exploration of under-used experts and prevents mode collapse where only 1–2 experts receive all traffic.

### 2. Hierarchical Two-Level Routing (`HierarchicalMoEClassifierHead`)

```
Level 1 (Domain):   x → DomainGate(x) → top-1 domain group
Level 2 (Expert):   x → ExpertGate[domain](x) → top-2 experts within group
Shared Expert:      x → SharedUp → SiLU → SharedDown → LayerNorm  (always active)
```

This design is inspired by **DeepSeek-MoE** and **ST-MoE**. The two-level hierarchy reduces the routing search space (2 groups × 4 experts vs. 8 flat experts) and enables domain specialization.

### 3. Auxiliary-Loss-Free Load Balancing (`DeepExpertClassifierHead`)

Traditional MoE uses an auxiliary loss term to prevent expert collapse:
```
L_aux = N × Σ(fraction_dispatched × avg_gate_prob)
```

The `DeepExpertClassifierHead` instead uses **dynamic bias adjustment** (inspired by DeepSeek-V3):
```python
# Non-gradient buffer, updated each forward pass:
expert_load = fraction_of_tokens_each_expert_received  # shape: (N,)
target_load = top_k / n_experts
expert_bias += α_bias × (target_load - expert_load)
```

This avoids interference with the primary training objective.

### 4. Expert Choice Routing (`ExpertChoiceClassifierHead`)

**Reverses the routing direction**: instead of tokens selecting experts, experts select tokens.

```
Affinity = softmax(Gate(x), dim=experts)    # (BT, N)
For each expert i:
    top_tokens = topk(Affinity[:, i], k=capacity)
    output[top_tokens] += Expert_i(x[top_tokens]) × Affinity[top_tokens, i]
```

**Guarantees**:
- Every expert processes exactly `ceil(BT × capacity_factor / N)` tokens.
- No token drops (unlike traditional top-K where overflow tokens are discarded).
- Popular tokens may be processed by multiple experts (variable compute).

### 5. Sigma Gating (`SmarterExpertClassifierHead`)

Replaces competitive softmax routing with **independent sigmoid scores**:

```python
gate_scores = sigmoid(Gate(x) + expert_bias)  # shape: (BT, N)
# Each score ∈ [0, 1] independently — multiple experts can fully activate
routed_out = Σ(expert_i(x) × gate_scores[:, i])
```

**Key difference from softmax**: Experts don't compete. A token can activate all 8 experts at full strength if the gate deems it beneficial — useful for complex queries that benefit from diverse perspectives.

### 6. Multi-Head Recursive Thought (`RecursiveThoughtExpertHead`)

The flagship v14 head introduces **Recursive Thought** with **Adaptive Reasoning Depth (ACE)**:

```python
# Iterative Reasoning Loop (3 steps)
for step in range(3):
    # 1. Refine features
    current_features = ReasoningCell(current_features)
    
    # 2. Multi-Head Sigma Gating
    # Each head (2 per step) provides a different routing perspective
    gate_logits = mean([gate_h(current_features) for gate_h in range(n_heads)])
    gate_scores = sigmoid(gate_logits)
    
    # 3. ACE: Dynamic Early Exit
    exit_prob = sigmoid(exit_gate(current_features))
    
    # 4. Expert Fusion
    step_out = Σ(expert(x) × gate_scores)
    total_routed_out += (1.0 - cumulative_exit_prob) * step_out
    
    # Update exit probability
    cumulative_exit_prob += (1.0 - cumulative_exit_prob) * exit_prob
    
    if cumulative_exit_prob > threshold: break # Inference only
```

**Key Innovations**:
- **Multi-Head Routing**: Using 2 heads per step creates a "routing committee", reducing noise and improving specialization.
- **ACE Efficiency**: Tokens with clear classification paths exit early, saving compute. Complex tokens use the full 3-step recursive capacity.
- **Signal-Stable Init**: Experts use `nn.init.normal_(std=0.01)` instead of zero to ensure non-zero gradient paths from initialization.

---

## Training Pipeline

### Data Flow

```
JSONL datasets → load_conversation_examples() → assign_labels()
    → build_training_tensors(feature_mode) → stratified_split()
    → DataLoader (optional WeightedRandomSampler for class balance)
```

### Feature Modes

| Mode | Description |
|------|-------------|
| `legacy` | Original feature encoding |
| `context_v2` | Context-aware encoding (default) |
| `context_v3`–`v5` | Progressive context improvements |
| `context_mix_v1` | Mixed context features |
| `context_mix_v2_mm` | Multimodal mixed context |

### Loss Function

The total loss combines cross-entropy with preference optimization:

```
L_total = L_CE(label_smoothed) + pref_scale × pref_weight × L_pref + aux_weight × L_aux
```

Where:
- **L_CE**: Standard cross-entropy with configurable label smoothing.
- **L_pref**: Pairwise preference loss (SimPO sigmoid or RePO ReLU margin).
- **L_aux**: MoE auxiliary load-balancing loss (for variants that use it).
- **pref_scale**: Linear warmup from 0 → 1 over configurable epochs.

### Optimization

- **Optimizer**: AdamW with configurable weight decay.
- **LR Schedule**: Cosine annealing with configurable linear warmup.
- **EMA**: Exponential moving average of model weights (decay 0.999) for smoother evaluation.
- **Gradient Clipping**: Max norm clipping (default 1.0) for training stability.
- **Mixed Precision**: AMP GradScaler for CUDA devices.

---

## Inference Runtime

### Local Python Inference

```bash
python runtime_python/chat_web_app.py
# Loads champion_model_chat_supermix_v27_500k_ft.pth
# Starts a Flask/Tornado web server on port 8000
```

### Device Resolution Order

The `device_utils.resolve_device()` function auto-selects the best available device:
```
cuda → npu → xpu → dml → mps → cpu
```

### Static Web Deployment

The `web_static/` directory contains a GitHub Pages-compatible interface that uses precomputed metadata (JSON) for chat retrieval without running the neural model in-browser.

---

### 7. Multi-Draft Deliberation (`DeliberativeAlignmentExpertHead`)

The v19 head introduces **Multi-Draft Deliberation with Working Memory** — five major innovations for significantly improved reasoning:

```python
# Working Memory Bank — learned key-value scratchpad
memory_keys = Parameter(n_mem_slots, in_dim)   # (16, 256)
memory_values = Parameter(n_mem_slots, in_dim)  # (16, 256)

# Iterative Deliberation Loop (3 steps)
for step in range(3):
    # A. Memory Read: each draft queries the working memory
    for d in range(K):  # K=3 drafts
        attn = softmax(query(draft[d]) @ memory_keys.T)
        draft[d] += attn @ memory_values
    
    # B. Per-draft reasoning cell refinement
    for d in range(K):
        draft[d] = draft[d] + ReasoningCell_d(draft[d])
    
    # C. Per-draft expert MoE routing (Sigma Gating)
    for d in range(K):
        preds[d] = Σ(expert_i(x) × sigmoid(gate_d(draft[d])))
    
    # D. Cross-Draft Attention: drafts attend to each other
    preds = CrossAttention(Q=preds, K=preds, V=preds)
    
    # E. Memory Write: update memory with new insights
    write_signal = mean(drafts)
    mem_retrieval = sigmoid(write_gate(write_signal)) @ memory_values
    for d in range(K):
        draft[d] += 0.1 * mem_retrieval
    
    # F. PonderNet-style halting
    halt_prob = sigmoid(halt_gate(mean(drafts)))
    
    # G. Consistency-weighted aggregation
    weights = softmax(ConsistencyNet(concat(preds)))
    step_fused = Σ(preds[d] × weights[d])
    
    total += (1 - cumulative_halt) × step_fused
```

**Key Innovations**:
- **Working Memory Bank**: Learned key-value slots that persist across reasoning steps, giving the model a scratchpad for intermediate conclusions.
- **Multi-Draft Generation**: K=3 independent reasoning chains explore diverse perspectives simultaneously, like brainstorming.
- **Cross-Draft Attention**: After each step, drafts attend to each other's predictions, combining the best aspects of each viewpoint.
- **Consistency-Weighted Aggregation**: A learned network evaluates inter-draft agreement and produces confidence-weighted fusion, preferring internally consistent conclusions.
- **Adaptive Depth via PonderNet**: Complex inputs use all 3 reasoning steps; easy inputs exit early via learned halting gates.

---

### 8. Omniscient Synergy (`OmniscientSynergyExpertHead`)

The v20 head represents the pinnacle of the architecture, moving beyond parallel drafts to a non-linear graph of thoughts grounded in deep knowledge:

```python
# 1. Latent Knowledge Core (Implicit RAG)
knowledge = softmax(query(x) @ keys.T) @ values

# 2. Initialize Graph-of-Thought (N=4 nodes)
nodes = [x + knowledge + noise() for _ in range(N)]

for step in range(3):
    # A. Graph Attention: Nodes exchange information
    nodes = GraphAttention(nodes)
    
    # B. Meta-Cognitive Critique
    correction = CritiqueNetwork(concat(nodes))
    nodes = nodes + correction  # Broadcast to all
    
    # C. Stochastic Bayesian MoE Routing
    for n in nodes:
        mu, logvar = RouteNet(n)
        sample = mu + exp(0.5 * logvar) * eps()  # Reparameterization
        preds[n] = Σ(expert_i(x) × sigmoid(sample))
        
        # Per-node dynamic halting
        halts[n] = sigmoid(HaltGate(n))

# 3. Final Fusion
output = AttentionPooling(preds)
```

**Key Innovations**:
- **Latent Knowledge Core**: Implicit RAG via a massive continuous associative memory queried *before* reasoning.
- **Graph-of-Thought (GoT)**: Non-linear reasoning where thought-nodes exchange insights via Graph Attention (GAT).
- **Stochastic Bayesian Routing**: Samples expert routes via the reparameterization trick, forcing creative exploration of expert combinations.
- **Meta-Cognitive Self-Correction**: Global critique network reviews the whole graph and broadcasts course-corrections.
- **Per-Thought Dynamic Depth**: Halting is evaluated per-node, allowing confident thoughts to freeze while uncertain ones keep deliberating.

---

### 9. Neurogenesis (`NeurogenesisExpertHead`)

The v21 head introduces **Hierarchical Abstraction + Adversarial Self-Play** for the deepest reasoning yet:

```python
# Phase 1: Hierarchical Abstraction Pyramid (3 levels)
levels = [x]  # concrete
for i in range(2):
    levels.append(levels[-1] + UpProject(levels[-1]))

# Each level queries its own knowledge bank
for lvl in range(3):
    levels[lvl] += softmax(query(levels[lvl]) @ keys[lvl].T) @ values[lvl]

# Top-down distillation (grounding)
for i in reversed(range(2)):
    levels[i] += 0.1 * DistillBridge(levels[i+1])

unified = mean(levels)

# Phase 2: Adversarial Debate Loop (3 rounds)
for rnd in range(3):
    # Emergent Expert Synthesis
    synth = softmax(SynthesisNet(state))
    proposal = Σ(proposer_expert_i × sigmoid(gate) × synth)
    critique = Σ(adversary_expert_i × sigmoid(gate))
    
    resolved = ResolutionNet(concat(proposal, critique))
    confidence = sigmoid(ConfidenceGate(state))
    
    total += (1 - cumulative_conf) × resolved

# Phase 3: Level fusion
fused = LevelFusion(concat(level_preds))
output = base + shared + α × (total + 0.1 × fused)
```

**Key Innovations**:
- **Hierarchical Abstraction Pyramid**: 3 levels (concrete/abstract/meta) with bidirectional information flow.
- **Adversarial Self-Play**: Proposer MoE generates answers; Adversary MoE finds flaws. They debate iteratively.
- **Cross-Level Knowledge Banks**: Per-level learned memory with distillation bridges for multi-scale knowledge.
- **Emergent Expert Synthesis**: Dynamically interpolates expert weights, creating effectively infinite expert combinations.
- **Recursive Confidence Calibration**: Model evaluates its own certainty and exits early when confident.

---

### 10. Cognitive Singularity (`CognitiveSingularityExpertHead`)

The v22 head pushes the boundary with **Hypernetwork-generated weights**, **Orthogonal Superposition**, and **Latent Tree-Search**:

```python
# 1. Episodic Memory Retrieval (NTM-style differentiable memory)
mem_context = read_head(state, memory_matrix)
hyper_in = concat([state, mem_context])

# 2. Hypernetwork dynamically generates custom expert weights (W1, W2)
generated_weights = Hypernet(hyper_in)
W1, W2 = reshape(generated_weights)

# 3. Orthogonal Superposition (K distinct reasoning paths)
hypotheses = []
for k in range(K):
    # Enforce path divergence implicitly via representation spacing
    path_in = path_projs[k](state)
    # Execute through custom Hypernet expert
    hypotheses.append( W2 @ gelu(W1 @ path_in) )

# 4. Latent Tree-Search Value Network
# AlphaGo-style value estimation of each hypothesis
values = ValueNet(hypotheses)
path_probs = softmax(values)

# 5. Causal Logic Refinement
# Masked self-attention ensures logical flow between hypotheses
refined = CausalSelfAttention(hypotheses)

# 6. Episodic Memory Update
# Save best path logic for future context
best_path = hypotheses[argmax(path_probs)]
write_head(best_path, memory_matrix)

output = base + shared + α × (Σ refined_k * probs_k + write_residual)
```

**Key Innovations**:
- **Hypernetwork-Generated Experts**: Rewires reasoning circuitry on-the-fly. Instead of selection, it uses *creation*.
- **Latent Tree-Search**: A Value Network estimates the "reward" (logical consistency) of reasoning paths.
- **Episodic Neural Memory**: Fully differentiable read/write long-term memory matrix for infinite-depth context tracking.
- **Orthogonal Superposition**: Forces $K=4$ strictly disjoint pathways via cosine-repulsion to maintain reasoning diversity before collapse.
- **Causal Logic Refinement**: A final self-attention pass ensures strict continuous causal flow in the selected reasoning output.

---

### 11. Transcendent Architect (`TranscendentArchitectExpertHead`)

The v23 head introduces a **completely new computational paradigm** — the answer is sculpted from noise via iterative denoising, guided by a World Model:

```python
# 1. Compositional Decomposition
sub_problems = [DecomposeHead_k(x) for k in range(K)]

# 2. Diffusion Refinement (per sub-problem)
for k in range(K):
    z = randn(D_out)  # start from noise
    for t in range(T):
        z = z - β_t * Denoiser_t(z + time_embed[t], sub_ctx[k])

# 3. World Model Simulation
for sol in sub_solutions:
    future = WorldTransition(sol)
    score = WorldValue(future)

# 4. Soft Evolution (tournament + crossover)
parent_a = softmax(fitness * 5) @ population
parent_b = softmax(-fitness * 5) @ population  # diversity
offspring = CrossoverNet(concat(parent_a, parent_b))

# 5. Self-Modifying Attention
Q, K = Q + 0.1 * Q @ MetaQ(x), K + 0.1 * K @ MetaK(x)
refined = LayerNorm(candidates + softmax(QKᵀ/√d) @ V)

output = base + shared + α × (fused + 0.1 × composed)
```

**Key Innovations**:
- **Diffusion Refinement**: Answers are sculpted from noise over T denoising steps, each conditioned on the decomposed sub-problem context.
- **World Model**: A learned transition function predicts future states; a value network scores candidate quality.
- **Compositional Decomposition**: Input is automatically split into K sub-problems, each solved independently.
- **Gradient-Free Evolution**: Soft tournament selection + crossover in latent space injects evolutionary search.
- **Self-Modifying Attention**: A meta-controller dynamically rewires Q/K projections mid-computation.

---

### 12. Omniversal Quantum Simulation (`OmniversalQuantumExpertHead`)

The v24 head abandons discrete real-valued layers entirely, moving to **Continuous-Time Complex-Valued Integration**:

```python
# 1. Quantum Lift: Real (D) -> Complex (2D) Space
z_real = LiftReal(x)
z_imag = LiftImag(x)
z_0 = concat(z_real, z_imag)

# 2. Holographic Knowledge Binding (HRR)
# Circular convolution binds global memory trace into the state
z_bound = FFT_Inverse(FFT(z_0) * FFT(HolographicMemory))
z_t = z_0 + α * z_bound

# 3. Continuous-Time Neural ODE Integration
# Solves z(1) = z(0) + ∫ f(z, t) dt
for step in range(Steps):
    # Base derivative
    dz_dt = ODEFunc_Net(z_t, t)
    
    # Entanglement Routing (Pseudo-Kronecker)
    Q, K, V = ProjQ(z_t), ProjK(z_t), ProjV(z_t)
    entangled = relu(Q * K).sum() / sqrt(D)
    dz_dt += sigmoid(entangled) * V
    
    # Euler Step
    z_t = z_t + dz_dt * dt
    t = t + dt

# 4. Measurement Collapse
phase = atan2(z_t_imag, z_t_real)
confidence = sigmoid(UncertaintyGate(phase))
logits = MeasurementProj(z_t) * confidence

output = base + shared + α * logits
```

**Key Innovations**:
- **Continuous-Time Neural Mechanics**: Uses an Ordinary Differential Equation (ODE) solver rather than discrete forward passes.
- **Quantum Superposition Space**: Operates entirely in complex numbers (Magnitude + Phase), allowing contradictory concepts to interfere destructively or constructively.
- **Holographic Knowledge Binding**: Uses Circular Convolution via FFT to achieve infinite-density concept entanglement.
- **Entanglement Routing**: Discards dot-product attention for an element-wise Kronecker approximation to route pairwise semantic combinations.
- **Measurement Collapse**: Maps complex wave interference back down to real-valued reasoning, where quantum phase variance directly suppresses output amplitude (confidence).

---

### 13. Fractal Genesis (`FractalGenesisExpertHead`)

The v25 head enters **Non-Euclidean Space** and replaces static computation steps with a **Dynamic Recursive Fractal Graph**:

```python
# 1. Hyperbolic Map
h_node = ExpMapOrigin(PoincareProj(x), Curvature_c)

# 2. Semantic Self-Assembly
h_atoms = ExpMapOrigin(LogicAtoms, Curvature_c)
dists = PoincareDistance(h_node, h_atoms, Curvature_c)
weights = softmax(-dists)
bound_atoms = weights @ LogicAtoms
circuit_state = AssemblyNet([x, bound_atoms])

# 3. Fractal Recursion (Depth D)
def Evolve(node_state, depth):
    if depth == 0:
        return CellularAutomata(node_state)
    
    # Spawn K=2 children
    child_A, child_B = NodeSpawner(node_state).chunk(2)
    
    # Recursively evolve children
    evo_A = Evolve(child_A, depth - 1)
    evo_B = Evolve(child_B, depth - 1)
    
    # Resonance Collapse
    combined = ResonanceCombiner([evo_A, evo_B])
    
    # Cellular Automata update of the parent
    return CellularAutomata(combined + node_state)

final_euclidean_state = Evolve(circuit_state, Depth)

# 4. Final Logit Projection
output = base + shared + α * FinalProj(final_euclidean_state)
```

**Key Innovations**:
- **Hyperbolic Geometry**: Embeds states in the Poincaré Disk, allowing tree-like hierarchical conceptual representations with exponential capacity rather than Euclidean polynomial capacity.
- **Fractal Graph Recursion**: Generates a dynamic tree of arbitrary depth. Root nodes spawn sub-nodes that process in parallel and recursively fold back together into the answer.
- **Neural Cellular Automata**: Dense linear matrix multiplications are replaced per-node by a local localized grid of evolving cells, allowing structured logic to emerge softly over T steps.
- **Semantic Self-Assembly**: The expert does not have fixed logical wiring. It binds to "Logic Atoms" in a learnable latent pool based on their hyperbolic distance, dynamically constructing the required computation circuit for every specific input token automatically.
- **Resonance Collapse**: The fractal tree branches merge back together linearly by phase resonance rather than blind weighted summation.

---

### 14. Liquid Spiking Tensor Engine (`LiquidSpikingTensorExpertHead`)

The v26 absolute cutting-edge biologically-inspired head breaks away from continuous static memory, pushing into **Dynamically Self-Adapting Spiking Execution**:

```python
# 1. Test-Time Training (Dynamic inference-time adaptation)
x_inner = x.detach().requires_grad_(True)
latent = x_inner @ TTT_Encoder_A
reconstruct = TTT_Decoder(latent)

# Fast-weight update *during* forward pass (inner loop gradient)
grad = autograd.grad(MSE(reconstruct, x_inner), TTT_Encoder_A)
TTT_Encoder_Fast = TTT_Encoder_A - LR * grad
ttt_output = x @ TTT_Encoder_Fast @ TTT_Decoder_B

# 2. Liquid Synapse & Tensor Network (MPS) Timestep Loop
membrane_voltage = 0
liquid_state = 0
spike_accum = 0

for _ in range(T_STEPS):
    # Matrix Product State Transformation (Highly Compressed tensors)
    mps_out = (liquid_state @ Core_1) @ Core_2
    
    # Liquid Synapse Diff Eq (C. elegans inspired dynamic circuitry)
    d_state = -liquid_state / tau + sigmoid(liquid_gate(mps_out))
    liquid_state += d_state * dt
    
    # Leaky Integrate-and-Fire (LIF Neuron)
    membrane_voltage = membrane_voltage * decay + liquid_state
    spike = SurrogateHeaviside(membrane_voltage, threshold)
    membrane_voltage -= spike * threshold
    
    spike_accum += spike

# 3. Neuro-Symbolic Decoding
output = Base + Shared + ttt_output + SpikeDecoder(spike_accum / T_STEPS)
```

**Key Innovations**:
- **Spiking Neural Mechanics (SNN)**: Replaces float continuous activations with bio-plausible discrete Spikes (Leaky Integrate-and-Fire neurons) acting over small temporal steps. Backward pass requires a Sigmoid Surrogate Gradient.
- **Liquid Synapses (LNN)**: Synaptic weights adapt dynamically using continuous-time differential equations dependent on the sequence.
- **Test-Time Training (TTT)**: The model is not completely frozen during inference! It calculates a self-supervised reconstruction gradient *within the forward pass* to auto-adapt its LoRA fast-weights before generating predictions.
- **Matrix Product States (MPS)**: Dense transformations $O(N^2)$ are entirely replaced by compressed quantum Tensor Network chains $O(N \cdot r)$.

---

## Key Design Decisions

### Why Heterogeneous Expert Activations?

Each expert uses a different activation function (SiLU, GELU, Mish, ReLU, SELU, Tanh, etc.) to encourage **functional diversity**. Research shows that homogeneous experts tend to converge to similar representations, reducing the benefit of the MoE architecture.

### Why Learnable Scale Parameters (α, θ, etc.)?

All new architectural components are gated by a **learnable scalar initialized to 0**. This ensures:
1. **Stable warm-start**: Loading a base checkpoint reproduces the original model's behavior exactly.
2. **Gradual adaptation**: The model learns how much to rely on new components during fine-tuning.

### Why Per-Expert LoRA Adapters?

LoRA adapters (low-rank matrices) add lightweight correction capacity to each expert without dramatically increasing parameter count. This is especially effective for fine-tuning on domain-specific data where each expert may need slight behavioral adjustments.

### Why Dynamic Bias Instead of Auxiliary Loss?

Auxiliary load-balancing losses (like the Switch Transformer loss) interfere with the primary training objective and require careful tuning of the loss weight. Dynamic bias adjustment:
- Operates outside the gradient graph (no interference with backprop).
- Self-corrects in real-time based on actual expert utilization.
- Requires no hyperparameter tuning beyond the bias learning rate.
