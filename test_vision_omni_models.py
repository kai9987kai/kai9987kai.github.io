from pathlib import Path

import pytest

from source.image_recognition_model import ScienceImageRecognitionEngine
from source.omni_collective_model import OmniCollectiveEngine


def test_packaged_vision_model_answers_for_local_science_image() -> None:
    meta_path = Path("output/supermix_science_image_recognition_micro_v1_20260327/science_image_recognition_micro_v1_meta.json")
    weights_path = Path("output/supermix_science_image_recognition_micro_v1_20260327/science_image_recognition_micro_v1.pth")
    image_path = Path("output/science_vision_dataset/images/solar_system_sketch.png")
    if not (meta_path.exists() and weights_path.exists() and image_path.exists()):
        pytest.skip("Packaged vision artifact is not present in this workspace.")
    engine = ScienceImageRecognitionEngine(weights_path=weights_path, meta_path=meta_path)
    answer = engine.answer("What does this image show?", image_path)
    assert "match" in answer.lower()


def test_packaged_omni_model_answers_for_uploaded_image() -> None:
    meta_path = Path("output/supermix_omni_collective_v1_20260327/omni_collective_v1_meta.json")
    weights_path = Path("output/supermix_omni_collective_v1_20260327/omni_collective_v1.pth")
    image_path = Path("output/science_vision_dataset/images/cell_diagram.png")
    if not (meta_path.exists() and weights_path.exists() and image_path.exists()):
        pytest.skip("Packaged omni artifact is not present in this workspace.")
    engine = OmniCollectiveEngine(weights_path=weights_path, meta_path=meta_path)
    answer = engine.answer("Describe the uploaded image.", image_path=str(image_path))
    assert "image read" in answer.lower()
