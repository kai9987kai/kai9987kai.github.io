import os
import sys
import tempfile
import time
from pathlib import Path

sys.path.append(os.path.join(os.getcwd(), "source"))

from training_monitor_gui import (
    RunSnapshot,
    _build_run_recommendation,
    _build_health_summary,
    _build_launch_command,
    _compute_display_progress_percent,
    _derive_stage_monitor_fields,
    _history_window_seconds,
    _load_research_failure_insight,
    _load_research_results,
    _parse_log,
    _phase_breakdown_rows,
    _resolve_canvas_size,
    _runtime_device_value,
    _summarize_research_results,
    _summarize_issue_runs,
    _summarize_stage_mix,
    _summarize_windows_accelerators,
)


def _make_snapshot(**overrides):
    now = time.time()
    payload = {
        "run_name": "train_sample_20260305_010101",
        "out_log": Path("train_sample.out.log"),
        "err_log": None,
        "pid_file": None,
        "pid": None,
        "pid_source": "pid_file",
        "pid_alive": False,
        "status": "running",
        "stage": "data",
        "sft_step": 0,
        "pref_step": 0,
        "pref_pairs": 0,
        "loss": None,
        "lr": None,
        "rdrop": None,
        "wpo_std": None,
        "beta": None,
        "margin": None,
        "pref_objective": "-",
        "pref_reference_pairs": None,
        "checkpoint_count": 0,
        "last_checkpoint_stage": "-",
        "last_checkpoint_step": 0,
        "save_every_steps": 20,
        "sft_target_steps": 470,
        "pref_target_steps": 130,
        "has_distill_stage": True,
        "has_pref_mining_stage": True,
        "progress_units": 0.0,
        "total_units": 600.0,
        "progress_percent": 0.0,
        "eta_seconds": None,
        "checkpoint_eta_seconds": None,
        "step_rate_per_hour": None,
        "stage_progress_label": "21000/42000 pairs",
        "stage_progress_percent": 50.0,
        "stage_rate_label": "900.00/s",
        "stage_eta_seconds": 12.0,
        "cpu_percent": None,
        "ram_gb": None,
        "out_size": 100,
        "out_last_write_ts": now,
        "stale_minutes": 0.0,
        "err_size": 0,
        "err_last_write_ts": None,
        "err_signal": "ok",
        "err_summary": "-",
        "launch_hint": "",
        "command_line": "",
        "launch_command": "",
        "health_summary": "healthy",
        "runtime_summary": "device=cuda model_dtype=torch.bfloat16 gradient_checkpointing=True",
        "adapter_summary": "lora_plus_ratio=16.00 base_group=84 fast_group=42 | neftune_sft=5.000 neftune_pref=0.000",
        "source_balance_summary": "quality_anchor:0.91, reasoning:1.22",
        "objective_summary": "beta=1.9000->3.6000 margin=0.0000->0.0000 ipo_target=0.2632->0.1389 label_smoothing=0.000 xpo_clip=0.000 hardness_gamma=1.150 wpo_alpha=0.350 robust_alpha=0.300 robust_eta=0.080 anchor_weight=0.0000",
        "data_summary": "pairs=21000/42000 raw=37572 kept=24041 rate=900.00/s",
        "eval_summary": "threshold=1.05 kept=194/500 dropped_quality=50 dropped_synthetic=256",
        "sft_filter_summary": "-",
        "distill_config_summary": "target=5880 ratio=0.140 max_seconds=12000.0 best_of=3 min_gain=0.180",
        "distill_summary": "visited=120/650 generated=42 rate=14.00/s",
        "pref_mining_summary": "accepted=512/3000 visited=900/48082 rate=6.75/s",
        "pref_selection_summary": "-",
        "tail_lines": [],
        "err_tail_lines": [],
    }
    payload.update(overrides)
    return RunSnapshot(**payload)


