from pathlib import Path

from source.multimodel_catalog import ModelRecord, choose_auto_model


def _record(key: str, kind: str, capabilities: tuple[str, ...], score: float | None = None) -> ModelRecord:
    return ModelRecord(
        key=key,
        label=key,
        family="test",
        kind=kind,
        capabilities=capabilities,
        zip_path=Path(f"{key}.zip"),
        common_row_key=key,
        common_overall_exact=score,
    )


def test_auto_prefers_image_model_for_visual_prompt() -> None:
    records = [
        _record("v33_final", "champion_chat", ("chat",), 0.18),
        _record("v36_native", "native_image", ("image",), 0.15),
        _record("v38_native_xlite_fp16", "native_image", ("image",), 0.01),
    ]
    chosen, reason = choose_auto_model(records, "Generate a cinematic poster of a lighthouse at night.")
    assert chosen is not None
    assert chosen.key == "v36_native"
    assert "image" in reason.lower()


def test_auto_prefers_dcgan_model_for_gan_prompt() -> None:
    records = [
        _record("v36_native", "native_image", ("image",), 0.15),
        _record("dcgan_mnist_model", "dcgan_image", ("image",), None),
        _record("dcgan_v2_in_progress", "dcgan_image", ("image",), None),
    ]
    chosen, reason = choose_auto_model(records, "Generate a DCGAN CIFAR retro sample grid.")
    assert chosen is not None
    assert chosen.key == "dcgan_v2_in_progress"
    assert "dcgan" in reason.lower() or "gan" in reason.lower()


def test_auto_prefers_fast_model_for_short_prompt() -> None:
    records = [
        _record("v33_final", "champion_chat", ("chat",), 0.18),
        _record("v30_lite", "champion_chat", ("chat",), 0.01),
    ]
    chosen, _reason = choose_auto_model(records, "Quick answer please.")
    assert chosen is not None
    assert chosen.key == "v30_lite"


def test_auto_prefers_best_reasoning_model_for_code_prompt() -> None:
    records = [
        _record("qwen_v28", "qwen_adapter", ("chat",), 0.02),
        _record("v33_final", "champion_chat", ("chat",), 0.18),
        _record("v35_final", "champion_chat", ("chat",), 0.15),
    ]
    chosen, _reason = choose_auto_model(records, "Debug this Python stack trace and explain the root cause.")
    assert chosen is not None
    assert chosen.key == "v33_final"


def test_auto_prefers_math_specialist_for_equation_prompt() -> None:
    records = [
        _record("v33_final", "champion_chat", ("chat",), 0.18),
        _record("math_equation_micro_v1", "math_equation", ("chat",), None),
    ]
    chosen, reason = choose_auto_model(records, "Solve 3*x^2 - 12 = 0.")
    assert chosen is not None
    assert chosen.key == "math_equation_micro_v1"
    assert "math" in reason.lower() or "equation" in reason.lower()


def test_auto_prefers_protein_specialist_for_protein_prompt() -> None:
    records = [
        _record("v33_final", "champion_chat", ("chat",), 0.18),
        _record("protein_folding_micro_v1", "protein_folding", ("chat",), None),
        _record("v40_benchmax", "omni_collective_v5", ("chat", "vision"), None),
    ]
    chosen, reason = choose_auto_model(records, "Why does pLDDT matter in protein structure prediction?")
    assert chosen is not None
    assert chosen.key == "protein_folding_micro_v1"
    assert "protein" in reason.lower() or "fold" in reason.lower()


def test_auto_prefers_uploaded_image_specialist() -> None:
    records = [
        _record("v33_final", "champion_chat", ("chat",), 0.18),
        _record("omni_collective_v6", "omni_collective_v6", ("chat", "vision"), None),
        _record("v40_benchmax", "omni_collective_v5", ("chat", "vision"), None),
        _record("omni_collective_v5", "omni_collective_v5", ("chat", "vision"), None),
        _record("omni_collective_v4", "omni_collective_v4", ("chat", "vision"), None),
        _record("omni_collective_v3", "omni_collective_v3", ("chat", "vision"), None),
        _record("science_vision_micro_v1", "image_recognition", ("chat", "vision"), None),
        _record("omni_collective_v1", "omni_collective", ("chat", "vision"), None),
    ]
    chosen, reason = choose_auto_model(
        records,
        "What does this uploaded image show?",
        action_mode="auto",
        uploaded_image_path=r"C:\temp\sample.png",
    )
    assert chosen is not None
    assert chosen.key == "science_vision_micro_v1"
    assert "image" in reason.lower() or "visual" in reason.lower()


def test_auto_prefers_newer_omni_collective_for_model_choice_prompt() -> None:
    records = [
        _record("v33_final", "champion_chat", ("chat",), 0.18),
        _record("omni_collective_v6", "omni_collective_v6", ("chat", "vision"), None),
        _record("v40_benchmax", "omni_collective_v5", ("chat", "vision"), None),
        _record("omni_collective_v5", "omni_collective_v5", ("chat", "vision"), None),
        _record("omni_collective_v4", "omni_collective_v4", ("chat", "vision"), None),
        _record("omni_collective_v3", "omni_collective_v3", ("chat", "vision"), None),
        _record("omni_collective_v1", "omni_collective", ("chat", "vision"), None),
        _record("omni_collective_v2", "omni_collective", ("chat", "vision"), None),
    ]
    chosen, reason = choose_auto_model(records, "Which model should I use for this mixed coding and image-analysis task?")
    assert chosen is not None
    assert chosen.key == "omni_collective_v6"
    assert "model" in reason.lower() or "fused" in reason.lower()


def test_auto_prefers_v40_for_reasoning_prompt() -> None:
    records = [
        _record("v33_final", "champion_chat", ("chat",), 0.18),
        _record("omni_collective_v6", "omni_collective_v6", ("chat", "vision"), None),
        _record("v40_benchmax", "omni_collective_v5", ("chat", "vision"), None),
        _record("omni_collective_v5", "omni_collective_v5", ("chat", "vision"), None),
        _record("omni_collective_v4", "omni_collective_v4", ("chat", "vision"), None),
        _record("omni_collective_v2", "omni_collective", ("chat", "vision"), None),
        _record("omni_collective_v3", "omni_collective_v3", ("chat", "vision"), None),
    ]
    chosen, reason = choose_auto_model(records, "Analyze this algorithm tradeoff and suggest the best architecture.")
    assert chosen is not None
    assert chosen.key == "v40_benchmax"
    assert "reasoning" in reason.lower() or "strongest" in reason.lower()
