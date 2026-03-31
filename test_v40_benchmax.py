from __future__ import annotations

import json
import sys
import types
from pathlib import Path

import torch

SOURCE_DIR = Path(__file__).resolve().parent / "source"
if str(SOURCE_DIR) not in sys.path:
    sys.path.append(str(SOURCE_DIR))

import v40_benchmax_common as common
import v40_benchmax_core as core
import v40_benchmax_pipeline as pipeline


def _write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=True) + "\n")


def test_manifest_map_and_ablation_pack_aliases(monkeypatch, tmp_path):
    manifest = {
        "ablation_matrix": [
            {
                "id": "v40_v33data_v39recipe",
                "data_family": "v33_style",
                "recipe_family": "v39_style",
            }
        ],
        "data_recipes": {
            "v33": {"sample_size": 1, "paper_rows": False, "prompt_sources": []},
            "v39": {"sample_size": 1, "counts": {"arc_count": 1, "boolq_count": 1, "gsm8k_count": 1, "hellaswag_count": 1, "mmlu_count": 1, "piqa_count": 1}},
        },
    }

    monkeypatch.setattr(common, "load_manifest", lambda path=None: manifest)
    monkeypatch.setattr(common, "build_v33_style_rows", lambda repo_root, seed, sample_size: ([{"prompt": "v33", "assistant": "a", "source": "s", "intent": "general", "domain": "general"}], {"recipe": "v33"}))
    monkeypatch.setattr(common, "build_v39_style_rows", lambda repo_root, seed, sample_size: ([{"prompt": "v39", "assistant": "b", "source": "s", "intent": "general", "domain": "general"}], {"recipe": "v39"}))

    mapping = common.manifest_ablation_map(manifest)
    assert "v40_v33data_v39recipe" in mapping
    rows, summary = common.build_ablation_pack(tmp_path, "v40_v33data_v39recipe", seed=7)
    assert rows[0]["prompt"] == "v33"
    assert summary["ablation_id"] == "v40_v33data_v39recipe"
    assert summary["head_recipe"] == "v39_style"


def test_export_hard_examples_and_summary(tmp_path):
    details_path = tmp_path / "details.jsonl"
    _write_jsonl(
        details_path,
        [
            {
                "model": "v33_final",
                "benchmark": "gsm8k",
                "prompt": "Solve 2+2.",
                "reference_text": "Final answer: 4",
                "reference_extracted": "4",
                "prediction": "Final answer: 3",
                "prediction_extracted": "3",
                "exact": 0.0,
                "token_f1": 0.40,
                "char_similarity": 0.50,
            },
            {
                "model": "v33_final",
                "benchmark": "boolq",
                "prompt": "Is the sky blue?",
                "reference_text": "Final answer: yes",
                "reference_extracted": "yes",
                "prediction": "Final answer: yes",
                "prediction_extracted": "yes",
                "exact": 1.0,
                "token_f1": 1.0,
                "char_similarity": 1.0,
            },
        ],
    )
    summary = core.export_hard_example_pack(
        details_jsonl=details_path,
        benchmark_summary={"summary_rows": [{"model": "v33_final", "overall_exact": 1.0, "benchmarks": {}}]},
        output_dir=tmp_path / "hard",
        max_examples_per_bucket=8,
        max_examples_total=8,
    )
    assert summary["total_examples"] == 1
    assert summary["group_counts"]
    assert (Path(summary["jsonl_path"]).exists())
    assert (Path(summary["json_path"]).exists())
    assert (Path(summary["md_path"]).exists())


