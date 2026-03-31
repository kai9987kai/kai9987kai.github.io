"""Tests for training improvements in qwen_supermix_pipeline.py."""

import math
import os
import sys
import tempfile
from pathlib import Path

import torch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "source"))
sys.path.insert(0, os.path.dirname(__file__))


def _import_pipeline():
    from source.qwen_supermix_pipeline import (
        ChatPair,
        LengthBucketBatchSampler,
        _build_lr_lambda,
        _counterfactual_reject_variants,
        _pair_knowledge_density_score,
        _select_sft_training_pairs,
    )

    return (
        _build_lr_lambda,
        LengthBucketBatchSampler,
        _pair_knowledge_density_score,
        _select_sft_training_pairs,
        _counterfactual_reject_variants,
        ChatPair,
    )


def _import_distill_rank():
    from source.qwen_supermix_pipeline import _distillation_candidate_rank

    return _distillation_candidate_rank


def _import_pref_length_control():
    from source.qwen_supermix_pipeline import _preference_length_control_margin

    return _preference_length_control_margin


def _import_pref_stop_helpers():
    from source.qwen_supermix_pipeline import (
        _preference_stop_alignment_score,
        _reorder_scored_ids_for_self_play,
        _stop_overlong_reject_variants,
    )

    return _preference_stop_alignment_score, _stop_overlong_reject_variants, _reorder_scored_ids_for_self_play


def _import_benchmark_helpers():
    from source.qwen_supermix_pipeline import build_benchmark_sample_comparison

    return build_benchmark_sample_comparison


def _import_progress_heartbeat_helper():
    from source.qwen_supermix_pipeline import _should_log_progress_heartbeat

    return _should_log_progress_heartbeat


def _import_preference_selection_helpers():
    from source.qwen_supermix_pipeline import PreferencePair, _select_preference_pairs

    return PreferencePair, _select_preference_pairs


def _import_split_and_io_helpers():
    from source.qwen_supermix_pipeline import ChatPair, load_saved_chat_pairs, save_jsonl, split_train_eval

    return ChatPair, split_train_eval, save_jsonl, load_saved_chat_pairs


def _import_sft_packing_helpers():
    from source.qwen_supermix_pipeline import ChatPair, _pack_sft_rows, build_rows

    return ChatPair, build_rows, _pack_sft_rows


class _ToyTokenizer:
    pad_token_id = 0
    eos_token_id = 999

    def __call__(self, text, add_special_tokens=False, truncation=True, max_length=None):
        del add_special_tokens
        input_ids = [1 + (ord(ch) % 251) for ch in str(text)]
        if truncation and max_length is not None:
            input_ids = input_ids[: max(0, int(max_length))]
        return {
            "input_ids": input_ids,
            "attention_mask": [1] * len(input_ids),
        }


def _make_sft_row(
    total_tokens: int,
    supervised_tokens: int,
    sample_weight: float = 1.0,
    start_token: int = 11,
    source: str = "dataset",
):
    assert total_tokens > supervised_tokens >= 1
    input_ids = list(range(start_token, start_token + total_tokens))
    labels = [-100] * (total_tokens - supervised_tokens) + list(
        range(start_token + 1000, start_token + 1000 + supervised_tokens)
    )
    return {
        "input_ids": input_ids,
        "attention_mask": [1] * total_tokens,
        "labels": labels,
        "sample_weight": float(sample_weight),
        "sequence_tokens": int(total_tokens),
        "supervised_tokens": int(supervised_tokens),
        "source": str(source),
    }


def test_cosine_restarts_produces_periodic_peaks():
    _build_lr_lambda, _LengthBucketBatchSampler, _pair_knowledge_density_score, _select_sft_training_pairs, _counterfactual_reject_variants, ChatPair = _import_pipeline()
    lr_fn = _build_lr_lambda(
        schedule="cosine_restarts",
        warmup_steps=0,
        total_steps=100,
        min_lr_ratio=0.1,
        restart_period=10,
    )
    peaks = []
    valleys = []
    for step_idx in range(100):
        val = lr_fn(step_idx)
        step = step_idx + 1
        cycle_pos = step % 10
        if cycle_pos == 0:
            peaks.append((step, val))
        elif cycle_pos == 5:
            valleys.append((step, val))
    for step, val in peaks:
        assert val > 0.95, f"Peak at step {step} should be > 0.95, got {val:.4f}"
    for step, val in valleys:
        assert val < 0.7, f"Valley at step {step} should be < 0.7, got {val:.4f}"
    print(f"  [ok] cosine_restarts peaks={len(peaks)}")


def test_cosine_restarts_disabled_by_zero_period():
    _build_lr_lambda, _LengthBucketBatchSampler, _pair_knowledge_density_score, _select_sft_training_pairs, _counterfactual_reject_variants, ChatPair = _import_pipeline()
    lr_fn_restarts = _build_lr_lambda(
        schedule="cosine_restarts",
        warmup_steps=0,
        total_steps=100,
        min_lr_ratio=0.1,
        restart_period=0,
    )
    lr_fn_cosine = _build_lr_lambda(
        schedule="cosine",
        warmup_steps=0,
        total_steps=100,
        min_lr_ratio=0.1,
        restart_period=0,
    )
    for step_idx in range(100):
        v1 = lr_fn_restarts(step_idx)
        v2 = lr_fn_cosine(step_idx)
        assert abs(v1 - v2) < 1e-6, f"Step {step_idx}: restarts={v1}, cosine={v2}"
    print("  [ok] cosine_restarts matches cosine when period=0")


