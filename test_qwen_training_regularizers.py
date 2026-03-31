import os
import sys

import torch
import torch.nn as nn


sys.path.append(os.path.join(os.getcwd(), "source"))

from qwen_supermix_pipeline import (
    _build_optimizer_param_groups,
    _dpo_preference_loss,
    _ipo_preference_loss,
    _ipo_target_gap,
    _is_lora_b_parameter,
    _replace_neftune_hook,
    _robust_preference_correctness_weights,
    _sigmoid_preference_loss,
    _symmetric_token_kl,
    _weighted_mean,
    _wpo_pair_weights,
    _xpo_log_ratio_transform,
    _xpo_preference_loss,
)


def test_weighted_mean_matches_plain_mean_without_weights():
    values = torch.tensor([1.0, 3.0, 5.0])
    got = _weighted_mean(values)
    assert torch.allclose(got, values.mean())


def test_symmetric_token_kl_is_zero_for_identical_logits():
    logits = torch.tensor(
        [
            [
                [2.0, 0.0, -1.0],
                [1.5, 0.1, -0.5],
                [0.3, 1.4, -1.2],
            ]
        ],
        dtype=torch.float32,
    )
    labels = torch.tensor([[0, 1, 2]], dtype=torch.long)
    kl = _symmetric_token_kl(logits, logits.clone(), labels)
    assert kl.shape == (1,)
    assert float(kl.item()) < 1e-7


def test_symmetric_token_kl_ignores_masked_positions():
    logits_a = torch.tensor(
        [
            [
                [2.0, 0.0, -1.0],
                [1.5, 0.1, -0.5],
                [0.3, 1.4, -1.2],
            ]
        ],
        dtype=torch.float32,
    )
    logits_b = logits_a.clone()
    logits_b[:, 2, :] += torch.tensor([4.0, -4.0, 0.0])
    labels = torch.tensor([[0, 1, -100]], dtype=torch.long)
    kl = _symmetric_token_kl(logits_a, logits_b, labels)
    assert float(kl.item()) < 1e-7


def test_wpo_pair_weights_normalize_and_prioritize_higher_probability_pairs():
    chosen_logp = torch.tensor([-0.2, -1.6, -0.4], dtype=torch.float32)
    rejected_logp = torch.tensor([-0.3, -1.4, -0.8], dtype=torch.float32)
    weights = _wpo_pair_weights(chosen_logp, rejected_logp, alpha=1.0, clip=3.0)
    assert weights.shape == chosen_logp.shape
    assert torch.allclose(weights.mean(), torch.tensor(1.0), atol=1e-5)
    assert float(weights[0].item()) > float(weights[1].item())
    assert float(weights[2].item()) > float(weights[1].item())


def test_wpo_pair_weights_disable_cleanly():
    chosen_logp = torch.tensor([-0.5, -0.9], dtype=torch.float32)
    rejected_logp = torch.tensor([-0.7, -1.1], dtype=torch.float32)
    weights = _wpo_pair_weights(chosen_logp, rejected_logp, alpha=0.0, clip=2.0)
    assert torch.allclose(weights, torch.ones_like(chosen_logp))


def test_sigmoid_preference_loss_matches_unsmoothed_logistic_case():
    logits_delta = torch.tensor([1.2, -0.4], dtype=torch.float32)
    loss = _sigmoid_preference_loss(logits_delta, label_smoothing=0.0)
    expected = -torch.nn.functional.logsigmoid(logits_delta)
    assert torch.allclose(loss, expected)


def test_sigmoid_preference_loss_label_smoothing_softens_negative_examples():
    logits_delta = torch.tensor([-1.5], dtype=torch.float32)
    plain = _sigmoid_preference_loss(logits_delta, label_smoothing=0.0)
    smooth = _sigmoid_preference_loss(logits_delta, label_smoothing=0.1)
    assert float(smooth.item()) < float(plain.item())


def test_dpo_preference_loss_rewards_improvement_over_reference():
    delta = torch.tensor([0.7], dtype=torch.float32)
    weak_ref = torch.tensor([0.1], dtype=torch.float32)
    strong_ref = torch.tensor([0.5], dtype=torch.float32)
    better = _dpo_preference_loss(delta, weak_ref, beta=2.0, margin=0.0, label_smoothing=0.0)
    worse = _dpo_preference_loss(delta, strong_ref, beta=2.0, margin=0.0, label_smoothing=0.0)
    assert float(better.item()) < float(worse.item())


