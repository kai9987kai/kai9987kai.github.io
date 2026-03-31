import torch
import torch.nn as nn
import sys
import os

sys.path.append(os.path.join(os.getcwd(), 'source'))

from model_variants import ChampionNetLiquidSpikingExpert

def smoke_test_liquid_spiking():
    print("Starting smoke test for Liquid Spiking Tensor Expert (v26)...")
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    # 2 sample inputs, 1 timestep, 128 hidden dim
    model = ChampionNetLiquidSpikingExpert(spiking_steps=4, mps_rank=8, dropout=0.0).to(device)
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
    # This also runs the internal TTT forward/backward pass
    logits = model(dummy_input)
    print(f"Output shape: {logits.shape}")
    assert logits.shape == (2, 1, 10), f"Expected shape (2, 1, 10), got {logits.shape}"
    
    # 2. Backward Pass
    print("Running global backward pass...")
    target = torch.randint(0, 10, (2, 1)).to(device)
    loss = nn.functional.cross_entropy(logits.view(-1, 10), target.view(-1))
    print(f"Loss value: {loss.item()}")
    loss.backward()
    
    print("Checking gradients...")
    checks = {
        'ttt_lora_A': False,           # TTT adapter A
        'ttt_lora_B': False,           # TTT adapter B
        'ttt_decoder.weight': False,   # TTT aux task decoder
        'liquid_synapse.core_1': False,# Tensor Network MPS
        'liquid_synapse.core_2': False,# Tensor Network MPS
        'liquid_synapse.liquid_gate': False, # Liquid neural net gate
        'liquid_synapse.tau': False,   # Liquid time constant
        'lif_neuron.threshold': False, # Spiking neuron threshold
        'lif_neuron.alpha': False,     # Surrogate gradient sharpness
        'spike_decoder.weight': False, # Neuro-symbolic out
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
        smoke_test_liquid_spiking()
    except Exception as e:
        print(f"Smoke test FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
