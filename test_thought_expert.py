import torch
import sys
import os

# Add source to path
sys.path.append(os.path.join(os.getcwd(), 'source'))

from model_variants import ChampionNetThoughtExpert

def smoke_test_thought_expert():
    print("Starting smoke test for ThoughtExpert architecture...")
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    # Instance model
    # We use default params: n_experts=8, reasoning_steps=3
    model = ChampionNetThoughtExpert(n_experts=8, reasoning_steps=3).to(device)
    model.train()
    
    # Crucial: alpha starts at 0.0, so we must set it to > 0 to see gradients from the reasoning loop
    # We will search for 'alpha' in the classifier head (layer 10)
    found_alpha = False
    for name, param in model.named_parameters():
        if 'alpha' in name:
            print(f"Forcing {name} to 1.0 for gradient verification")
            param.data.fill_(1.0)
            found_alpha = True
    
    if not found_alpha:
        print("WARNING: Could not find 'alpha' parameter in model!")

    # Dummy input (Batch=2, Seq=1, Dim=128)
    dummy_input = torch.randn(2, 1, 128).to(device)
    print(f"Dummy input shape: {dummy_input.shape}")
    
    # Forward pass
    print("Running forward pass...")
    try:
        logits = model(dummy_input)
    except Exception as e:
        print(f"CAUGHT ERROR in Forward Pass: {e}")
        # Let it propagate to show traceback if needed
        raise e
    
    print(f"Output shape: {logits.shape}")
    assert logits.shape == (2, 1, 10), f"Expected shape (2, 1, 10), got {logits.shape}"
    
    # Backward pass
    print("Running backward pass...")
    target = torch.randint(0, 10, (2, 1)).to(device)
    loss = torch.nn.functional.cross_entropy(logits.view(-1, 10), target.view(-1))
    loss.backward()
    
    print("Checking gradients...")
    # Check if any parameter in the reasoning loop got gradients
    found_grad = False
    for name, param in model.named_parameters():
        if param.grad is not None and param.grad.abs().sum() > 0:
            if 'reasoning_cells' in name:
                print(f"Found gradient in {name}: {param.grad.abs().mean().item():.2e}")
                found_grad = True
            elif 'gates' in name:
                print(f"Found gradient in {name}: {param.grad.abs().mean().item():.2e}")
            elif 'cross_attn' in name:
                print(f"Found gradient in {name}: {param.grad.abs().mean().item():.2e}")
    
    if not found_grad:
        print("ERROR: Gradients are ZERO in all reasoning cells.")
        # Print some non-reasoning grads to see if backprop is working at all
        for name, param in model.named_parameters():
            if 'weight' in name and 'layers.0' in name:
                print(f"Backbone gradient in {name}: {param.grad.abs().mean().item() if param.grad is not None else 'None'}")
    
    assert found_grad, "No gradients found in reasoning cells!"
    print("Smoke test PASSED!")

if __name__ == "__main__":
    try:
        smoke_test_thought_expert()
    except Exception as e:
        print(f"Smoke test FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