def smoke_test_training_monitor_parsing():
    sample_lines = [
        "[train] runtime config: device=cuda model_dtype=torch.bfloat16 gradient_checkpointing=True",
        "[train] matched LoRA config to init adapter: r=32 alpha=64 dropout=0.0300 use_dora=True use_rslora=True targets=q_proj,k_proj,v_proj,o_proj",
        "[train] NEFTune config: sft_noise_alpha=5.000 preference_noise_alpha=0.000",
        "[sft] source balance factors: conversation_data.quality_anchor_v2.jsonl:0.91, conversation_data.mega_reasoning_creative_v25_75582.jsonl:1.22",
        "[train] LoRA+ optimizer groups: ratio=16.00 base_group=84 fast_group=42",
        "[train] step=17 loss=4.5678 lr=9.5e-06 rdrop=0.0421",
        "[data] progress: pairs=42000/42000 raw=75145 kept=48082 rate=1021.34/s",
        "[data] quality filter: raw=75145 kept=48082 empty=338 placeholder=5183 filtered=15531 deduped=6011 source_cap=0 synthetic_cap=0 prompt_cap=6082 cap_relax=0",
        "[data] synthetic_kept=3084/42000",
        "[data] train=47888 eval=194 (raw_eval=500)",
        "[distill] config: target=5880 ratio=0.140 max_seconds=12000.0 best_of=3 min_gain=0.180 density_bias=0.200",
        "[distill] progress: visited=120/650 generated=42 rate=14.00/s",
        "[sft] quality filter: threshold=0.90 kept=41928 dropped_quality=53 dropped_short=0 dropped_synthetic=812 exempt_sources=3",
        "[pref] building preference pairs (mode=ipo)...",
        "[pref] objective schedule: beta=1.9000->3.6000 margin=0.0000->0.0000 ipo_target=0.2632->0.1389 label_smoothing=0.000 xpo_clip=0.000 hardness_gamma=1.150 wpo_alpha=0.350 robust_alpha=0.300 robust_eta=0.080 self_play_budget=4 self_play_curriculum=easy_to_hard self_play_max_new_tokens=40 anchor_weight=0.0000",
        "[pref] mining config: mode=auto generation=on target_pairs=3000 candidates=48082 max_attempts=60000 self_play_budget=4 self_play_curriculum=easy_to_hard self_play_max_new_tokens=40 selection=capacity_aware keep_ratio=0.620 max_seconds=4500.0",
        "[pref] mining progress: visited=900/48082 accepted=512 rate=6.75/s",
        "[pref] pair selection: strategy=capacity_aware keep=1860/3000 keep_ratio=0.620 gap=0.312->0.401 sim=0.441->0.382 conv=0.220->0.348 reason=0.410->0.622 creative=0.180->0.264 density=0.330->0.517 selected_score_mean=1.1180",
        "[pref] mining complete: pairs=1860 mined=3000 visited=9000 generation_failures=3 brevity_filtered=7 stop_reject_variants=42 self_play_prompts=4 self_play_candidates=7 self_play_failures=0 elapsed=245.2s",
        "[pref] pairs=1860",
        "[pref] reference margins cached for 1860 pairs",
        "[pref] step=7 loss=1.2345 lr=1.4e-05 beta=1.9 margin=0.18 wpo_std=0.2184",
        "[eval] quality filter: threshold=1.05 kept=194 dropped_quality=50 dropped_synthetic=256",
        "[checkpoint] saved stage=preference step=20",
    ]

    with tempfile.TemporaryDirectory() as td:
        out_log = Path(td) / "train_sample.out.log"
        out_log.write_text("\n".join(sample_lines), encoding="utf-8")
        parsed = _parse_log(out_log)

    assert parsed.stage == "eval"
    assert parsed.pref_step == 7
    assert parsed.pref_pairs == 1860
    assert abs(float(parsed.rdrop or 0.0) - 0.0421) < 1e-9
    assert abs(float(parsed.wpo_std or 0.0) - 0.2184) < 1e-9
    assert parsed.pref_objective == "ipo"
    assert parsed.pref_reference_pairs == 1860
    assert parsed.last_checkpoint_stage == "preference"
    assert parsed.last_checkpoint_step == 20
    assert "gradient_checkpointing=True" in parsed.runtime_summary
    assert "neftune_sft=5.000" in parsed.adapter_summary
    assert "lora_plus_ratio=16.00" in parsed.adapter_summary
    assert "quality_anchor_v2.jsonl:0.91" in parsed.source_balance_summary
    assert "ipo_target=0.2632->0.1389" in parsed.objective_summary
    assert "robust_alpha=0.300" in parsed.objective_summary
    assert parsed.data_pairs_current == 42000
    assert parsed.data_pairs_total == 42000
    assert "synthetic=3084/42000" in parsed.data_summary
    assert parsed.eval_pairs_count == 194
    assert parsed.raw_eval_pairs_count == 500
    assert "kept=194/500" in parsed.eval_summary
    assert "best_of=3" in parsed.distill_config_summary
    assert "min_gain=0.180" in parsed.distill_config_summary
    assert "density_bias=0.200" in parsed.distill_config_summary
    assert parsed.distill_generated == 42
    assert parsed.distill_total == 650
    assert "threshold=0.90" in parsed.sft_filter_summary
    assert "dropped_synthetic=812" in parsed.sft_filter_summary
    assert parsed.pref_mining_target_pairs == 3000
    assert parsed.pref_mining_candidates == 48082
    assert parsed.pref_mining_accepted == 1860
    assert parsed.pref_mining_generation_failures == 3
    assert parsed.pref_mining_self_play_budget == 4
    assert parsed.pref_mining_self_play_curriculum == "easy_to_hard"
    assert parsed.pref_mining_self_play_max_new_tokens == 40
    assert parsed.pref_mining_self_play_prompts == 4
    assert parsed.pref_mining_self_play_candidates == 7
    assert "brevity_filtered=7" in parsed.pref_mining_summary
    assert "self_play_prompts=4" in parsed.pref_mining_summary
    assert "strategy=capacity_aware keep=1860/3000" in parsed.pref_selection_summary
    assert "density=0.330->0.517" in parsed.pref_selection_summary

    parsed.stage = "data"
    label, pct, rate, eta = _derive_stage_monitor_fields(parsed)
    assert label == "42000/42000 pairs"
    assert pct == 100.0
    assert rate == "1021.34/s"
    assert eta == 0.0

    parsed.stage = "preference_mining"
    label, pct, rate, eta = _derive_stage_monitor_fields(parsed)
    assert label == "1860/3000 acc"
    assert pct is not None and 18.0 < pct < 19.0
    assert rate == "6.75/s"
    assert eta is not None and eta > 0

    parsed.stage = "preference"
    label, pct, rate, eta = _derive_stage_monitor_fields(parsed)
    assert label == "1860"
    assert pct is None
    assert rate == "-"
    assert eta is None

    parsed.stage = "sft_setup"
    label, pct, rate, eta = _derive_stage_monitor_fields(parsed)
    assert label == "setup"
    assert pct is None
    assert rate == "-"
    assert eta is None

    parsed.stage = "sft_filter"
    label, pct, rate, eta = _derive_stage_monitor_fields(parsed)
    assert label == "quality filter"
    assert pct is None
    assert rate == "-"
    assert eta is None

    parsed.stage = "eval"
    label, pct, rate, eta = _derive_stage_monitor_fields(parsed)
    assert label == "194/500 eval"
    assert pct is not None and 38.0 < pct < 39.0
    assert rate == "-"
    assert eta is None

    data_snap = _make_snapshot()
    data_pct = _compute_display_progress_percent(data_snap)
    assert data_pct is not None and 4.9 < data_pct < 5.1

    sft_snap = _make_snapshot(
        stage="sft",
        sft_step=100,
        progress_units=100.0,
        progress_percent=(100.0 / 600.0) * 100.0,
        stage_progress_label="-",
        stage_progress_percent=None,
        stage_rate_label="-",
        stage_eta_seconds=None,
    )
    sft_pct = _compute_display_progress_percent(sft_snap)
    assert sft_pct is not None and sft_pct > sft_snap.progress_percent
    assert 35.0 < sft_pct < 36.0

    launch_cmd = _build_launch_command(
        root_dir=Path.cwd(),
        launch_hint=str(Path.cwd() / "source" / "run_train_qwen_supermix_v25_selective_pref.ps1"),
        command_line="",
    )
    assert "powershell -ExecutionPolicy Bypass -File" in launch_cmd
    assert "source" in launch_cmd

    health = _build_health_summary(
        status="stopped",
        stage="sft",
        pid_file=Path("train_sample.pid"),
        pid_source="pid_file",
        pid_alive=False,
        err_signal="warn",
        err_summary="warning: gradient checkpointing disabled",
        stale_minutes=48.5,
    )
    assert "stopped before completion" in health
    assert "pid file is stale" in health
    assert "gradient checkpointing disabled" in health

    print("Training monitor parser smoke test PASSED")