def test_checkpoint_soup_dry_run_and_average(tmp_path):
    ckpt1 = tmp_path / "ckpt1.pth"
    ckpt2 = tmp_path / "ckpt2.pth"
    torch.save({"layer.weight": torch.tensor([1.0, 3.0]), "layer.bias": torch.tensor([2.0])}, ckpt1)
    torch.save({"layer.weight": torch.tensor([3.0, 5.0]), "layer.bias": torch.tensor([2.0])}, ckpt2)

    dry = core.inspect_checkpoint_compatibility([ckpt1, ckpt2])
    assert dry["compatible"] is True
    merged_path = tmp_path / "merged.pth"
    meta_path = tmp_path / "merged.meta.json"
    merged = core.average_checkpoints([ckpt1, ckpt2], merged_path, dry_run=False, metadata_path=meta_path)
    assert merged["compatible"] is True
    payload = torch.load(merged_path, map_location="cpu", weights_only=False)
    assert torch.equal(payload["layer.weight"], torch.tensor([2.0, 4.0]))
    assert meta_path.exists()


def test_promotion_report_uses_leaders_and_attribution():
    summary = {
        "summary_rows": [
            {"model": "v33_final", "overall_exact": 0.30, "benchmarks": {"arc_challenge": 0.20, "gsm8k": 0.10}},
            {"model": "v39_final", "overall_exact": 0.31, "benchmarks": {"arc_challenge": 0.19, "gsm8k": 0.12}},
            {
                "model": "v40_candidate",
                "overall_exact": 0.35,
                "benchmarks": {"arc_challenge": 0.22, "gsm8k": 0.13},
                "dataset_summary": {"source_counts": {"coding_delta_v5": 3, "repair_rows": 8}},
                "warm_start": {"source": "v39"},
                "notes": ["recipe swap"],
            },
        ]
    }
    report = core.build_promotion_report(
        benchmark_summary=summary,
        candidate_model="v40_candidate",
        leader_models=["v33_final", "v39_final"],
        manifest={"promotion_gate": {"max_benchmark_regression": 0.01, "min_overall_gain_vs_v33_final": 0.0, "min_overall_gain_vs_v39_final": 0.0}},
    )
    assert report["promotion_gate"]["promote"] is True
    assert report["best_leader"] == "v39_final"
    assert "distillation / repair data" in report["attribution"]
    assert "checkpoint soup / warm-start transfer" in report["attribution"]