def test_constant_schedule():
    _build_lr_lambda, _LengthBucketBatchSampler, _pair_knowledge_density_score, _select_sft_training_pairs, _counterfactual_reject_variants, ChatPair = _import_pipeline()
    lr_fn = _build_lr_lambda(
        schedule="constant",
        warmup_steps=5,
        total_steps=50,
        min_lr_ratio=0.1,
    )
    assert lr_fn(0) < 1.0, "Step 1 should still be in warmup"
    for step_idx in range(5, 50):
        val = lr_fn(step_idx)
        assert abs(val - 1.0) < 1e-6, f"Step {step_idx}: expected 1.0, got {val}"
    print("  [ok] constant schedule")


def test_cosine_schedule_decay():
    _build_lr_lambda, _LengthBucketBatchSampler, _pair_knowledge_density_score, _select_sft_training_pairs, _counterfactual_reject_variants, ChatPair = _import_pipeline()
    lr_fn = _build_lr_lambda(
        schedule="cosine",
        warmup_steps=0,
        total_steps=100,
        min_lr_ratio=0.15,
    )
    first = lr_fn(0)
    last = lr_fn(99)
    assert first > 0.9, f"First step should be near 1.0, got {first}"
    assert last < 0.25, f"Last step should be near min_lr_ratio, got {last}"
    prev = 2.0
    for step_idx in range(100):
        val = lr_fn(step_idx)
        assert val <= prev + 1e-6, f"Step {step_idx}: LR went up from {prev} to {val}"
        prev = val
    print("  [ok] cosine schedule decay")


def test_focal_weight_modulation():
    easy_loss = torch.tensor([0.1, 0.2, 0.15])
    hard_loss = torch.tensor([2.0, 3.0, 2.5])
    gamma = 2.0

    easy_weight = (1.0 - torch.exp(-easy_loss)).pow(gamma)
    hard_weight = (1.0 - torch.exp(-hard_loss)).pow(gamma)

    assert easy_weight.mean() < hard_weight.mean()
    assert easy_weight.mean() < 0.1
    assert hard_weight.mean() > 0.5
    print("  [ok] focal weighting")


def test_focal_gamma_zero_is_identity():
    losses = torch.tensor([0.1, 1.0, 5.0])
    gamma = 0.0
    focal_weight = (1.0 - torch.exp(-losses)).pow(gamma)
    assert torch.allclose(focal_weight, torch.ones_like(focal_weight))
    print("  [ok] focal gamma zero")


def test_gradient_noise_decays():
    eta = 0.01
    noise_early = eta / (1.0 + 1.0) ** 0.55
    noise_mid = eta / (1.0 + 500.0) ** 0.55
    noise_late = eta / (1.0 + 5000.0) ** 0.55

    assert noise_early > noise_mid > noise_late
    assert noise_late < noise_early * 0.1
    print("  [ok] gradient noise decay")


def test_curriculum_ramp_reduces_low_weight_samples():
    ramp = 0.3
    weights = torch.tensor([0.5, 0.8, 1.2, 1.5, 2.0])
    median = weights.median()

    ramp_progress = 0.0
    ramp_scale = 1.0 - ramp * (1.0 - ramp_progress)
    below_median = (weights < median).float()
    adjusted = weights * (1.0 - below_median * (1.0 - ramp_scale))

    for i in range(len(weights)):
        if weights[i] < median:
            assert adjusted[i] < weights[i]
        else:
            assert adjusted[i] == weights[i]

    ramp_progress = 1.0
    ramp_scale = 1.0 - ramp * (1.0 - ramp_progress)
    assert abs(ramp_scale - 1.0) < 1e-6
    print("  [ok] curriculum ramp")


def test_length_bucket_sampler_groups_similar_lengths():
    _build_lr_lambda, LengthBucketBatchSampler, _pair_knowledge_density_score, _select_sft_training_pairs, _counterfactual_reject_variants, ChatPair = _import_pipeline()
    lengths = [12, 13, 35, 36, 70, 71, 90, 91, 110, 111, 130, 131]
    sampler = LengthBucketBatchSampler(
        lengths=lengths,
        batch_size=2,
        shuffle=False,
        bucket_window_multiplier=4,
        seed=7,
    )
    batches = list(iter(sampler))
    spreads = []
    for batch in batches:
        batch_lengths = [lengths[idx] for idx in batch]
        spreads.append(max(batch_lengths) - min(batch_lengths))
    assert max(spreads) <= 1, f"Expected tight batches, got spreads={spreads}"
    print(f"  [ok] length bucketing spreads={spreads}")


