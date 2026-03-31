import os
import sys

import torch


sys.path.append(os.path.join(os.getcwd(), "source"))

from qwen_supermix_pipeline import (  # noqa: E402
    _disable_peft_init_for_weight_load,
    _resolve_device,
    _resolve_peft_bootstrap,
    _resolve_torch_dtype,
)


class _DummyDmlDevice:
    type = "privateuseone"

    def __str__(self) -> str:
        return "privateuseone:0"


class _DummyPeftConfig:
    def __init__(self, init_lora_weights):
        self.init_lora_weights = init_lora_weights


def test_resolve_device_auto_falls_back_to_cpu_when_no_accelerator():
    device, info = _resolve_device("auto", device_preference="cpu")

    assert str(device) == "cpu"
    assert info["resolved"] == "cpu"
    assert info["requested"] == "auto"


def test_resolve_torch_dtype_auto_uses_float32_on_cpu():
    assert _resolve_torch_dtype("auto", torch.device("cpu"), resolved_backend="cpu") == torch.float32


def test_resolve_torch_dtype_auto_uses_float16_on_dml():
    assert _resolve_torch_dtype("auto", _DummyDmlDevice(), resolved_backend="dml") == torch.float16


def test_resolve_peft_bootstrap_moves_dml_wrap_to_cpu_float32():
    bootstrap_device, bootstrap_dtype, reason = _resolve_peft_bootstrap(
        runtime_device=_DummyDmlDevice(),
        resolved_backend="dml",
        runtime_dtype=torch.float16,
    )

    assert str(bootstrap_device) == "cpu"
    assert bootstrap_dtype == torch.float32
    assert "DirectML PEFT init" in reason


def test_disable_peft_init_for_weight_load_forces_saved_adapter_loads_to_skip_init():
    cfg = _DummyPeftConfig(init_lora_weights="pissa_niter_4")

    disabled_mode = _disable_peft_init_for_weight_load(cfg)

    assert disabled_mode == "pissa_niter_4"
    assert cfg.init_lora_weights is False