def test_canvas_size_resolution():
    assert _resolve_canvas_size(1, 1, 620, 110) == (620, 110)
    assert _resolve_canvas_size(480, 72, 620, 110) == (480, 72)
    assert _resolve_canvas_size("bad", None, 620, 110) == (620, 110)


def test_history_windows():
    assert _history_window_seconds("10m") == 600.0
    assert _history_window_seconds("60m") == 3600.0
    assert _history_window_seconds("6h") == 21600.0
    assert _history_window_seconds("unknown") == 3600.0


def test_monitor_focus_and_issue_summaries():
    errored = _make_snapshot(run_name="run_error", stage="sft", err_signal="error", err_summary="cuda oom")
    stalled = _make_snapshot(run_name="run_stalled", status="stalled", stage="preference_mining", stale_minutes=42.0)
    finished = _make_snapshot(run_name="run_done", status="finished", stage="done")

    assert "teacher generation rate" in _build_run_recommendation(_make_snapshot(stage="distill"))
    assert "archive the logs" in _build_run_recommendation(finished)

    stage_summary = _summarize_stage_mix([errored, stalled, finished])
    assert stage_summary.startswith("Stage Mix:")
    assert "sft 1" in stage_summary
    assert "preference_mining 1" in stage_summary
    assert "done 1" in stage_summary

    issue_summary = _summarize_issue_runs([finished, stalled, errored])
    assert issue_summary.startswith("Issue Radar:")
    assert "run_error [running/sft error]" in issue_summary
    assert "run_stalled [stalled/preference_mining]" in issue_summary