def test_build_rows_tracks_supervised_tokens_and_source():
    ChatPair, build_rows, _pack_sft_rows = _import_sft_packing_helpers()
    del _pack_sft_rows
    tokenizer = _ToyTokenizer()
    rows = build_rows(
        tokenizer,
        [ChatPair(user="Summarize the report.", assistant="The report says sales improved.", source="briefing")],
        max_length=128,
        row_weight_fn=lambda _pair: 1.25,
    )
    assert len(rows) == 1
    assert int(rows[0]["supervised_tokens"]) > 0
    assert rows[0]["source"] == "briefing"
    assert math.isclose(float(rows[0]["sample_weight"]), 1.25, rel_tol=1e-9)
    print("  [ok] build_rows tracks supervised tokens and source")


def test_sft_true_packing_preserves_supervised_tokens_and_max_length():
    ChatPair, build_rows, pack_sft_rows = _import_sft_packing_helpers()
    del ChatPair, build_rows
    rows = [
        _make_sft_row(total_tokens=12, supervised_tokens=4, start_token=10),
        _make_sft_row(total_tokens=11, supervised_tokens=5, start_token=40),
        _make_sft_row(total_tokens=10, supervised_tokens=3, start_token=70),
        _make_sft_row(total_tokens=8, supervised_tokens=2, start_token=90),
    ]
    before_supervised = sum(int(row["supervised_tokens"]) for row in rows)
    packed = pack_sft_rows(rows, max_length=24, separator_token_id=999, max_samples_per_row=0)
    after_supervised = sum(int(row["supervised_tokens"]) for row in packed)

    assert len(packed) == 2, f"Expected two packed rows, got {len(packed)}"
    assert after_supervised == before_supervised
    assert all(len(row["input_ids"]) <= 24 for row in packed)
    assert all(int(row.get("packed_sample_count", 1)) >= 1 for row in packed)
    print("  [ok] true packing preserves supervised tokens and max length")


def test_sft_true_packing_masks_separator_and_aggregates_weights():
    ChatPair, build_rows, pack_sft_rows = _import_sft_packing_helpers()
    del ChatPair, build_rows
    rows = [
        _make_sft_row(total_tokens=10, supervised_tokens=4, sample_weight=0.5, start_token=10, source="news"),
        _make_sft_row(total_tokens=9, supervised_tokens=2, sample_weight=1.5, start_token=40, source="news"),
    ]
    packed = pack_sft_rows(rows, max_length=20, separator_token_id=999, max_samples_per_row=2)

    assert len(packed) == 1
    row = packed[0]
    separator_positions = [idx for idx, token in enumerate(row["input_ids"]) if int(token) == 999]
    expected_weight = ((0.5 * 4.0) + (1.5 * 2.0)) / 6.0

    assert int(row.get("packed_sample_count", 1)) == 2
    assert separator_positions == [10], f"Expected one separator after the first segment, got {separator_positions}"
    assert int(row["labels"][10]) == -100
    assert int(row["attention_mask"][10]) == 1
    assert math.isclose(float(row["sample_weight"]), expected_weight, rel_tol=1e-6)
    print("  [ok] true packing masks separators and aggregates weights")


def test_sft_true_packing_respects_max_samples_per_row():
    ChatPair, build_rows, pack_sft_rows = _import_sft_packing_helpers()
    del ChatPair, build_rows
    rows = [
        _make_sft_row(total_tokens=8, supervised_tokens=2, start_token=10),
        _make_sft_row(total_tokens=7, supervised_tokens=2, start_token=30),
        _make_sft_row(total_tokens=6, supervised_tokens=2, start_token=50),
    ]
    packed = pack_sft_rows(rows, max_length=30, separator_token_id=999, max_samples_per_row=2)
    packed_counts = sorted(int(row.get("packed_sample_count", 1)) for row in packed)

    assert packed_counts == [1, 2], f"Expected a 2-sample pack plus one single row, got {packed_counts}"
    print("  [ok] true packing respects max_samples_per_row")


def test_knowledge_density_prefers_dense_answers():
    _build_lr_lambda, _LengthBucketBatchSampler, _pair_knowledge_density_score, _select_sft_training_pairs, _counterfactual_reject_variants, ChatPair = _import_pipeline()
    prompt = "Explain how binary search works and give the time complexity."
    dense = _pair_knowledge_density_score(
        prompt,
        (
            "Binary search compares the target with the midpoint, discards half the interval "
            "each step, and repeats until found or empty. Time complexity is O(log n) and "
            "space is O(1)."
        ),
        source="conversation_data.coding_knowledge_2026_02_19.jsonl",
    )
    fluffy = _pair_knowledge_density_score(
        prompt,
        (
            "Binary search is a very useful and important algorithm. It helps you search "
            "efficiently and is good to know in many ways."
        ),
        source="conversation_data.coding_knowledge_2026_02_19.jsonl",
    )
    assert dense > fluffy + 0.15, f"Expected dense > fluffy + 0.15, got {dense:.3f} vs {fluffy:.3f}"
    print(f"  [ok] knowledge density dense={dense:.3f} fluffy={fluffy:.3f}")