def test_ipo_target_gap_matches_closed_form():
    assert abs(_ipo_target_gap(beta=2.0, margin=0.1) - 0.35) < 1e-8


def test_ipo_preference_loss_is_smallest_at_finite_target_gap():
    beta = 2.0
    target_gap = _ipo_target_gap(beta=beta, margin=0.0)
    ref_delta = torch.tensor([0.1], dtype=torch.float32)
    on_target = _ipo_preference_loss(
        delta=torch.tensor([0.1 + target_gap], dtype=torch.float32),
        ref_delta=ref_delta,
        beta=beta,
        margin=0.0,
    )
    under_target = _ipo_preference_loss(
        delta=torch.tensor([0.1], dtype=torch.float32),
        ref_delta=ref_delta,
        beta=beta,
        margin=0.0,
    )
    over_target = _ipo_preference_loss(
        delta=torch.tensor([0.1 + 2.0 * target_gap], dtype=torch.float32),
        ref_delta=ref_delta,
        beta=beta,
        margin=0.0,
    )
    assert float(on_target.item()) < float(under_target.item())
    assert float(on_target.item()) < float(over_target.item())


def test_robust_preference_correctness_weights_prioritize_confident_pairs():
    logits = torch.tensor([2.5, 0.0, -2.0], dtype=torch.float32)
    weights = _robust_preference_correctness_weights(logits, alpha=1.0, noise_eta=0.1, clip=3.0)
    assert weights.shape == logits.shape
    assert torch.allclose(weights.mean(), torch.tensor(1.0), atol=1e-5)
    assert float(weights[0].item()) > float(weights[1].item()) > float(weights[2].item())


def test_robust_preference_correctness_weights_disable_cleanly():
    logits = torch.tensor([1.0, -1.0], dtype=torch.float32)
    weights = _robust_preference_correctness_weights(logits, alpha=0.0, noise_eta=0.2, clip=2.0)
    assert torch.allclose(weights, torch.ones_like(logits))


class _FakeLoRAModule(nn.Module):
    def __init__(self):
        super().__init__()
        self.core = nn.Linear(2, 2, bias=False)
        self.adapter = nn.Module()
        self.adapter.register_parameter("lora_A_weight", nn.Parameter(torch.randn(2, 2)))
        self.adapter.register_parameter("lora_B_weight", nn.Parameter(torch.randn(2, 2)))
        self.adapter.register_parameter("lora_magnitude_vector", nn.Parameter(torch.randn(2)))


class _FakeEmbeddingModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.emb = nn.Embedding(8, 4)

    def get_input_embeddings(self):
        return self.emb


def test_is_lora_b_parameter_detects_expected_names():
    assert _is_lora_b_parameter("model.layers.0.self_attn.q_proj.lora_B.default.weight")
    assert _is_lora_b_parameter("adapter.lora_B_weight")
    assert not _is_lora_b_parameter("adapter.lora_A_weight")
    assert not _is_lora_b_parameter("adapter.lora_magnitude_vector")


def test_build_optimizer_param_groups_splits_fast_lora_b_params():
    model = _FakeLoRAModule()
    groups, stats = _build_optimizer_param_groups(model, base_lr=1e-4, weight_decay=0.01, lora_plus_ratio=16.0)
    assert len(groups) == 2
    lrs = sorted(float(g["lr"]) for g in groups)
    assert lrs == [1e-4, 1.6e-3]
    assert float(stats["lora_plus_ratio"]) == 16.0
    assert int(stats["lora_plus_fast_group_params"]) == 1
    assert int(stats["lora_plus_base_group_params"]) == 3


def test_build_optimizer_param_groups_disables_when_ratio_not_enabled():
    model = _FakeLoRAModule()
    groups, stats = _build_optimizer_param_groups(model, base_lr=2e-4, weight_decay=0.0, lora_plus_ratio=1.0)
    assert len(groups) == 1
    assert float(groups[0]["lr"]) == 2e-4
    assert float(stats["lora_plus_ratio"]) == 0.0


def test_xpo_log_ratio_transform_matches_closed_form():
    log_ratio = torch.tensor([-0.5, 0.0, 0.7], dtype=torch.float32)
    got = _xpo_log_ratio_transform(log_ratio)
    expected = torch.exp(log_ratio) + log_ratio
    assert torch.allclose(got, expected)


