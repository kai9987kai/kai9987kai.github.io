from __future__ import annotations

import json
from pathlib import Path
import sys

import torch

SOURCE_DIR = Path(__file__).resolve().parent / "source"
if str(SOURCE_DIR) not in sys.path:
    sys.path.append(str(SOURCE_DIR))

from source.image_recognition_model import SCIENCE_IMAGE_CLASSES
from source.omni_collective_v4_model import OmniCollectiveEngineV4, OmniCollectiveNetV4
from source.train_omni_collective_v4 import _inflate_tensor


def test_v4_forward_shapes() -> None:
    model = OmniCollectiveNetV4(
        vocab_size=64,
        num_intents=15,
        num_responses=32,
        num_vision_classes=8,
        num_domains=13,
        base_embed_dim=16,
        text_hidden=24,
        image_channels=8,
        word_buckets=64,
        word_embed_dim=12,
        deep_text_channels=20,
        deep_image_channels=10,
        fusion_hidden=48,
        memory_slots=4,
        depth_steps=2,
        expert_count=3,
        expert_hidden=72,
    )
    outputs = model(
        torch.zeros((2, 40), dtype=torch.long),
        torch.zeros((2, 3, 32, 32), dtype=torch.float32),
        torch.zeros((2,), dtype=torch.float32),
        torch.zeros((2, 12), dtype=torch.long),
        torch.zeros((2, 12), dtype=torch.float32),
    )
    assert outputs["intent"].shape == (2, 15)
    assert outputs["response"].shape == (2, 32)
    assert outputs["vision"].shape == (2, 8)
    assert outputs["domain"].shape == (2, 13)
    assert "balance_loss" in outputs


def test_inflate_tensor_prefix_copy() -> None:
    source = torch.arange(12, dtype=torch.float32).reshape(3, 4)
    target = torch.zeros((5, 6), dtype=torch.float32)
    merged = _inflate_tensor(source, target)
    assert merged is not None
    assert torch.equal(merged[:3, :4], source)


def test_v4_engine_smoke(tmp_path: Path) -> None:
    weights_path = tmp_path / "weights.pth"
    meta_path = tmp_path / "meta.json"
    model = OmniCollectiveNetV4(
        vocab_size=32,
        num_intents=15,
        num_responses=2,
        num_vision_classes=len(SCIENCE_IMAGE_CLASSES),
        num_domains=13,
        base_embed_dim=12,
        text_hidden=16,
        image_channels=8,
        word_buckets=64,
        word_embed_dim=10,
        deep_text_channels=14,
        deep_image_channels=8,
        fusion_hidden=40,
        memory_slots=4,
        depth_steps=2,
        expert_count=2,
        expert_hidden=56,
    )
    torch.save(model.state_dict(), weights_path)
    meta_path.write_text(
        json.dumps(
            {
                "vocab": {"<pad>": 0, "<unk>": 1, **{f"t{i}": i + 2 for i in range(30)}},
                "response_bank": ["fallback answer", "second answer"],
                "class_info": {},
                "intent_labels": [
                    "general",
                    "coding",
                    "creative",
                    "comparison",
                    "planning",
                    "current_info",
                    "model_selection",
                    "math",
                    "vision",
                    "command",
                    "image_prompt",
                    "language",
                    "spatial_3d",
                    "video",
                    "knowledge",
                ],
                "domain_labels": [
                    "general",
                    "coding",
                    "creative",
                    "planning",
                    "knowledge",
                    "language",
                    "math",
                    "vision",
                    "image_prompt",
                    "spatial_3d",
                    "video",
                    "tool",
                    "model_selection",
                ],
                "max_len": 40,
                "image_size": 32,
                "embed_dim": 12,
                "text_hidden": 16,
                "image_channels": 8,
                "word_buckets": 64,
                "max_words": 12,
                "word_embed_dim": 10,
                "deep_text_channels": 14,
                "deep_image_channels": 8,
                "fusion_hidden": 40,
                "memory_slots": 4,
                "depth_steps": 2,
                "expert_count": 2,
                "expert_hidden": 56,
                "context_top_k": 2,
                "expert_top_k": 1,
            }
        ),
        encoding="utf-8",
    )
    engine = OmniCollectiveEngineV4(weights_path=weights_path, meta_path=meta_path, device=torch.device("cpu"))
    assert isinstance(engine.answer("hi"), str)
