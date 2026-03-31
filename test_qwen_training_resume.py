import json
import os
import sys
from pathlib import Path

import torch


sys.path.append(os.path.join(os.getcwd(), "source"))

from qwen_supermix_pipeline import (
    ChatPair,
    _checkpoint_training_state_path,
    _build_explicit_resume_checkpoint,
    _merge_distillation_pairs,
    _restore_checkpoint_training_state,
    _resolve_latest_resume_checkpoint,
    _save_checkpoint_training_state,
)


def test_merge_distillation_pairs_adds_only_new_examples():
    base_pairs = [ChatPair(user="u1", assistant="a1", source="dataset")]
    distilled_pairs = [
        ChatPair(user="u1", assistant="a1", source="supermix_teacher"),
        ChatPair(user="u2", assistant="a2", source="supermix_teacher"),
    ]

    mixed, added = _merge_distillation_pairs(base_pairs, distilled_pairs, seed=11)

    assert added == 1
    assert len(mixed) == 2
    assert sum(1 for pair in mixed if pair.source == "supermix_teacher") == 1


def test_resolve_latest_resume_checkpoint_reads_latest_pointer(tmp_path: Path):
    output_dir = tmp_path / "artifacts" / "run"
    ckpt_dir = output_dir / "checkpoints" / "sft_step_00080"
    adapter_dir = ckpt_dir / "adapter"
    adapter_dir.mkdir(parents=True)

    meta = {
        "stage": "sft",
        "sft_steps": 80,
        "sft_loss_mean": 1.23,
        "checkpoint_adapter_dir": str(adapter_dir),
    }
    (ckpt_dir / "checkpoint_meta.json").write_text(json.dumps(meta), encoding="utf-8")
    (output_dir / "latest_adapter_checkpoint.txt").write_text(str(adapter_dir), encoding="utf-8")

    state = _resolve_latest_resume_checkpoint(output_dir)

    assert state is not None
    assert state.stage == "sft"
    assert state.sft_steps == 80
    assert state.adapter_dir == adapter_dir


def test_resolve_latest_resume_checkpoint_falls_back_to_scan(tmp_path: Path):
    output_dir = tmp_path / "artifacts" / "run"
    older_dir = output_dir / "checkpoints" / "sft_step_00020"
    newer_dir = output_dir / "checkpoints" / "pref_step_00040"
    older_adapter = older_dir / "adapter"
    newer_adapter = newer_dir / "adapter"
    older_adapter.mkdir(parents=True)
    newer_adapter.mkdir(parents=True)

    (older_dir / "checkpoint_meta.json").write_text(
        json.dumps(
            {
                "stage": "sft",
                "sft_steps": 20,
                "sft_loss_mean": 2.0,
                "checkpoint_adapter_dir": str(older_adapter),
            }
        ),
        encoding="utf-8",
    )
    newer_meta = newer_dir / "checkpoint_meta.json"
    newer_meta.write_text(
        json.dumps(
            {
                "stage": "preference",
                "sft_steps": 120,
                "preference_steps": 40,
                "preference_loss_mean": 0.4,
                "checkpoint_adapter_dir": str(newer_adapter),
            }
        ),
        encoding="utf-8",
    )

    state = _resolve_latest_resume_checkpoint(output_dir)

    assert state is not None
    assert state.stage == "preference"
    assert state.sft_steps == 120
    assert state.preference_steps == 40
    assert state.adapter_dir == newer_adapter


def test_build_explicit_resume_checkpoint_preserves_external_sft_provenance(tmp_path: Path):
    adapter_dir = tmp_path / "external" / "adapter"
    adapter_dir.mkdir(parents=True)

    state = _build_explicit_resume_checkpoint(
        init_adapter_dir=str(adapter_dir),
        sft_steps=960,
        sft_loss_mean=63.9,
    )

    assert state is not None
    assert state.stage == "sft"
    assert state.sft_steps == 960
    assert state.preference_steps == 0
    assert state.adapter_dir == adapter_dir


def test_checkpoint_training_state_round_trip(tmp_path: Path):
    model = torch.nn.Linear(4, 3)
    optim = torch.optim.AdamW(model.parameters(), lr=0.1)
    scheduler = torch.optim.lr_scheduler.LambdaLR(optim, lr_lambda=lambda _step: 1.0)

    x = torch.randn(2, 4)
    loss = model(x).sum()
    loss.backward()
    optim.step()
    scheduler.step()
    optim.zero_grad(set_to_none=True)

    adapter_dir = tmp_path / "run" / "checkpoints" / "sft_step_00001" / "adapter"
    adapter_dir.mkdir(parents=True)
    state_path = _save_checkpoint_training_state(adapter_dir, stage="sft", optimizer=optim, scheduler=scheduler)

    model_restored = torch.nn.Linear(4, 3)
    optim_restored = torch.optim.AdamW(model_restored.parameters(), lr=0.1)
    scheduler_restored = torch.optim.lr_scheduler.LambdaLR(optim_restored, lr_lambda=lambda _step: 1.0)
    restored = _restore_checkpoint_training_state(
        adapter_dir_or_checkpoint_dir=adapter_dir,
        stage="sft",
        optimizer=optim_restored,
        scheduler=scheduler_restored,
        device=torch.device("cpu"),
    )

    assert state_path == _checkpoint_training_state_path(adapter_dir)
    assert state_path.exists()
    assert restored is True
    assert optim_restored.state_dict()["state"], "Expected optimizer state to be restored"
    assert scheduler_restored.state_dict()["last_epoch"] == scheduler.state_dict()["last_epoch"]


def test_checkpoint_training_state_stage_mismatch_is_ignored(tmp_path: Path):
    model = torch.nn.Linear(2, 2)
    optim = torch.optim.AdamW(model.parameters(), lr=0.01)
    scheduler = torch.optim.lr_scheduler.LambdaLR(optim, lr_lambda=lambda _step: 1.0)
    adapter_dir = tmp_path / "run" / "checkpoints" / "pref_step_00002" / "adapter"
    adapter_dir.mkdir(parents=True)
    _save_checkpoint_training_state(adapter_dir, stage="preference", optimizer=optim, scheduler=scheduler)

    model_restored = torch.nn.Linear(2, 2)
    optim_restored = torch.optim.AdamW(model_restored.parameters(), lr=0.01)
    scheduler_restored = torch.optim.lr_scheduler.LambdaLR(optim_restored, lr_lambda=lambda _step: 1.0)
    restored = _restore_checkpoint_training_state(
        adapter_dir_or_checkpoint_dir=adapter_dir,
        stage="sft",
        optimizer=optim_restored,
        scheduler=scheduler_restored,
        device=torch.device("cpu"),
    )

    assert restored is False