def test_phase_breakdown_rows():
    snap = _make_snapshot(
        stage="sft",
        sft_step=100,
        sft_target_steps=400,
        pref_target_steps=120,
        pref_step=0,
        pref_pairs=0,
        stage_progress_percent=None,
    )
    rows = _phase_breakdown_rows(snap)
    by_phase = {name: (weight, completion, current) for name, weight, completion, current in rows}

    assert by_phase["data"] == (10.0, 1.0, False)
    assert by_phase["distill"] == (10.0, 1.0, False)
    assert by_phase["sft_setup"] == (5.0, 1.0, False)
    assert by_phase["sft"] == (50.0, 0.25, True)
    assert by_phase["preference_mining"] == (10.0, 0.0, False)
    assert by_phase["preference"] == (15.0, 0.0, False)


def test_eval_filter_fallback_parse():
    sample_lines = [
        "[data] train=47888 eval=128 (raw_eval=500)",
        "[eval] quality filter fallback: kept=128 after ranking top non-synthetic pairs (threshold=1.05, dropped_quality=30, dropped_synthetic=342)",
    ]
    with tempfile.TemporaryDirectory() as td:
        out_log = Path(td) / "train_eval_fallback.out.log"
        out_log.write_text("\n".join(sample_lines), encoding="utf-8")
        parsed = _parse_log(out_log)

    assert parsed.eval_pairs_count == 128
    assert parsed.raw_eval_pairs_count == 500
    assert "fallback threshold=1.05" in parsed.eval_summary
    parsed.stage = "eval"
    label, pct, rate, eta = _derive_stage_monitor_fields(parsed)
    assert label == "128/500 eval"
    assert pct is not None and 25.0 < pct < 26.0
    assert rate == "-"
    assert eta is None