def test_distillation_rank_prefers_concise_high_gain_candidates():
    _distillation_candidate_rank = _import_distill_rank()
    prompt = "Explain binary search and give the runtime."
    reference = (
        "Binary search checks the middle item in a sorted list and keeps narrowing the range until the "
        "target is found."
    )
    concise = (
        "Check the midpoint, discard the impossible half, and repeat. Because each step halves the "
        "remaining interval, binary search runs in O(log n) time and O(1) space."
    )
    verbose = (
        "Binary search is a classic and very important algorithmic idea that keeps revisiting the middle "
        "position of a sorted collection while discussing why this strategy is efficient and elegant in many "
        "different ways. It gradually narrows the search region, continues describing the same intuition, "
        "and eventually notes that this repeated halving leads to logarithmic running time."
    )
    concise_rank, _concise_quality, _concise_density, _concise_metrics = _distillation_candidate_rank(
        user_text=prompt,
        candidate_text=concise,
        reference_text=reference,
        density_bias=0.16,
        gain_bias=0.40,
        compactness_bias=0.45,
        source="conversation_data.coding_knowledge_2026_02_19.jsonl",
    )
    verbose_rank, _verbose_quality, _verbose_density, _verbose_metrics = _distillation_candidate_rank(
        user_text=prompt,
        candidate_text=verbose,
        reference_text=reference,
        density_bias=0.16,
        gain_bias=0.40,
        compactness_bias=0.45,
        source="conversation_data.coding_knowledge_2026_02_19.jsonl",
    )
    assert concise_rank > verbose_rank, f"Expected concise rank > verbose rank, got {concise_rank:.4f} vs {verbose_rank:.4f}"
    print(f"  [ok] distill ranking concise={concise_rank:.3f} verbose={verbose_rank:.3f}")


def test_preference_length_control_penalizes_overlong_chosen():
    _preference_length_control_margin = _import_pref_length_control()
    chosen_len = torch.tensor([120.0, 55.0, 42.0])
    rejected_len = torch.tensor([60.0, 60.0, 40.0])
    penalty = _preference_length_control_margin(
        chosen_len=chosen_len,
        rejected_len=rejected_len,
        target_ratio=1.08,
        max_penalty=0.35,
    )
    assert penalty[0] > penalty[1] >= 0.0
    assert penalty[2] <= 0.05, f"Expected near-zero penalty for near-matched lengths, got {penalty[2].item():.4f}"
    print(f"  [ok] preference length control penalties={penalty.tolist()}")


def test_preference_stop_signal_penalizes_verbose_answer_only_responses():
    _preference_stop_alignment_score, _stop_overlong_reject_variants, _reorder_scored_ids_for_self_play = _import_pref_stop_helpers()
    prompt = "Answer only: what is 2 + 2? No explanation."
    concise = _preference_stop_alignment_score(prompt, "4", strength=0.30)
    verbose = _preference_stop_alignment_score(
        prompt,
        "4. The answer is four because adding two and two gives four in standard arithmetic.",
        strength=0.30,
    )
    assert concise > verbose + 0.10, f"Expected concise stop score > verbose score, got {concise:.4f} vs {verbose:.4f}"
    print(f"  [ok] preference stop signal concise={concise:.3f} verbose={verbose:.3f}")


def test_stop_reject_variants_create_overlong_near_miss_for_brevity_prompt():
    _preference_stop_alignment_score, _stop_overlong_reject_variants, _reorder_scored_ids_for_self_play = _import_pref_stop_helpers()
    variants = _stop_overlong_reject_variants(
        "One word only: capital of France?",
        "Paris",
        rng=__import__("random").Random(7),
        max_variants=2,
    )
    assert variants, "Expected stop-aware overlong reject variants"
    assert all("Paris" in variant for variant in variants), f"Expected variants to preserve chosen answer token, got {variants}"
    assert all(len(variant.split()) > len("Paris".split()) for variant in variants), f"Expected overlong variants, got {variants}"
    print(f"  [ok] stop reject variants={len(variants)}")


def test_self_play_reorder_prefers_easy_prompts_first():
    _preference_stop_alignment_score, _stop_overlong_reject_variants, _reorder_scored_ids_for_self_play = _import_pref_stop_helpers()
    scored_ids = [
        (3.0, 10, "a", 1.2, "sig-a", 0.92, None, 0.4),
        (2.7, 11, "b", 1.1, "sig-b", 0.18, None, 0.5),
        (2.5, 12, "c", 1.0, "sig-c", 0.44, None, 0.6),
        (2.3, 13, "d", 1.0, "sig-d", 0.12, None, 0.5),
    ]
    reordered, selected_ids = _reorder_scored_ids_for_self_play(
        scored_ids,
        budget=2,
        curriculum="easy_to_hard",
    )
    assert selected_ids == {11, 13}, f"Expected easiest prompt ids, got {selected_ids}"
    assert [reordered[0][1], reordered[1][1]] == [13, 11], f"Expected easy-to-hard ordering, got {[reordered[0][1], reordered[1][1]]}"
    print(f"  [ok] self-play reorder ids={sorted(selected_ids)}")


