import torch
import torch.nn as nn
import sys
import os

sys.path.append(os.path.join(os.getcwd(), 'source'))

from model_variants import ChampionNetNeurogenesisExpert

def smoke_test_neurogenesis():
    print("Starting smoke test for Neurogenesis Expert (v21) architecture...")
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    model = ChampionNetNeurogenesisExpert(
        n_experts=6, n_levels=3, n_knowledge_slots=32, debate_rounds=3
    ).to(device)
    model.train()
    
    # Force alpha to 1.0 for gradient visibility
    for name, param in model.named_parameters():
        if name == 'layers.10.alpha':
            param.data.fill_(1.0)
            print(f"Set {name} to 1.0")

    dummy_input = torch.randn(2, 1, 128).to(device)
    print(f"Dummy input shape: {dummy_input.shape}")
    
    # 1. Forward Pass (Training)
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
        'knowledge_keys': False,      # Cross-Level Knowledge Banks
        'knowledge_queries': False,    # Knowledge query projections
        'level_up_projs': False,       # Hierarchical Abstraction (up)
        'distill_bridges': False,      # Cross-Level Distillation
        'proposer_up': False,          # Proposer MoE
        'proposer_gates': False,       # Proposer routing
        'adversary_up': False,         # Adversary MoE
        'adversary_gates': False,      # Adversary routing
        'synthesis_net': False,        # Emergent Expert Synthesis
        'resolution': False,           # Debate Resolution
        'confidence_gates': False,     # Confidence Calibration
        'level_fusion': False,         # Level Fusion
        'shared_up': False,            # Shared Expert
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

    # 3. Inference Pass (eval with early exit)
    print("\nRunning inference pass (eval mode)...")
    model.eval()
    with torch.no_grad():
        logits_inf = model(torch.randn(2, 1, 128).to(device) * 10)
        print(f"Inference output shape: {logits_inf.shape}")
        assert logits_inf.shape == (2, 1, 10)
    
    # 4. Parameter count
    total = sum(p.numel() for p in model.parameters())
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"\nParameter count: {trainable:,} trainable / {total:,} total")

    print("\nSmoke test PASSED!")

if __name__ == "__main__":
    try:
        smoke_test_neurogenesis()
    except Exception as e:
        print(f"Smoke test FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
