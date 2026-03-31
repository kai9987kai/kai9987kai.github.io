import sys
import tempfile
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parent / "source"))

import training_monitor_gui as monitor  # noqa: E402


def test_utf16_tail_decode() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "train_utf16.out.log"
        text = "[data] progress: pairs=2000/48000 raw=2716 kept=2018 rate=1292.72/s\n"
        path.write_bytes(text.encode("utf-16"))
        lines = monitor._read_tail_lines(path)
        assert any("pairs=2000/48000" in line for line in lines), lines


def test_process_match_prefers_live_python() -> None:
    out_log = Path("train_qwen_supermix_v26_cognitive_activation.out.log")
    processes = [
        monitor.ProcessEntry(
            pid=10,
            parent_pid=1,
            name="python.exe",
            command_line="python source\\training_monitor_gui.py --root .",
        ),
        monitor.ProcessEntry(
            pid=20,
            parent_pid=1,
            name="powershell.exe",
            command_line="powershell -File source\\run_train_qwen_supermix_v26_cognitive_activation.ps1",
        ),
        monitor.ProcessEntry(
            pid=30,
            parent_pid=20,
            name="python.exe",
            command_line=(
                "python -u source\\qwen_supermix_pipeline.py --output_dir "
                "artifacts\\qwen_supermix_enhanced_v26_cognitive_activation"
            ),
        ),
    ]
    pid, command_line, source = monitor._find_live_process_for_run(
        run_name="train_qwen_supermix_v26_cognitive_activation",
        out_log=out_log,
        launch_hint="source\\run_train_qwen_supermix_v26_cognitive_activation.ps1",
        processes=processes,
    )
    assert pid == 30
    assert "qwen_supermix_pipeline.py" in command_line
    assert source == "process_scan"


def test_collect_snapshots_marks_process_scan_run_running() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        out_log = root / "train_qwen_supermix_v26_cognitive_activation.out.log"
        out_log.write_text(
            "[runtime] device=cpu model_dtype=torch.float32 gradient_checkpointing=False\n"
            "[data] progress: pairs=4000/48000 raw=5938 kept=4136 rate=1165.14/s\n",
            encoding="utf-8",
        )

        original_list = monitor._list_process_entries
        try:
            monitor.PROCESS_LIST_CACHE = (0.0, [])
            monitor._list_process_entries = lambda: [
                monitor.ProcessEntry(
                    pid=42,
                    parent_pid=1,
                    name="python.exe",
                    command_line=(
                        "python -u source\\qwen_supermix_pipeline.py --output_dir "
                        "artifacts\\qwen_supermix_enhanced_v26_cognitive_activation"
                    ),
                )
            ]
            snaps = monitor.collect_run_snapshots(root, stale_minutes_threshold=20.0)
        finally:
            monitor._list_process_entries = original_list
            monitor.PROCESS_LIST_CACHE = (0.0, [])

        assert len(snaps) == 1
        snap = snaps[0]
        assert snap.pid == 42
        assert snap.pid_alive is True
        assert snap.pid_source == "process_scan"
        assert snap.status == "running"
        assert snap.stage == "data"


if __name__ == "__main__":
    tests = [
        test_utf16_tail_decode,
        test_process_match_prefers_live_python,
        test_collect_snapshots_marks_process_scan_run_running,
    ]
    for test in tests:
        print(f"Running {test.__name__}...")
        test()
    print("All training monitor improvement tests passed.")