def test_sft_selection_prefers_dense_capacity_matched_pairs():
    (
        _build_lr_lambda,
        _LengthBucketBatchSampler,
        _pair_knowledge_density_score,
        _select_sft_training_pairs,
        _counterfactual_reject_variants,
        ChatPair,
    ) = _import_pipeline()
    pairs = [
        ChatPair(
            user="Explain binary search step by step and give the time complexity.",
            assistant=(
                "1. Compare the target with the midpoint. 2. Discard the half that cannot "
                "contain the target. 3. Repeat until found or empty. Time complexity is O(log n) "
                "and space is O(1)."
            ),
            source="conversation_data.coding_knowledge_2026_02_19.jsonl",
        ),
        ChatPair(
            user="Explain binary search step by step and give the time complexity.",
            assistant=(
                "Binary search is very useful and important. It helps in many ways and can be good "
                "for efficiency depending on the case."
            ),
            source="conversation_data.coding_knowledge_2026_02_19.jsonl",
        ),
        ChatPair(
            user="Derive a complete proof sketch for a hard Olympiad inequality and discuss every edge case.",
            assistant=(
                "First we explore many possible branches, add several side observations, repeat the same "
                "intuition in multiple ways, and keep expanding the explanation with broad commentary "
                "before reaching a concrete proof idea much later in the answer."
            ),
            source="conversation_data.mega_reasoning_creative_v25_75582.jsonl",
        ),
    ]
    selected = _select_sft_training_pairs(
        pairs,
        strategy="capacity_aware",
        keep_ratio=0.67,
        min_keep=0,
        max_keep=0,
        hardness_target=0.56,
        hardness_bandwidth=0.30,
    )
    kept_answers = {pair.assistant for pair in selected}
    assert len(selected) == 2, f"Expected 2 selected pairs, got {len(selected)}"
    assert pairs[0].assistant in kept_answers, "Dense coding example should be kept"
    assert pairs[1].assistant not in kept_answers, "Fluffy low-density answer should be dropped"
    print("  [ok] sft selection prefers dense capacity-matched pairs")


def test_counterfactual_rejects_include_compact_reasoning_variant():
    (
        _build_lr_lambda,
        _LengthBucketBatchSampler,
        _pair_knowledge_density_score,
        _select_sft_training_pairs,
        _counterfactual_reject_variants,
        ChatPair,
    ) = _import_pipeline()
    chosen = (
        "Step 1: compute the midpoint and compare it to the target. "
        "Step 2: discard the half that cannot contain the answer because the array is sorted. "
        "Step 3: repeat until the interval is empty or the value is found. "
        "This works because each comparison halves the remaining search space, so the time complexity is O(log n)."
    )
    variants = _counterfactual_reject_variants(chosen, rng=__import__('random').Random(7))
    assert variants, "Expected at least one counterfactual variant"
    shortest = min(variants, key=lambda x: len(x.split()))
    assert len(shortest.split()) < len(chosen.split()), "Compact variant should be shorter than chosen text"
    assert "O(log n)" in shortest or "halves the remaining search space" in shortest
    print("  [ok] counterfactual rejects include compact reasoning variant")


def test_sft_token_budget_prefers_dense_short_pairs():
    (
        _build_lr_lambda,
        _LengthBucketBatchSampler,
        _pair_knowledge_density_score,
        _select_sft_training_pairs,
        _counterfactual_reject_variants,
        ChatPair,
    ) = _import_pipeline()
    pairs = [
        ChatPair(
            user="Explain how binary search works and why it is O(log n).",
            assistant=(
                "Check the midpoint, discard the impossible half, and repeat. "
                "Each step halves the search interval, so the time complexity is O(log n)."
            ),
            source="conversation_data.coding_knowledge_2026_02_19.jsonl",
        ),
        ChatPair(
            user="Explain how binary search works and why it is O(log n).",
            assistant=(
                "Binary search keeps checking the middle element and then repeatedly narrows the range. "
                "Because the data is sorted, half of the candidates can be ignored after each comparison. "
                "That is why the method is efficient. In practice, you continue doing this until the value "
                "is found or the interval becomes empty, which means the algorithm has logarithmic time complexity."
            ),
            source="conversation_data.coding_knowledge_2026_02_19.jsonl",
        ),
        ChatPair(
            user="Write a broad motivational reflection about learning algorithms.",
            assistant=(
                "Learning algorithms is rewarding and inspiring. It can help build confidence, curiosity, "
                "and a sense of progress over time."
            ),
            source="conversation_data.mega_creative_250k_v2.jsonl",
        ),
    ]
    selected = _select_sft_training_pairs(
        pairs,
        strategy="utility_topk",
        keep_ratio=0.60,
        min_keep=0,
        max_keep=0,
        hardness_target=0.56,
        hardness_bandwidth=0.30,
        budget_mode="tokens",
        budget_power=0.55,
    )
    kept_answers = {pair.assistant for pair in selected}
    assert len(selected) >= 1, "Expected at least one selected pair"
    assert pairs[0].assistant in kept_answers, "Dense short answer should survive token-budget selection"
    assert pairs[1].assistant not in kept_answers, "Verbose answer should be trimmed under token budget"
    print("  [ok] token-budget selection prefers dense short pairs")