def test_xpo_preference_loss_rewards_better_reference_relative_policy():
    chosen_logp = torch.tensor([-0.4], dtype=torch.float32)
    rejected_logp = torch.tensor([-1.0], dtype=torch.float32)
    weak_ref_chosen = torch.tensor([-0.8], dtype=torch.float32)
    weak_ref_rejected = torch.tensor([-0.9], dtype=torch.float32)
    strong_ref_chosen = torch.tensor([-0.45], dtype=torch.float32)
    strong_ref_rejected = torch.tensor([-0.95], dtype=torch.float32)
    better = _xpo_preference_loss(
        chosen_logp=chosen_logp,
        rejected_logp=rejected_logp,
        ref_chosen_logp=weak_ref_chosen,
        ref_rejected_logp=weak_ref_rejected,
        beta=1.5,
        clip=0.0,
        label_smoothing=0.0,
    )
    worse = _xpo_preference_loss(
        chosen_logp=chosen_logp,
        rejected_logp=rejected_logp,
        ref_chosen_logp=strong_ref_chosen,
        ref_rejected_logp=strong_ref_rejected,
        beta=1.5,
        clip=0.0,
        label_smoothing=0.0,
    )
    assert float(better.item()) < float(worse.item())


def test_xpo_preference_loss_clip_limits_extreme_logits():
    chosen_logp = torch.tensor([0.0], dtype=torch.float32)
    rejected_logp = torch.tensor([-5.0], dtype=torch.float32)
    ref_chosen = torch.tensor([-5.0], dtype=torch.float32)
    ref_rejected = torch.tensor([0.0], dtype=torch.float32)
    unclipped = _xpo_preference_loss(
        chosen_logp=chosen_logp,
        rejected_logp=rejected_logp,
        ref_chosen_logp=ref_chosen,
        ref_rejected_logp=ref_rejected,
        beta=4.0,
        clip=0.0,
        label_smoothing=0.0,
    )
    clipped = _xpo_preference_loss(
        chosen_logp=chosen_logp,
        rejected_logp=rejected_logp,
        ref_chosen_logp=ref_chosen,
        ref_rejected_logp=ref_rejected,
        beta=4.0,
        clip=2.0,
        label_smoothing=0.0,
    )
    assert float(clipped.item()) > 0.0
    assert float(clipped.item()) > float(unclipped.item())


def test_replace_neftune_hook_enables_and_removes_noise_cleanly():
    torch.manual_seed(0)
    model = _FakeEmbeddingModel().train()
    tokens = torch.tensor([[1, 2, 3]], dtype=torch.long)
    baseline = model.get_input_embeddings()(tokens).detach().clone()
    hook = _replace_neftune_hook(model, None, noise_alpha=5.0)
    assert hook is not None
    noisy = model.get_input_embeddings()(tokens).detach().clone()
    assert not torch.allclose(noisy, baseline)
    hook = _replace_neftune_hook(model, hook, noise_alpha=0.0)
    assert hook is None
    restored = model.get_input_embeddings()(tokens).detach().clone()
    assert torch.allclose(restored, baseline)


if __name__ == "__main__":
    tests = [
        test_weighted_mean_matches_plain_mean_without_weights,
        test_symmetric_token_kl_is_zero_for_identical_logits,
        test_symmetric_token_kl_ignores_masked_positions,
        test_wpo_pair_weights_normalize_and_prioritize_higher_probability_pairs,
        test_wpo_pair_weights_disable_cleanly,
        test_sigmoid_preference_loss_matches_unsmoothed_logistic_case,
        test_sigmoid_preference_loss_label_smoothing_softens_negative_examples,
        test_dpo_preference_loss_rewards_improvement_over_reference,
        test_ipo_target_gap_matches_closed_form,
        test_ipo_preference_loss_is_smallest_at_finite_target_gap,
        test_robust_preference_correctness_weights_prioritize_confident_pairs,
        test_robust_preference_correctness_weights_disable_cleanly,
        test_is_lora_b_parameter_detects_expected_names,
        test_build_optimizer_param_groups_splits_fast_lora_b_params,
        test_build_optimizer_param_groups_disables_when_ratio_not_enabled,
        test_xpo_log_ratio_transform_matches_closed_form,
        test_xpo_preference_loss_rewards_better_reference_relative_policy,
        test_xpo_preference_loss_clip_limits_extreme_logits,
        test_replace_neftune_hook_enables_and_removes_noise_cleanly,
    ]
    for test in tests:
        print(f"Running {test.__name__}...")
        test()
    print("All qwen training regularizer tests passed.")
