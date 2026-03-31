import torch
import torch.nn as nn
import sys
import os

sys.path.append(os.path.join(os.getcwd(), 'source'))

from model_variants import ChampionNetTranscendentExpert

def smoke_test_transcendent():
    print("Starting smoke test for Transcendent Architect Expert (v23) architecture...")
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    model = ChampionNetTranscendentExpert(
        n_subproblems=4, pop_size=6, denoise_steps=4
    ).to(device)
    model.train()
    
    # Force alpha to 1.0 for gradient visibility
    for name, param in model.named_parameters():
        if name == 'layers.10.alpha':
            param.data.fill_(1.0)
            print(f"Set {name} to 1.0")

    dummy_input = torch.randn(2, 1, 128).to(device)
    print(f"Dummy input shape: {dummy_input.shape}")
    
    # 1. Forward Pass
    print("Running forward pass (train mode)...")
    logits = model(dummy_input)
    print(f"Output shape: {logits.shape}")
    assert logits.shape == (2, 1, 10), f"Expected shape (2, 1, 10), got {logits.shape}"
    
    # 2. Backward Pass
    print("Running backward pass...")
    target = torch.randint(0, 10, (2, 1)).to(device)
    loss = nn.functional.cross_entropy(logits.view(-1, 10), target.view(-1))
    print(f"Loss value: {loss.item()}")
    loss.backward()
    
    print("Checking gradients...")
    checks = {
        'decompose_heads': False,    # Compositional Decomposition
        'denoiser.0': False,         # Diffusion Step 0
        'denoiser.3': False,         # Diffusion Step 3
        'time_embed': False,         # Timestep embeddings
        'log_betas': False,          # Learnable noise schedule
        'world_transition': False,   # World Model transition
        'world_value': False,        # World Model value
        'fitness_proj': False,       # Evolution fitness scoring
        'crossover_net': False,      # Evolution crossover
        'attn_q': False,             # Self-Modifying Attention Q
        'meta_q_mod': False,         # Meta-controller Q modifier
        'meta_k_mod': False,         # Meta-controller K modifier
        'composer': False,           # Final composition
        'shared_up': False,          # Shared Expert
    }
    
    for name, param in model.named_parameters():
        for key in checks:
            if key in name and param.grad is not None and param.grad.abs().sum() > 0:
                checks[key] = True

    for key, found in checks.items():
        status = "OK" if found else "CRITICAL: NO GRADIENT!"
        print(f"  {key}: {status}")

    all_ok = all(checks.values())
    if not all_ok:
        failed = [k for k, v in checks.items() if not v]
        raise AssertionError(f"Missing gradients in: {failed}")
    
    print("All gradients verified successfully.")

    # 3. Inference Pass (eval)
    print("\nRunning inference pass (eval mode)...")
    model.eval()
    with torch.no_grad():
        logits_inf = model(torch.randn(2, 1, 128).to(device))
        print(f"Inference output shape: {logits_inf.shape}")
        assert logits_inf.shape == (2, 1, 10)
    
    # 4. Parameter count
    total = sum(p.numel() for p in model.parameters())
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"\nParameter count: {trainable:,} trainable / {total:,} total")

    print("\nSmoke test PASSED!")

if __name__ == "__main__":
    try:
        smoke_test_transcendent()
    except Exception as e:
        print(f"Smoke test FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