def test_sft_scoped_selection_only_trims_teacher_subset():
    (
        _build_lr_lambda,
        _LengthBucketBatchSampler,
        _pair_knowledge_density_score,
        _select_sft_training_pairs,
        _counterfactual_reject_variants,
        ChatPair,
    ) = _import_pipeline()
    pairs = [
        ChatPair(
            user="Explain binary search briefly.",
            assistant="Binary search halves the sorted search interval each step, so it runs in O(log n).",
            source="conversation_data.coding_knowledge_2026_02_19.jsonl",
        ),
        ChatPair(
            user="Explain binary search in detail for a study worksheet on algorithms.",
            assistant=(
                "Binary search repeatedly checks the middle element, reasons through which side can still "
                "contain the target, and then continues shrinking the valid interval. Because the data is "
                "sorted, every comparison removes half of the remaining candidates. You keep applying that "
                "rule until the target is found or no range remains, which is why the runtime grows logarithmically."
            ),
            source="supermix_teacher",
        ),
        ChatPair(
            user="Explain binary search in detail for a study worksheet on algorithms.",
            assistant=(
                "Check the midpoint, discard the impossible half, and repeat. "
                "The interval halves each step, so the runtime is O(log n)."
            ),
            source="supermix_teacher",
        ),
    ]
    selected = _select_sft_training_pairs(
        pairs,
        strategy="utility_topk",
        keep_ratio=0.60,
        min_keep=0,
        max_keep=0,
        hardness_target=0.56,
        hardness_bandwidth=0.30,
        budget_mode="tokens",
        budget_power=0.40,
        scope="verbose_synthetic_teacher",
        scope_min_words=18,
    )
    kept_answers = {pair.assistant for pair in selected}
    assert pairs[0].assistant in kept_answers, "Non-scoped regular pair should pass through unchanged"
    assert pairs[2].assistant in kept_answers, "Better teacher row should survive scoped selection"
    assert pairs[1].assistant not in kept_answers, "Verbose teacher row should be trimmed inside scoped selection"
    print("  [ok] scoped selection only trims teacher subset")


def test_sft_coverage_selection_keeps_rare_high_quality_group():
    (
        _build_lr_lambda,
        _LengthBucketBatchSampler,
        _pair_knowledge_density_score,
        _select_sft_training_pairs,
        _counterfactual_reject_variants,
        ChatPair,
    ) = _import_pipeline()
    pairs = [
        ChatPair(
            user="Explain binary search step by step and give the time complexity.",
            assistant=(
                "Check the midpoint, discard the half that cannot contain the target, and repeat. "
                "Because each comparison halves the remaining range, binary search runs in O(log n) time."
            ),
            source="conversation_data.coding_knowledge_2026_02_19.jsonl",
        ),
        ChatPair(
            user="Explain merge sort step by step and give the time complexity.",
            assistant=(
                "Split the array recursively, sort each half, and merge the sorted halves. "
                "The merge work is linear per level, so merge sort runs in O(n log n) time."
            ),
            source="conversation_data.coding_knowledge_2026_02_19.jsonl",
        ),
        ChatPair(
            user="What happened on July 20, 1969?",
            assistant="Apollo 11 landed on the Moon, and Neil Armstrong became the first person to walk on it.",
            source="conversation_data.world_events_2026_02_19.jsonl",
            metadata={"event_id": "apollo_11_moon_landing", "topic": "space_history"},
        ),
    ]
    utility_selected = _select_sft_training_pairs(
        pairs,
        strategy="utility_topk",
        keep_ratio=0.67,
        min_keep=0,
        max_keep=0,
        hardness_target=0.56,
        hardness_bandwidth=0.30,
    )
    coverage_selected = _select_sft_training_pairs(
        pairs,
        strategy="coverage_topk",
        keep_ratio=0.67,
        min_keep=0,
        max_keep=0,
        hardness_target=0.56,
        hardness_bandwidth=0.30,
    )
    utility_answers = {pair.assistant for pair in utility_selected}
    coverage_answers = {pair.assistant for pair in coverage_selected}
    assert pairs[2].assistant not in utility_answers, "Plain utility selection should prefer the denser duplicate coding cluster"
    assert pairs[2].assistant in coverage_answers, "Coverage-aware selection should preserve the rarer grouped event sample"
    print("  [ok] coverage_topk preserves rare high-quality grouped sample")


