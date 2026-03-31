import torch
import torch.nn as nn
import sys
import os

sys.path.append(os.path.join(os.getcwd(), 'source'))

from model_variants import ChampionNetOmniscientExpert

def smoke_test_omniscient():
    print("Starting smoke test for Omniscient Synergy Expert (v20) architecture...")
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    model = ChampionNetOmniscientExpert(
        n_experts=6, n_nodes=4, n_knowledge_slots=64, reasoning_steps=3
    ).to(device)
    model.train()
    
    # Force alpha to 1.0 for gradient visibility
    for name, param in model.named_parameters():
        if name == 'layers.10.alpha':
            param.data.fill_(1.0)
            print(f"Set {name} to 1.0")

    # Use a tiny input for fast checking
    dummy_input = torch.randn(2, 1, 128).to(device)
    print(f"Dummy input shape: {dummy_input.shape}")
    
    # 1. Forward Pass (Training - includes reparameterization trick)
    print("Running forward pass (train mode)...")
    logits = model(dummy_input)
    print(f"Output shape: {logits.shape}")
    assert logits.shape == (2, 1, 10), f"Expected shape (2, 1, 10), got {logits.shape}"
    assert hasattr(model.layers[10], 'last_kl_loss'), "Missing KL divergence loss attribute"
    print(f"KL Loss reported: {model.layers[10].last_kl_loss.item():.6f}")
    
    # 2. Backward Pass
    print("Running backward pass...")
    target = torch.randint(0, 10, (2, 1)).to(device)
    
    # Total loss = CE + KL
    ce_loss = nn.functional.cross_entropy(logits.view(-1, 10), target.view(-1))
    total_loss = ce_loss + model.layers[10].last_kl_loss
    
    print(f"Total Loss value: {total_loss.item()}")
    total_loss.backward()
    
    print("Checking gradients...")
    checks = {
        'knowledge_core_keys': False,  # Latent Knowledge Core
        'knowledge_query': False,      # Latent Knowledge Core
        'got_q': False,                # Graph Attention
        'got_v': False,                # Graph Attention
        'route_mu': False,             # Bayesian Routing
        'route_logvar': False,         # Bayesian Routing
        'expert_up': False,            # Experts
        'critique_net': False,         # Meta-Cognitive
        'node_halt_gates': False,      # Dynamic Depth
        'node_fusion_v': False,        # Final Pooling
        'shared_up': False,            # Base Backbone
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

    # 3. Inference Pass (Test Evaluation Mode with Temperature)
    print("\nRunning inference pass (eval mode) to test stochastic divergence and early exit...")
    model.eval()
    with torch.no_grad():
        easy_input = torch.randn(2, 1, 128).to(device) * 10
        logits_inf = model(easy_input)
        print(f"Inference output shape: {logits_inf.shape}")
        assert logits_inf.shape == (2, 1, 10)
    
    # 4. Parameter count
    total = sum(p.numel() for p in model.parameters())
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"\nParameter count: {trainable:,} trainable / {total:,} total")

    print("\nSmoke test PASSED!")

if __name__ == "__main__":
    try:
        smoke_test_omniscient()
    except Exception as e:
        print(f"Smoke test FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