def test_research_results_summary():
    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        research_dir = root / "research"
        research_dir.mkdir(parents=True, exist_ok=True)
        (research_dir / "results.tsv").write_text(
            "\n".join(
                [
                    "timestamp\tcommit\trun_tag\toutput_dir\tbenchmark_json\ttoken_f1_delta\tchar_similarity_delta\tperplexity_delta\tavg_gen_seconds_delta\tstatus\tdescription",
                    "2026-03-21T09:25:55.3046231Z\tff94ce5\tpref_stop_iter_20260321\tC:/tmp/out\tC:/tmp/bench.json\t-0.112267\t-0.072091\t34941.764401\t4.471879\tdiscard\tstop-aware preference mining",
                    "2026-03-21T10:00:00.0000000Z\tff94ce5\tself_play_iter_20260321\tC:/tmp/out2\tC:/tmp/bench2.json\t-0.090000\t-0.050000\t12000.0\t2.250000\tkeep\tbudgeted self-play mining",
                ]
            ),
            encoding="utf-8",
        )
        results = _load_research_results(root)
        summary, best_line, latest_line = _summarize_research_results(results)

    assert len(results) == 2
    assert results[0].run_tag == "self_play_iter_20260321"
    assert "keep 1" in summary
    assert "discard 1" in summary
    assert "self_play_iter_20260321" in best_line
    assert "budgeted self-play mining" in latest_line


def test_research_failure_insight_uses_sample_summary_and_artifact_path():
    with tempfile.TemporaryDirectory() as td:
        run_dir = Path(td)
        sample_path = run_dir / "sample_comparison.jsonl"
        sample_path.write_text("", encoding="utf-8")
        benchmark_path = run_dir / "benchmark_results.json"
        benchmark_path.write_text(
            __import__("json").dumps(
                {
                    "artifacts": {
                        "sample_comparison_jsonl": str(sample_path),
                    },
                    "sample_summary": {
                        "worst_regression": {
                            "sample_index": 3,
                            "source": "conversation_data.coding_knowledge_2026_02_19.jsonl",
                            "delta_token_f1": -0.5123,
                            "delta_char_similarity": -0.2214,
                            "delta_gen_seconds": 4.75,
                            "user_preview": "Explain binary search in one sentence.",
                            "reference_preview": "Binary search halves the sorted interval each step.",
                            "tuned_prediction_preview": "Binary search is useful in many situations and can help a lot.",
                        }
                    },
                }
            ),
            encoding="utf-8",
        )

        insight = _load_research_failure_insight(benchmark_path)

    assert "#3" in insight.summary_line
    assert "dF1 -0.512" in insight.summary_line
    assert "Prompt: Explain binary search in one sentence." == insight.prompt_line
    assert "Binary search is useful in many situations" in insight.prediction_line
    assert str(sample_path) == insight.sample_comparison_jsonl


def test_research_failure_insight_falls_back_to_sample_comparison_jsonl():
    with tempfile.TemporaryDirectory() as td:
        run_dir = Path(td)
        sample_path = run_dir / "sample_comparison.jsonl"
        sample_path.write_text(
            "\n".join(
                [
                    __import__("json").dumps(
                        {
                            "sample_index": 1,
                            "source": "math",
                            "delta_token_f1": -0.75,
                            "delta_char_similarity": -0.60,
                            "delta_gen_seconds": 2.50,
                            "user": "Answer only: 2 + 2?",
                            "reference": "4",
                            "tuned_prediction": "4. The answer is four.",
                        }
                    )
                ]
            ),
            encoding="utf-8",
        )
        benchmark_path = run_dir / "benchmark_results.json"
        benchmark_path.write_text(
            __import__("json").dumps(
                {
                    "artifacts": {
                        "sample_comparison_jsonl": str(sample_path),
                    }
                }
            ),
            encoding="utf-8",
        )

        insight = _load_research_failure_insight(benchmark_path)

    assert "#1 math" in insight.summary_line
    assert "Prompt: Answer only: 2 + 2?" == insight.prompt_line
    assert "Tuned: 4. The answer is four." in insight.prediction_line
    assert "| Ref: 4" in insight.prediction_line


