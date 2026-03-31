import os
import sys

import torch
import torch.nn.functional as F


sys.path.append(os.path.join(os.getcwd(), "source"))

from model_variants import (  # noqa: E402
    ChampionNet,
    build_model,
    detect_model_size_from_state_dict,
    load_weights_for_model,
)


def test_test_time_diff_expert_builds_and_runs_forward():
    model = build_model("test_time_diff_expert", dropout=0.0)
    model.eval()

    dummy_input = torch.randn(2, 3, 128)
    with torch.no_grad():
        logits = model(dummy_input)

    assert logits.shape == (2, 3, 10)
    assert torch.isfinite(logits).all()

    head = model.layers[10]
    assert head.last_thinking_steps >= 1
    assert head.last_thinking_steps <= head.max_thinking_steps
    assert head.last_energy >= 0.0
    assert torch.isfinite(torch.tensor(head.last_update_norm))


def test_test_time_diff_expert_differential_attention_and_gradients():
    model = build_model("test_time_diff_expert", dropout=0.0)
    model.train()

    head = model.layers[10]
    head.alpha.data.fill_(1.0)
    head.beta.data.fill_(0.5)
    head.gamma.data.fill_(0.5)

    probe = torch.randn(2, 4, 256)
    pos_attn, neg_attn, diff_attn = head.compute_differential_attention_maps(probe)

    assert pos_attn.shape == neg_attn.shape == diff_attn.shape
    assert torch.isfinite(pos_attn).all()
    assert torch.isfinite(neg_attn).all()
    assert torch.isfinite(diff_attn).all()
    assert torch.all(diff_attn.abs().sum(dim=-1) <= 1.0001)

    dummy_input = torch.randn(2, 2, 128)
    target = torch.randint(0, 10, (2, 2))
    logits = model(dummy_input)
    loss = F.cross_entropy(logits.view(-1, 10), target.view(-1))
    loss.backward()

    grad_checks = [
        "layers.10.diff_q_pos.weight",
        "layers.10.diff_q_neg.weight",
        "layers.10.hyper_diag.weight",
        "layers.10.hyper_gate.weight",
        "layers.10.predictive_prior.weight",
        "layers.10.gate.weight",
    ]
    named_params = dict(model.named_parameters())
    for key in grad_checks:
        grad = named_params[key].grad
        assert grad is not None, f"missing gradient for {key}"
        assert grad.abs().sum().item() > 0.0, f"zero gradient for {key}"

    assert head.last_update_norm < 50.0


def test_test_time_diff_expert_eval_halts_and_warm_starts_from_base():
    model = build_model("test_time_diff_expert", dropout=0.0)
    head = model.layers[10]
    head.halt_threshold = 0.0
    head.energy_threshold = 1_000_000.0

    missing, unexpected = load_weights_for_model(model, ChampionNet().state_dict(), "test_time_diff_expert")
    assert missing == []
    assert unexpected == []

    model.eval()
    with torch.no_grad():
        logits = model(torch.randn(2, 1, 128))

    assert logits.shape == (2, 1, 10)
    assert head.last_thinking_steps == 1
    assert detect_model_size_from_state_dict(model.state_dict()) == "test_time_diff_expert"


if __name__ == "__main__":
    import pytest

    raise SystemExit(pytest.main([__file__]))
