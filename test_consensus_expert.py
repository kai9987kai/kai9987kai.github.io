import torch
import torch.nn as nn
import sys
import os

sys.path.append(os.path.join(os.getcwd(), 'source'))

from model_variants import ChampionNetConsensusExpert

def smoke_test_consensus():
    print("Starting smoke test for Consensus Expert (v18) architecture...")
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    model = ChampionNetConsensusExpert(
        n_mlp_experts=6, n_attn_heads=4, conv_channels=64
    ).to(device)
    model.train()
    
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
        'mlp_up': False,       # Pathway 1: MLP MoE
        'mlp_gate': False,     # Pathway 1: Sigma Gate
        'attn_q': False,       # Pathway 2: Attention
        'attn_embed': False,   # Pathway 2: Learned embeddings
        'conv1': False,        # Pathway 3: Convolution
        'conv_proj': False,    # Pathway 3: Conv projection
        'consensus': False,    # Consensus arbiter
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
    print("Smoke test PASSED!")

if __name__ == "__main__":
    try:
        smoke_test_consensus()
    except Exception as e:
        print(f"Smoke test FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