def test_research_failure_insight_reports_missing_sample_trace():
    with tempfile.TemporaryDirectory() as td:
        run_dir = Path(td)
        benchmark_path = run_dir / "benchmark_results.json"
        benchmark_path.write_text("{}", encoding="utf-8")

        insight = _load_research_failure_insight(benchmark_path)

    assert insight.summary_line == "Top regression: unavailable for this run"
    assert "rerun the benchmark with detailed traces" in insight.prompt_line


def test_sft_filter_fallback_parse():
    sample_lines = [
        "[sft] quality filter fallback: kept=8 too small; using unfiltered set=9",
    ]
    with tempfile.TemporaryDirectory() as td:
        out_log = Path(td) / "train_sft_fallback.out.log"
        out_log.write_text("\n".join(sample_lines), encoding="utf-8")
        parsed = _parse_log(out_log)

    assert parsed.sft_filter_summary == "fallback kept=8 using_unfiltered=9"


def test_runtime_device_value_prefers_resolved_backend():
    snap = _make_snapshot(
        runtime_summary=(
            "requested=auto resolved=cpu device=cpu model_dtype=torch.float32 "
            "gradient_checkpointing=False torch_threads=8 interop_threads=4"
        )
    )
    assert _runtime_device_value(snap) == "cpu"

    dml_snap = _make_snapshot(runtime_summary="device=privateuseone:0 model_dtype=torch.float16")
    assert _runtime_device_value(dml_snap) == "dml"


def test_summarize_windows_accelerators_rolls_up_gpu_and_npu_rows():
    payload = {
        "adapters": [
            {"Name": "Qualcomm Adreno X1-45 GPU", "DriverVersion": "31.0.105.0"},
        ],
        "memory": [
            {
                "Name": "luid_0x00000000_0x000105F3_phys_0",
                "DedicatedUsage": 0,
                "SharedUsage": 536870912,
                "TotalCommitted": 2147483648,
            }
        ],
        "engines": [
            {"Name": "pid_1_luid_0x0_phys_0_eng_0_engtype_3D", "UtilizationPercentage": 17},
            {"Name": "pid_2_luid_0x0_phys_0_eng_4_engtype_Compute", "UtilizationPercentage": 62},
            {"Name": "pid_3_luid_0x0_phys_0_eng_5_engtype_VideoDecode", "UtilizationPercentage": 9},
        ],
        "npu": [
            {
                "Name": "Snapdragon X Plus Hexagon NPU",
                "Manufacturer": "Qualcomm Technologies, Inc.",
                "Status": "OK",
            }
        ],
    }

    summary = _summarize_windows_accelerators(payload)

    assert summary["gpus"]
    assert summary["gpus"][0]["name"] == "Qualcomm Adreno X1-45 GPU"
    assert abs(float(summary["gpus"][0]["util"]) - 62.0) < 1e-9
    assert abs(float(summary["gpus"][0]["graphics"]) - 17.0) < 1e-9
    assert abs(float(summary["gpus"][0]["shared_gb"]) - 0.5) < 1e-9
    assert summary["npus"][0]["status"] == "OK"


if __name__ == "__main__":
    tests = [
        smoke_test_training_monitor_parsing,
        test_canvas_size_resolution,
        test_history_windows,
        test_monitor_focus_and_issue_summaries,
        test_phase_breakdown_rows,
        test_eval_filter_fallback_parse,
        test_research_results_summary,
        test_research_failure_insight_uses_sample_summary_and_artifact_path,
        test_research_failure_insight_falls_back_to_sample_comparison_jsonl,
        test_research_failure_insight_reports_missing_sample_trace,
        test_sft_filter_fallback_parse,
        test_runtime_device_value_prefers_resolved_backend,
        test_summarize_windows_accelerators_rolls_up_gpu_and_npu_rows,
    ]
    for test in tests:
        print(f"Running {test.__name__}...")
        test()
