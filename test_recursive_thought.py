import torch
import torch.nn as nn
import sys
import os

# Add source to path
sys.path.append(os.path.join(os.getcwd(), 'source'))

from model_variants import ChampionNetRecursiveExpert

def smoke_test_recursive_thought():
    print("Starting smoke test for RecursiveThoughtExpert architecture...")
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    # Instance model
    model = ChampionNetRecursiveExpert(n_experts=8, reasoning_steps=3).to(device)
    model.train()
    
    # Set alpha to 1.0 to ensure reasoning loop flow
    for name, param in model.named_parameters():
        if 'alpha' in name:
            param.data.fill_(1.0)
            print(f"Set {name} to 1.0")

    # Dummy input (Batch=2, Seq=1, Dim=128)
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
        'layers.10.shared_scale', 
        'layers.10.local_scale',
        'layers.10.reasoning_cells.0.up.weight',
        'layers.10.gates.0.weight',
        'layers.10.exit_gates.0.weight'
    ]
    
    for name, param in model.named_parameters():
        if any(hp in name for hp in head_params):
            grad_val = param.grad.abs().sum().item() if param.grad is not None else "None"
            print(f"DEBUG: {name} grad sum: {grad_val}")

    found_reasoning_grad = any(p.grad is not None and p.grad.abs().sum() > 0 for n, p in model.named_parameters() if 'reasoning_cells' in n)
    found_gate_grad = any(p.grad is not None and p.grad.abs().sum() > 0 for n, p in model.named_parameters() if 'gates' in n)
    found_exit_grad = any(p.grad is not None and p.grad.abs().sum() > 0 for n, p in model.named_parameters() if 'exit_gates' in n)
    
    # Check backbone grads
    found_backbone_grad = any(p.grad is not None and p.grad.abs().sum() > 0 for n, p in model.named_parameters() if 'layers.0' in n)
    print(f"Backbone grad present: {found_backbone_grad}")

    if not found_reasoning_grad:
        print("CRITICAL: Reasoning cells have NO gradient!")
    if not found_gate_grad:
        print("CRITICAL: Gates have NO gradient!")
    if not found_exit_grad:
        print("CRITICAL: Exit gates have NO gradient!")

    assert found_reasoning_grad, "No gradients found in reasoning cells!"
    assert found_gate_grad, "No gradients found in multi-head gates!"
    assert found_exit_grad, "No gradients found in exit gates!"
    print("Gradients verified successfully.")

    # 3. Inference Pass (Testing Early Exit)
    print("\nRunning inference pass (eval mode) to test early exit...")
    model.eval()
    with torch.no_grad():
        # Force high confidence for early exit by making features large
        easy_input = torch.randn(2, 1, 128).to(device) * 10
        logits_inf = model(easy_input)
        print(f"Inference output shape: {logits_inf.shape}")

    print("Smoke test PASSED!")

if __name__ == "__main__":
    try:
        smoke_test_recursive_thought()
    except Exception as e:
        print(f"Smoke test FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
