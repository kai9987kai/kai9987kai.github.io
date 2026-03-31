import torch
import torch.nn as nn
import sys
import os

sys.path.append(os.path.join(os.getcwd(), 'source'))

from model_variants import ChampionNetReflexiveExpert, ReflexiveThoughtExpertHead

def smoke_test_reflexive_thought():
    print("Starting smoke test for ReflexiveThoughtExpert architecture...")
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    # Instance model
    model = ChampionNetReflexiveExpert(n_experts=4).to(device)
    model.train()
    
    # Set beta to 1.0 to ensure critique pass gradients flow strongly for the test
    for name, param in model.named_parameters():
        if 'beta' in name or 'alpha' in name:
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
    loss = torch.nn.functional.cross_entropy(logits.view(-1, 10), target.view(-1))
    print(f"Loss value: {loss.item()}")
    loss.backward()
    
    print("Checking gradients...")
    # Check key head parameters
    head_params = [
        'layers.10.alpha', 
        'layers.10.beta', 
        'layers.10.initial_gate.weight',
        'layers.10.critique_gate.weight',
        'layers.10.initial_up.0.weight',
        'layers.10.critique_up.0.weight'
    ]
    
    for name, param in model.named_parameters():
        if any(hp in name for hp in head_params):
            grad_val = param.grad.abs().sum().item() if param.grad is not None else "None"
            print(f"DEBUG: {name} grad sum: {grad_val}")

    found_initial_grad = any(p.grad is not None and p.grad.abs().sum() > 0 for n, p in model.named_parameters() if 'initial_up' in n)
    found_critique_grad = any(p.grad is not None and p.grad.abs().sum() > 0 for n, p in model.named_parameters() if 'critique_up' in n)
    
    if not found_initial_grad:
        print("CRITICAL: Initial experts have NO gradient!")
    if not found_critique_grad:
        print("CRITICAL: Critique experts have NO gradient!")

    assert found_initial_grad, "No gradients found in initial experts!"
    assert found_critique_grad, "No gradients found in critique experts!"
    print("Gradients verified successfully.")

    print("Smoke test PASSED!")

if __name__ == "__main__":
    try:
        smoke_test_reflexive_thought()
    except Exception as e:
        print(f"Smoke test FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
