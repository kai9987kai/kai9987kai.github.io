from __future__ import annotations

from pathlib import Path
import sys

import torch
from PIL import Image

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "source"
if str(SOURCE) not in sys.path:
    sys.path.insert(0, str(SOURCE))

from build_3d_video_test_dataset import _video_orbit
from omni_collective_v3_model import OmniCollectiveNetV3
from train_omni_collective_v3 import _render_video_contact_sheet


def test_render_video_contact_sheet(tmp_path: Path) -> None:
    video_path = tmp_path / "orbit.gif"
    _video_orbit(video_path)
    output_path = tmp_path / "orbit_contact.png"
    result = _render_video_contact_sheet(video_path, output_path, tile_size=64)
    assert result.exists()
    with Image.open(result) as image:
        assert image.size == (128, 128)


def test_omni_collective_v3_forward_shapes() -> None:
    model = OmniCollectiveNetV3(
        vocab_size=128,
        num_intents=15,
        num_responses=32,
        num_vision_classes=11,
        num_domains=13,
    )
    batch = 3
    outputs = model(
        torch.randint(0, 128, (batch, 24)),
        torch.randn(batch, 3, 112, 112),
        torch.ones(batch),
        torch.randint(0, 32, (batch, 16)),
        torch.randn(batch, 12),
    )
    assert outputs["intent"].shape == (batch, 15)
    assert outputs["response"].shape == (batch, 32)
    assert outputs["vision"].shape == (batch, 11)
    assert outputs["domain"].shape == (batch, 13)