def test_preference_coverage_margin_preserves_style_diversity():
    PreferencePair, _select_preference_pairs = _import_preference_selection_helpers()
    pairs = [
        PreferencePair(
            user="Explain binary search and why it is O(log n).",
            chosen="Binary search compares the midpoint, discards the impossible half, and repeats until done.",
            rejected="Binary search is helpful and efficient in many practical cases.",
            weight=1.25,
            quality_gap=0.36,
            rejected_similarity=0.46,
            prompt_complexity=0.68,
            conversation_score=0.20,
            reasoning_score=0.82,
            creativity_score=0.08,
            knowledge_density_score=0.88,
        ),
        PreferencePair(
            user="Explain merge sort and why it is O(n log n).",
            chosen="Merge sort recursively splits the array, sorts each half, and merges them in linear time per level.",
            rejected="Merge sort is a useful algorithm that is often fast and important.",
            weight=1.22,
            quality_gap=0.34,
            rejected_similarity=0.44,
            prompt_complexity=0.66,
            conversation_score=0.18,
            reasoning_score=0.79,
            creativity_score=0.06,
            knowledge_density_score=0.86,
        ),
        PreferencePair(
            user="Write a creative but concise reflection on learning algorithms.",
            chosen="Learning algorithms feels like turning confusion into structure, one insight at a time.",
            rejected="Learning algorithms is good and can help people in many situations.",
            weight=1.18,
            quality_gap=0.30,
            rejected_similarity=0.40,
            prompt_complexity=0.60,
            conversation_score=0.58,
            reasoning_score=0.22,
            creativity_score=0.94,
            knowledge_density_score=0.28,
        ),
    ]
    margin_selected = _select_preference_pairs(
        pairs,
        strategy="margin_topk",
        keep_ratio=0.67,
        min_keep=0,
        max_keep=0,
        hardness_target=0.45,
        hardness_bandwidth=0.22,
    )
    coverage_selected = _select_preference_pairs(
        pairs,
        strategy="coverage_margin",
        keep_ratio=0.67,
        min_keep=0,
        max_keep=0,
        hardness_target=0.45,
        hardness_bandwidth=0.22,
    )
    creative_prompt = pairs[2].user
    assert creative_prompt not in {pair.user for pair in margin_selected}, "Margin selection should keep the stronger duplicate technical cluster"
    assert creative_prompt in {pair.user for pair in coverage_selected}, "Coverage-aware preference selection should preserve the rarer creative pair"
    print("  [ok] coverage_margin keeps style-diverse preference pairs")


def test_benchmark_sample_comparison_ranks_worst_regressions_first():
    build_benchmark_sample_comparison = _import_benchmark_helpers()
    base_rows = [
        {
            "sample_index": 0,
            "source": "coding",
            "prompt_signature": "binary-search",
            "prompt_complexity": 0.42,
            "user": "What is binary search?",
            "reference": "Halve the sorted interval each step.",
            "prediction": "Halve the interval each step.",
            "loss": 1.2,
            "token_f1": 0.80,
            "char_similarity": 0.82,
            "gen_seconds": 1.5,
            "generated_tokens": 14,
        },
        {
            "sample_index": 1,
            "source": "math",
            "prompt_signature": "answer-only",
            "prompt_complexity": 0.18,
            "user": "Answer only: 2 + 2?",
            "reference": "4",
            "prediction": "4",
            "loss": 0.8,
            "token_f1": 1.0,
            "char_similarity": 1.0,
            "gen_seconds": 0.9,
            "generated_tokens": 1,
        },
    ]
    tuned_rows = [
        {
            "sample_index": 0,
            "source": "coding",
            "prompt_signature": "binary-search",
            "prompt_complexity": 0.42,
            "user": "What is binary search?",
            "reference": "Halve the sorted interval each step.",
            "prediction": "Binary search is useful.",
            "loss": 2.4,
            "token_f1": 0.32,
            "char_similarity": 0.48,
            "gen_seconds": 3.2,
            "generated_tokens": 28,
        },
        {
            "sample_index": 1,
            "source": "math",
            "prompt_signature": "answer-only",
            "prompt_complexity": 0.18,
            "user": "Answer only: 2 + 2?",
            "reference": "4",
            "prediction": "4. The answer is four.",
            "loss": 0.9,
            "token_f1": 0.65,
            "char_similarity": 0.31,
            "gen_seconds": 1.4,
            "generated_tokens": 6,
        },
    ]

    comparison = build_benchmark_sample_comparison(base_rows, tuned_rows)

    assert len(comparison) == 2
    assert comparison[0]["sample_index"] == 0, f"Expected worst regression first, got {comparison[0]}"
    assert abs(float(comparison[0]["delta_token_f1"]) + 0.48) < 1e-9
    assert abs(float(comparison[0]["delta_char_similarity"]) + 0.34) < 1e-9
    assert abs(float(comparison[0]["delta_gen_seconds"]) - 1.7) < 1e-9
    assert comparison[1]["sample_index"] == 1
    print("  [ok] benchmark sample comparison ranks worst regressions first")


def test_split_train_eval_auto_groups_metadata_events():
    ChatPair, split_train_eval, _save_jsonl, _load_saved_chat_pairs = _import_split_and_io_helpers()
    pairs = [
        ChatPair(user="event a ask 1", assistant="event a ans 1", source="world.jsonl", metadata={"event_id": "a"}),
        ChatPair(user="event a ask 2", assistant="event a ans 2", source="world.jsonl", metadata={"event_id": "a"}),
        ChatPair(user="event b ask 1", assistant="event b ans 1", source="world.jsonl", metadata={"event_id": "b"}),
        ChatPair(user="event b ask 2", assistant="event b ans 2", source="world.jsonl", metadata={"event_id": "b"}),
        ChatPair(user="event c ask 1", assistant="event c ans 1", source="world.jsonl", metadata={"event_id": "c"}),
        ChatPair(user="event c ask 2", assistant="event c ans 2", source="world.jsonl", metadata={"event_id": "c"}),
    ]

    train_pairs, eval_pairs = split_train_eval(pairs, eval_size=2, seed=7, split_mode="auto")
    train_events = {str(pair.metadata.get("event_id", "")) for pair in train_pairs}
    eval_events = {str(pair.metadata.get("event_id", "")) for pair in eval_pairs}

    assert len(eval_pairs) == 2
    assert len(eval_events) == 1, f"Expected a single held-out event group, got {eval_events}"
    assert train_events.isdisjoint(eval_events), f"Train and eval should not share events: {train_events} vs {eval_events}"
    print(f"  [ok] auto split held out event group={sorted(eval_events)}")


