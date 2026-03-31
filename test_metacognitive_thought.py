import torch
import torch.nn as nn
import sys
import os

sys.path.append(os.path.join(os.getcwd(), 'source'))

from model_variants import ChampionNetMetaCognitiveExpert

def smoke_test_metacognitive():
    print("Starting smoke test for MetaCognitiveExpert (v16) architecture...")
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    model = ChampionNetMetaCognitiveExpert(
        n_proposal_experts=6, n_critique_experts=4, reasoning_steps=3
    ).to(device)
    model.train()
    
    # Force alpha/beta to 1.0 for gradient visibility
    for name, param in model.named_parameters():
        if name in ('layers.10.alpha', 'layers.10.beta'):
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
        'proposal_up': False,
        'critique_up': False,
        'reasoning_cells': False,
        'halt_gates': False,
        'proposal_gates': False,
        'critique_gates': False,
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

    # 3. Inference Pass (Test Early Exit)
    print("\nRunning inference pass (eval mode) to test early exit...")
    model.eval()
    with torch.no_grad():
        easy_input = torch.randn(2, 1, 128).to(device) * 10
        logits_inf = model(easy_input)
        print(f"Inference output shape: {logits_inf.shape}")

    print("Smoke test PASSED!")

if __name__ == "__main__":
    try:
        smoke_test_metacognitive()
    except Exception as e:
        print(f"Smoke test FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
