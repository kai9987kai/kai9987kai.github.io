import importlib.util
import sys
from pathlib import Path

import torch


ROOT = Path(__file__).resolve().parent
SOURCE_DIR = ROOT / "source"
RUNTIME_DIR = ROOT / "runtime_python"

if str(SOURCE_DIR) not in sys.path:
    sys.path.insert(0, str(SOURCE_DIR))

import chat_app  # noqa: E402
import model_variants  # noqa: E402


def _load_runtime_model_variants():
    old_path = list(sys.path)
    try:
        if str(RUNTIME_DIR) not in sys.path:
            sys.path.insert(0, str(RUNTIME_DIR))
        spec = importlib.util.spec_from_file_location(
            "runtime_model_variants_proxy_test",
            RUNTIME_DIR / "model_variants.py",
        )
        assert spec is not None and spec.loader is not None
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    finally:
        sys.path[:] = old_path


def test_metacognitive_expert_forward_returns_logits():
    model = model_variants.ChampionNetMetaCognitiveExpert(
        n_proposal_experts=4,
        n_critique_experts=3,
        reasoning_steps=2,
    ).eval()
    dummy_input = torch.randn(2, 1, 128)
    with torch.no_grad():
        logits = model(dummy_input)
    assert isinstance(logits, torch.Tensor)
    assert logits.shape == (2, 1, 10)


def test_runtime_model_size_resolution_accepts_expert_variants():
    resolved, warning = chat_app.resolve_runtime_model_size(
        "auto",
        "deep_expert",
        "deep_expert",
    )
    assert resolved == "deep_expert"
    assert warning == ""
    assert tuple(chat_app.VALID_RUNTIME_MODEL_SIZES) == tuple(model_variants.SUPPORTED_MODEL_SIZES)


def test_runtime_proxy_detects_metacognitive_variant():
    runtime_model_variants = _load_runtime_model_variants()
    assert tuple(runtime_model_variants.SUPPORTED_MODEL_SIZES) == tuple(model_variants.SUPPORTED_MODEL_SIZES)
    model = runtime_model_variants.build_model(model_size="metacognitive_expert").eval()
    detected = runtime_model_variants.detect_model_size_from_state_dict(model.state_dict())
    assert detected == "metacognitive_expert"


if __name__ == "__main__":
    tests = [
        test_metacognitive_expert_forward_returns_logits,
        test_runtime_model_size_resolution_accepts_expert_variants,
        test_runtime_proxy_detects_metacognitive_variant,
    ]
    for test in tests:
        print(f"Running {test.__name__}...")
        test()
    print("All model activation upgrade tests passed.")
