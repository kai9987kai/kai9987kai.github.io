from __future__ import annotations

import os
import sys
from pathlib import Path

import torch

sys.path.append(os.path.join(os.getcwd(), "source"))

from omni_collective_model import OMNI_DOMAIN_LABELS_V2, OMNI_INTENTS_V2
from omni_collective_v6_model import OmniCollectiveNetV6, _prompt_variants_v6
from train_omni_collective_v2 import OmniRow
from train_omni_collective_v6 import (
    _conversation_alignment_rows_v6,
    _grounding_rows_v6,
    _math_exact_rows_v6,
    _protein_rows_v6,
    _sample_teacher_rows,
)


def test_prompt_variants_v6_adds_grounding_and_math_paths():
    variants = _prompt_variants_v6(
        "Solve 3*x + 7 = 19 and answer in one sentence.",
        "x = 4",
        response_confidence=0.18,
    )
    joined = "\n".join(variants).lower()
    assert "ground the answer" in joined
    assert "unsupported claims" in joined
    assert "may involve math" in joined
    assert len(variants) >= 5


def test_v6_curated_rows_cover_conversation_and_grounding():
    alignment = _conversation_alignment_rows_v6()
    grounding = _grounding_rows_v6()
    assert alignment
    assert grounding
    assert all(row.source == "conversation_alignment_v6" for row in alignment)
    assert all(row.source == "grounding_v6" for row in grounding)
    assert any("web search" in row.response_text.lower() for row in grounding)


def test_v6_math_and_protein_rows_build():
    repo_root = Path.cwd()
    math_rows = _math_exact_rows_v6(repo_root=repo_root, seed=17, limit=4)
    protein_rows = _protein_rows_v6(seed=23, limit=8)
    assert math_rows
    assert protein_rows
    assert all(row.domain == "math" for row in math_rows[:4])
    assert all(row.domain == "knowledge" for row in protein_rows)


def test_sample_teacher_rows_balances_domains():
    rows = [
        OmniRow(prompt=f"coding {idx}", intent="coding", response_text="x", domain="coding", source="t")
        for idx in range(8)
    ] + [
        OmniRow(prompt=f"knowledge {idx}", intent="knowledge", response_text="x", domain="knowledge", source="t")
        for idx in range(8)
    ] + [
        OmniRow(prompt=f"math {idx}", intent="math", response_text="x", domain="math", source="t")
        for idx in range(8)
    ]
    sample = _sample_teacher_rows(rows, seed=9, limit=12)
    domains = {row.domain for row in sample}
    assert {"coding", "knowledge", "math"}.issubset(domains)


def test_v6_network_builds_and_runs():
    model = OmniCollectiveNetV6(
        vocab_size=32,
        num_intents=len(OMNI_INTENTS_V2),
        num_responses=11,
        num_vision_classes=5,
        num_domains=len(OMNI_DOMAIN_LABELS_V2),
        base_embed_dim=24,
        text_hidden=40,
        image_channels=12,
        word_buckets=256,
        word_embed_dim=16,
        deep_text_channels=48,
        deep_image_channels=20,
        fusion_hidden=64,
        memory_slots=4,
        depth_steps=2,
        expert_count=2,
        expert_hidden=96,
        context_top_k=2,
        expert_top_k=1,
    )
    outputs = model(
        torch.randint(0, 32, (2, 32)),
        torch.randn(2, 3, 64, 64),
        torch.ones(2),
        torch.randint(0, 256, (2, 12)),
        torch.randn(2, 12),
    )
    assert outputs["intent"].shape == (2, len(OMNI_INTENTS_V2))
    assert outputs["response"].shape == (2, 11)
    assert outputs["domain"].shape == (2, len(OMNI_DOMAIN_LABELS_V2))
    assert float(outputs["balance_loss"].item()) >= 0.0
