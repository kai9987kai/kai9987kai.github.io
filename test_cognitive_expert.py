import torch
import torch.nn as nn
import sys
import os

sys.path.append(os.path.join(os.getcwd(), 'source'))

from model_variants import ChampionNetCognitiveExpert

def smoke_test_cognitive():
    print("Starting smoke test for Cognitive Singularity Expert (v22) architecture...")
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    model = ChampionNetCognitiveExpert(
        n_hypotheses=4, hyper_dim=64, mem_slots=64, mem_dim=128
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
    
    # Track the orthogonality loss
    head = model.layers[10]
    ortho_loss = head.last_ortho_loss
    print(f"Orthogonality loss computed: {ortho_loss.item()}")
    assert ortho_loss.item() > 0, "Orthogonality loss should be positive"

    # 2. Backward Pass
    print("Running backward pass...")
    target = torch.randint(0, 10, (2, 1)).to(device)
    ce_loss = nn.functional.cross_entropy(logits.view(-1, 10), target.view(-1))
    
    # Include ortho penalty in backward pass to ensure gradients reach path projections
    # via the loss path specifically
    total_loss = ce_loss + 0.1 * ortho_loss
    print(f"Total Loss value: {total_loss.item()}")
    total_loss.backward()
    
    print("Checking gradients...")
    # Explicitly check keys representing all new architectural components
    checks = {
        'memory_matrix': False,      # Episodic memory state itself
        'mem_read_q': False,         # Memory reading
        'mem_write_data': False,     # Memory writing
        'hypernet.0': False,         # Hypernetwork layers
        'hypernet.3': False,
        'path_projs.0': False,       # Orthogonal superposition projections
        'value_net.0': False,        # Latent tree-search value network
        'value_net.2': False,
        'causal_q': False,           # Causal logic refinement attention
        'causal_v': False,
        'causal_norm': False,
        'shared_up': False,          # Base functionality
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

    # 3. Parameter count
    total = sum(p.numel() for p in model.parameters())
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"\nParameter count: {trainable:,} trainable / {total:,} total")

    print("\nSmoke test PASSED!")

if __name__ == "__main__":
    try:
        smoke_test_cognitive()
    except Exception as e:
        print(f"Smoke test FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