def test_save_jsonl_round_trips_pair_metadata():
    ChatPair, _split_train_eval, save_jsonl, load_saved_chat_pairs = _import_split_and_io_helpers()
    pair = ChatPair(
        user="Summarize the update.",
        assistant="As of February 19, 2026, the update is ...",
        source="conversation_data.world_events_2026_02_19.jsonl",
        metadata={
            "event_id": "sudan_genocide_hallmarks",
            "topic": "world_events",
            "as_of": "February 19, 2026",
            "record_source": "https://apnews.com/article/example",
        },
    )

    with tempfile.TemporaryDirectory() as tmpdir:
        path = Path(tmpdir) / "pairs.jsonl"
        save_jsonl(path, [pair])
        loaded = load_saved_chat_pairs(path)

    assert len(loaded) == 1
    assert loaded[0].source == pair.source
    assert loaded[0].metadata == pair.metadata
    print("  [ok] save_jsonl preserves chat-pair metadata")


def test_distill_progress_heartbeat_logs_even_without_new_accepts():
    should_log = _import_progress_heartbeat_helper()
    assert should_log(visited=200, log_every=40, now=80.0, last_log_time=55.0, heartbeat_seconds=30.0)
    assert should_log(visited=237, log_every=40, now=90.5, last_log_time=55.0, heartbeat_seconds=30.0)
    assert not should_log(visited=237, log_every=40, now=70.0, last_log_time=55.0, heartbeat_seconds=30.0)
    print("  [ok] distill progress heartbeat triggers on interval or elapsed time")


def run_all():
    print("=" * 60)
    print("Training Improvements - Unit Tests")
    print("=" * 60)

    tests = [
        ("Cosine warm restarts", test_cosine_restarts_produces_periodic_peaks),
        ("Restarts disabled by period=0", test_cosine_restarts_disabled_by_zero_period),
        ("Constant schedule", test_constant_schedule),
        ("Cosine decay", test_cosine_schedule_decay),
        ("Focal loss modulation", test_focal_weight_modulation),
        ("Focal gamma=0 identity", test_focal_gamma_zero_is_identity),
        ("Gradient noise decay", test_gradient_noise_decays),
        ("Curriculum ramp", test_curriculum_ramp_reduces_low_weight_samples),
        ("Length bucket sampler", test_length_bucket_sampler_groups_similar_lengths),
        ("Build rows supervised tokens", test_build_rows_tracks_supervised_tokens_and_source),
        ("SFT true packing bounds", test_sft_true_packing_preserves_supervised_tokens_and_max_length),
        ("SFT true packing separators", test_sft_true_packing_masks_separator_and_aggregates_weights),
        ("SFT true packing max samples", test_sft_true_packing_respects_max_samples_per_row),
        ("Knowledge density scoring", test_knowledge_density_prefers_dense_answers),
        ("Distillation ranking", test_distillation_rank_prefers_concise_high_gain_candidates),
        ("Preference length control", test_preference_length_control_penalizes_overlong_chosen),
        ("Preference stop signal", test_preference_stop_signal_penalizes_verbose_answer_only_responses),
        ("Stop reject variants", test_stop_reject_variants_create_overlong_near_miss_for_brevity_prompt),
        ("Self-play reorder", test_self_play_reorder_prefers_easy_prompts_first),
        ("SFT selection", test_sft_selection_prefers_dense_capacity_matched_pairs),
        ("Compact reasoning rejects", test_counterfactual_rejects_include_compact_reasoning_variant),
        ("Token-budget SFT selection", test_sft_token_budget_prefers_dense_short_pairs),
        ("Scoped token-budget SFT selection", test_sft_scoped_selection_only_trims_teacher_subset),
        ("Coverage-aware SFT selection", test_sft_coverage_selection_keeps_rare_high_quality_group),
        ("Coverage-aware preference selection", test_preference_coverage_margin_preserves_style_diversity),
        ("Benchmark sample comparison", test_benchmark_sample_comparison_ranks_worst_regressions_first),
        ("Auto eval split grouping", test_split_train_eval_auto_groups_metadata_events),
        ("Chat-pair metadata roundtrip", test_save_jsonl_round_trips_pair_metadata),
        ("Distill progress heartbeat", test_distill_progress_heartbeat_logs_even_without_new_accepts),
    ]

    passed = 0
    failed = 0
    for name, fn in tests:
        print(f"\n[{name}]")
        try:
            fn()
            passed += 1
        except Exception as exc:
            print(f"  [fail] {exc}")
            import traceback

            traceback.print_exc()
            failed += 1

    print(f"\n{'=' * 60}")
    print(f"Results: {passed} passed, {failed} failed out of {len(tests)}")
    print("=" * 60)

    if failed:
        sys.exit(1)
    print("\nAll tests passed.")


if __name__ == "__main__":
    run_all()