def test_collective_distillation_hook_uses_fake_manager(tmp_path):
    prompts = tmp_path / "prompts.jsonl"
    _write_jsonl(
        prompts,
        [
            {"prompt": "Explain keyset pagination briefly.", "source": "test", "metadata": {"task_mode": "coding"}},
            {"user": "What is 2+2?", "source": "test", "metadata": {"task_mode": "math"}},
        ],
    )

    class FakeManager:
        def __init__(self) -> None:
            self.calls = []

        def handle_prompt(self, *, session_id: str, prompt: str, model_key: str, action_mode: str, settings: dict):
            self.calls.append((session_id, prompt, model_key, action_mode, settings))
            answer = f"answer:{prompt}"
            if "pagination" in prompt.lower() and model_key != "auto":
                answer = "consensus pagination answer"
            return {
                "active_model_key": model_key,
                "active_model_label": f"{model_key}-label",
                "route_reason": "fake route",
                "response": answer,
                "agent_trace": {"tool_events": [], "consultation_rows": []},
            }

    out = pipeline.build_collective_distillation_bundle(
        prompts_jsonl=prompts,
        output_dir=tmp_path / "distill",
        manifest={"distillation": {"default_model_key": "auto", "teacher_model_keys": ["auto", "omni_collective_v5", "omni_collective_v4"], "default_action_mode": "auto", "default_agent_mode": "collective", "allow_web_search": True, "allow_cmd_open": True, "consensus_selection": "majority_then_primary", "min_consensus_votes": 2}},
        resume=False,
        manager_factory=FakeManager,
    )
    jsonl_path = Path(out["jsonl_path"])
    assert jsonl_path.exists()
    rows = [json.loads(line) for line in jsonl_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert len(rows) == 2
    assert all("prompt_hash" in row for row in rows)
    assert all("teacher_answer" in row for row in rows)
    assert all("teacher_candidates" in row for row in rows)
    assert rows[0]["teacher_consensus_votes"] >= 2
    assert out["avg_teacher_agreement_ratio"] >= 0.0


def test_research_pack_emits_curriculum_and_verifier_rows(tmp_path):
    hard_examples = tmp_path / "hard_examples.jsonl"
    distill = tmp_path / "distill.jsonl"
    _write_jsonl(
        hard_examples,
        [
            {
                "benchmark": "gsm8k",
                "prompt": "What is 7 + 5?",
                "prediction": "11",
                "reference_text": "Final answer: 12",
                "reference_extracted": "12",
                "failure_signature": "math_numeric_miss",
                "hardness_score": 1.4,
                "prompt_hash": common.stable_hash("What is 7 + 5?"),
            }
        ],
    )
    _write_jsonl(
        distill,
        [
            {
                "prompt_hash": common.stable_hash("What is 7 + 5?"),
                "teacher_model_key": "auto",
                "teacher_answer": "Final answer: 12",
                "teacher_agreement_ratio": 1.0,
            }
        ],
    )
    result = pipeline.build_research_pack_bundle(
        hard_examples_jsonl=hard_examples,
        output_dir=tmp_path / "research",
        manifest={"research_pack": {"frontier_hardness_threshold": 1.15, "bridge_hardness_threshold": 0.7, "max_rows_total": 32, "max_rows_per_variant": 16}},
        distillation_jsonl=distill,
        max_rows=16,
    )
    summary = result["research_pack"]
    assert summary["total_rows"] >= 3
    assert "verifier_replay" in summary["variant_counts"]
    assert "frontier" in summary["stage_counts"]
    rows = [json.loads(line) for line in Path(summary["jsonl_path"]).read_text(encoding="utf-8").splitlines() if line.strip()]
    assert any(row["source"] == "v40_benchmax_verifier_replay" for row in rows)
    assert any(row["metadata"]["verification_budget"] == "slow" for row in rows)


def test_build_protein_folding_rows_adds_knowledge_pack():
    rows, summary = common.build_protein_folding_rows(seed=7, max_rows=24)
    assert len(rows) == 24
    assert summary["selected_rows"] == 24
    assert summary["concepts"] >= 6
    assert all(row["domain"] == "knowledge" for row in rows)
    assert all(row["metadata"]["subdomain"] == "protein_folding" for row in rows)


def test_v39_style_rows_include_support_and_protein(monkeypatch, tmp_path):
    support_path = tmp_path / "datasets" / "support.jsonl"
    support_path.parent.mkdir(parents=True, exist_ok=True)
    support_path.write_text(
        json.dumps({"user": "Explain a coding bug briefly.", "assistant": "Describe the failing assumption and then test the boundary case.", "source": "support"}) + "\n",
        encoding="utf-8",
    )

    manifest = {
        "data_recipes": {
            "v39": {
                "sample_size": 6,
                "counts": {"arc_count": 1, "boolq_count": 1, "gsm8k_count": 1, "hellaswag_count": 1, "mmlu_count": 1, "piqa_count": 1},
                "support_prompt_sources": [str(Path("datasets") / "support.jsonl")],
                "support_sample_size": 1,
                "protein_pack_count": 2,
            }
        }
    }
    monkeypatch.setattr(common, "load_manifest", lambda path=None: manifest)
    fake_module = types.SimpleNamespace(
        build_dataset=lambda args: [
            {
                "user": "Answer a benchmark question.",
                "assistant": "Final answer: A",
                "source": "bench",
                "metadata": {"benchmark": "arc_challenge", "task_mode": "reasoning"},
            }
            for _ in range(8)
        ]
    )
    monkeypatch.setitem(sys.modules, "build_reasoning_benchmix_v39", fake_module)

    rows, summary = common.build_v39_style_rows(tmp_path, seed=5, sample_size=6)
    assert len(rows) == 6
    assert summary["support_rows"] == 1
    assert summary["protein_rows"] == 2
    assert any(row["source"] == "v40_benchmax_protein_folding" for row in rows)
    assert any("coding bug" in row["prompt"].lower() for row in rows)
