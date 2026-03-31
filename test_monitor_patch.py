import sys
import psutil
from pathlib import Path

# Add source to import path
sys.path.insert(0, str(Path("source").resolve()))

import training_monitor_gui as tmg

def test_psutil():
    print("Testing psutil tracking...")
    p = psutil.Process()
    print("CPU:", p.cpu_percent(interval=None))
    print("RAM (GB):", p.memory_info().rss / (1024 ** 3))

def test_fmt_eta():
    print("\nTesting _fmt_eta...")
    print("60s:", tmg._fmt_eta(60.0))
    print("3600s:", tmg._fmt_eta(3600.0))
    print("86400s (1d):", tmg._fmt_eta(86400.0))

def test_snapshot_logic():
    print("\nTesting full collect snapshots...")
    snaps = tmg.collect_run_snapshots(Path(".").resolve(), 20.0)
    for snap in snaps:
        ram_str = f"{snap.ram_gb:.2f}G" if snap.ram_gb is not None else "None"
        print(f"Run {snap.run_name}: Status={snap.status}, CPU={snap.cpu_percent}, RAM={ram_str}")

if __name__ == "__main__":
    test_psutil()
    test_fmt_eta()
    test_snapshot_logic()
    print("All tests passed.")
