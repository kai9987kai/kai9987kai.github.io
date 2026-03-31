import os
import subprocess
import sys
import tempfile
from pathlib import Path


sys.path.append(os.path.join(os.getcwd(), "source"))

from qwen_supermix_pipeline import (  # noqa: E402
    ChatPair,
    _load_prepared_data_cache,
    _prepared_data_cache_key,
    _rescore_preference_rows,
    _save_prepared_data_cache,
)


def test_preference_rescore_shifts_focus_from_easy_to_harder_pairs():
    rows = [
        {
            "weight": 1.0,
            "base_weight": 1.0,
            "quality_gap": 0.28,
            "rejected_similarity": 0.10,
            "prompt_complexity": 0.4,
            "selection_score": 1.0,
            "conversation_score": 0.3,
            "reasoning_score": 0.2,
            "creativity_score": 0.1,
            "is_followup": False,
        },
        {
            "weight": 1.0,
            "base_weight": 1.0,
            "quality_gap": 0.08,
            "rejected_similarity": 0.64,
            "prompt_complexity": 0.9,
            "selection_score": 1.2,
            "conversation_score": 0.4,
            "reasoning_score": 0.9,
            "creativity_score": 0.3,
            "is_followup": True,
        },
    ]

    _rescore_preference_rows(rows, step=0, total_steps=100, round_index=1)
    early_easy = float(rows[0]["weight"])
    early_hard = float(rows[1]["weight"])
    assert early_easy > early_hard, (early_easy, early_hard)

    _rescore_preference_rows(rows, step=90, total_steps=100, round_index=2)
    late_easy = float(rows[0]["weight"])
    late_hard = float(rows[1]["weight"])
    assert late_hard > early_hard, (late_hard, early_hard)
    assert late_hard > late_easy, (late_hard, late_easy)


def test_prepared_data_cache_round_trip():
    payload = {
        "data_files": [{"path": "dataset.jsonl", "size": 12, "mtime_ns": 34}],
        "max_records": 10,
        "eval_size": 2,
        "seed": 48,
    }
    cache_key = _prepared_data_cache_key(payload)
    train_pairs = [ChatPair(user="u1", assistant="a1", source="dataset")]
    eval_pairs = [ChatPair(user="u2", assistant="a2", source="dataset")]

    with tempfile.TemporaryDirectory() as tmp:
        output_dir = Path(tmp)
        _save_prepared_data_cache(
            output_dir=output_dir,
            cache_key=cache_key,
            cache_payload=payload,
            train_pairs=train_pairs,
            eval_pairs=eval_pairs,
            raw_eval_count=3,
        )
        cached = _load_prepared_data_cache(output_dir, cache_key)
        assert cached is not None
        cached_train, cached_eval, meta = cached
        assert len(cached_train) == 1
        assert len(cached_eval) == 1
        assert int(meta["raw_eval_count"]) == 3


def test_auto_resume_dry_run_restores_last_launch_state():
    with tempfile.TemporaryDirectory() as tmp:
        launch_state = Path(tmp) / "last_launch.txt"
        launch_state.write_text(
            "\n".join(
                [
                    r"OUTPUT_DIR=artifacts\resume_me",
                    r"OUT_LOG=train_resume.out.log",
                    r"ERR_LOG=train_resume.err.log",
                    r"DEVICE=dml",
                ]
            ),
            encoding="utf-8",
        )
        result = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                r"source\auto_resume_supermix_training.ps1",
                "-LaunchStateFile",
                str(launch_state),
                "-DryRun",
                "-NoMonitor",
            ],
            cwd=os.getcwd(),
            capture_output=True,
            text=True,
            timeout=30,
        )

    assert result.returncode == 0, result.stderr or result.stdout
    stdout = result.stdout.replace("/", "\\")
    assert "[auto-resume] restored last launch state" in stdout
    assert "[auto-resume] dry-run config:" in stdout
    assert r"output=artifacts\resume_me" in stdout
    assert r"out_log=train_resume.out.log" in stdout
    assert r"err_log=train_resume.err.log" in stdout


def test_auto_resume_dry_run_prefers_explicit_overrides():
    with tempfile.TemporaryDirectory() as tmp:
        launch_state = Path(tmp) / "last_launch.txt"
        launch_state.write_text(
            "\n".join(
                [
                    r"OUTPUT_DIR=artifacts\from_state",
                    r"OUT_LOG=state.out.log",
                    r"ERR_LOG=state.err.log",
                ]
            ),
            encoding="utf-8",
        )
        result = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                r"source\auto_resume_supermix_training.ps1",
                "-LaunchStateFile",
                str(launch_state),
                "-OutputDir",
                r"artifacts\from_cli",
                "-TrainOutLog",
                "cli.out.log",
                "-TrainErrLog",
                "cli.err.log",
                "-DryRun",
                "-NoMonitor",
            ],
            cwd=os.getcwd(),
            capture_output=True,
            text=True,
            timeout=30,
        )

    assert result.returncode == 0, result.stderr or result.stdout
    stdout = result.stdout.replace("/", "\\")
    assert r"output=artifacts\from_cli" in stdout
    assert "out_log=cli.out.log" in stdout
    assert "err_log=cli.err.log" in stdout
    assert r"output=artifacts\from_state" not in stdout


def run_all():
    tests = [
        ("Preference rescoring", test_preference_rescore_shifts_focus_from_easy_to_harder_pairs),
        ("Prepared data cache", test_prepared_data_cache_round_trip),
        ("Auto-resume dry run restores launch state", test_auto_resume_dry_run_restores_last_launch_state),
        ("Auto-resume dry run prefers explicit overrides", test_auto_resume_dry_run_prefers_explicit_overrides),
    ]
    failures = []
    for name, fn in tests:
        try:
            fn()
            print(f"[PASS] {name}")
        except Exception as exc:
            failures.append((name, exc))
            print(f"[FAIL] {name}: {exc}")
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    run_all()
