# Supermix Kaggle Guide

This guide is for running the current Supermix Qwen training path on Kaggle with the same core trainer as local:

- same `source/qwen_supermix_pipeline.py`
- same Qwen LoRA architecture
- same grouped eval split support
- same true SFT packing support
- same preference stage support
- same distillation hooks when teacher assets are attached

It does not try to run every desktop-only part of the repo inside Kaggle. It stays focused on cloud training.

## Current notebook

Use this notebook:

- local file: `output/jupyter-notebook/supermix-kaggle-current-training.ipynb`
- GitHub import source: `https://github.com/kai9987kai/Supermix_29/blob/main/output/jupyter-notebook/supermix-kaggle-current-training.ipynb`

The notebook already includes:

- Kaggle input auto-detection by file contents
- Hugging Face token loading from Kaggle Secrets
- base-model snapshot download and validation
- background training launch
- PID and launch-state tracking
- log tail and GPU status inspection
- resume-bundle packaging
- extra attached training dataset discovery
- free-tier data-budget controls
- the `balanced_quality_t4` default profile

## Recommended profile

For Kaggle free tier, use:

- `TRAIN_PROFILE = 'balanced_quality_t4'`

That is the current default. It is the best quality-oriented option that still tries to stay practical on free T4 sessions.

Use these only if you have a reason:

- `fast_free_t4`: lower-risk, faster, less ambitious
- `current_kaggle`: heavier feature mix, easier to overrun free-tier time
- `parity_v28`: older heavier local-style path, not recommended for normal free-tier use

## What you need on Kaggle

Notebook settings:

- Accelerator: `GPU`
- Internet: `On`
- Language: `Python`

Recommended secret:

- Kaggle Secret named `HF_TOKEN`

That is optional, but strongly recommended. It improves Hugging Face download reliability and rate limits.

## Kaggle inputs

Attach these inputs to the notebook:

- `supermix-source`
- `supermix-datasets`
- `supermix-runtime-python`
- `supermix-warm-start` if you want resume parity or warm-start behavior

Important:

- Kaggle may mount an attached dataset under a runtime path name that does not exactly match the dataset card name.
- The notebook now auto-detects inputs by contents, so this is fine.
- Do not hard-assume the runtime path will be `/kaggle/input/supermix-datasets`. It may end up as something like `/kaggle/input/datasets`.

## Local folders to upload as Kaggle datasets

If you need to create or recreate the Kaggle datasets from your PC, use these local folders:

- `output/kaggle-upload/supermix-source`
- `output/kaggle-upload/supermix-datasets`
- `output/kaggle-upload/supermix-runtime-python`
- `output/kaggle-upload/supermix-warm-start`

If Kaggle prefers zip uploads, use:

- `output/kaggle-upload-archives/supermix-source.zip`
- `output/kaggle-upload-archives/supermix-datasets.zip`
- `output/kaggle-upload-archives/supermix-runtime-python.zip`
- `output/kaggle-upload-archives/supermix-warm-start.zip`

## What each input is for

`supermix-source`

- preferred source snapshot for the notebook
- avoids Git LFS problems during source bootstrap
- should contain the `source/` tree

`supermix-datasets`

- required training JSONL files
- the notebook expects these base files to be discoverable:
  - `conversation_data.quality_anchor_v2.jsonl`
  - `conversation_data.coding_knowledge_2026_02_19.jsonl`
  - `conversation_data.world_events_2026_02_19.jsonl`
  - `conversation_data.supermix_plus_v27_500k.jsonl`
  - `conversation_data.mega_reasoning_creative_v25_75582.jsonl`
  - `conversation_data.mega_creative_250k_v2.jsonl`

`supermix-runtime-python`

- optional teacher metadata and weights
- if missing, teacher distillation is disabled automatically instead of crashing

`supermix-warm-start`

- optional prior adapter/checkpoint material
- used when present to seed resume or warm-start behavior

## Fresh setup from scratch

1. Open Kaggle and create a new notebook by importing:

   `output/jupyter-notebook/supermix-kaggle-current-training.ipynb`

2. In notebook settings:

   - set `GPU`
   - set `Internet = On`

3. Add the Kaggle inputs:

   - `supermix-source`
   - `supermix-datasets`
   - `supermix-runtime-python`
   - `supermix-warm-start` if available

4. Add the Kaggle Secret:

   - name: `HF_TOKEN`
   - value: your Hugging Face read token

5. Leave the default config unless you have a specific reason to change it:

   - `TRAIN_PROFILE = 'balanced_quality_t4'`
   - `GPU_PROFILE = 'auto'`
   - `LAUNCH_MODE = 'background'`

6. Run the notebook from the top.

## What each notebook step does

Step 1

- verifies GPU runtime

Step 2

- resolves Kaggle inputs
- loads `HF_TOKEN` if present
- sets working directories under `/kaggle/working/supermix_kaggle_current`
- defines notebook config

Step 3

- materializes source code
- prefers attached `supermix-source`
- if missing, falls back to a GitHub source archive for `Supermix_29`
- installs dependencies

Step 4

- resolves training dataset files
- auto-discovers extra attached JSONL datasets
- optionally builds a SQLite manifest if enabled

Step 5

- downloads or validates the pinned base model snapshot
- builds the Qwen training command
- applies profile overrides and GPU-specific ceilings
- auto-disables distillation if teacher assets are missing
- auto-seeds warm-start if checkpoint artifacts are attached

Step 6

- launches training
- default launch mode is `background`
- writes PID and state files under `/kaggle/working/supermix_kaggle_current`

Step 7

- reattaches to the run
- shows launch PID/running state
- shows GPU utilization and memory
- tails the current log
- shows recent checkpoints
- can package a resume bundle if enabled

Step 8

- creates a zip bundle of outputs/logs/state under `/kaggle/working`
- useful before saving a Kaggle version or exporting to a later session

## Background mode

The current notebook defaults to:

- `LAUNCH_MODE = 'background'`

This matters because:

- the notebook kernel remains usable after launch
- Step 5 can inspect the log while training runs
- you do not need to keep one giant streaming cell open

If the notebook says training is already running with a PID, use Step 5 instead of launching again.

## How to monitor status

Use the notebook’s Step 5 cell.

That cell shows:

- latest checkpoint path
- launch PID
- whether the PID is still running
- GPU utilization
- GPU memory
- log tail
- cache files
- optional resume bundle output

Practical interpretation:

- green session dot means the session is alive, not necessarily that training is progressing
- `GPU > 0%` is a good sign that model work is active
- `GPU 0%` with active logs can still mean CPU-side preprocessing is still happening

## Where files are written

Main Kaggle working root:

- `/kaggle/working/supermix_kaggle_current`

Important subpaths:

- logs: `/kaggle/working/supermix_kaggle_current/logs`
- artifacts: `/kaggle/working/supermix_kaggle_current/artifacts`
- base model cache: `/kaggle/working/supermix_kaggle_current/base_models`
- launch state: `/kaggle/working/supermix_kaggle_current/last_training_launch_current.json`
- PID file: `/kaggle/working/supermix_kaggle_current/train_process.pid`

The current main output directory is:

- `/kaggle/working/supermix_kaggle_current/artifacts/qwen_supermix_enhanced_v28_kaggle_current`

## Resume flow

There are two resume paths:

1. Same live Kaggle session

   - the trainer resumes from the latest checkpoint in `OUTPUT_DIR`
   - rerun the config cell, then rerun the launch cell if needed

2. New Kaggle session

   - export the bundle or save a Kaggle version
   - turn the saved artifact into a new warm-start dataset
   - attach it as `supermix-warm-start`
   - rerun the notebook from the top

If `supermix-warm-start` is attached and valid, the notebook seeds the writable working warm-start directory automatically.

## Closing the browser tab

If training was launched in `background` mode, closing the browser tab usually does not stop the training by itself.

Usually safe:

- closing the tab
- leaving Kaggle and reopening the notebook later

Usually stops training:

- stopping the Kaggle session
- restarting the session/kernel
- Kaggle reclaiming the runtime

When returning later:

- reopen the same notebook
- reconnect to the existing session if it still exists
- run the Step 5 status cell

Do not start a fresh session immediately unless the previous one is clearly gone.

## Extra training datasets

The notebook can now auto-discover extra attached JSONL training datasets.

How it behaves:

- it always requires the six base `conversation_data...jsonl` files
- it can include extra attached training `.jsonl` files automatically
- in `balanced_quality_t4` and `fast_free_t4`, extra datasets are budgeted so runtime does not explode just because you attached more files

This means you can expand coverage without blindly scaling runtime linearly.

## Current quality-oriented changes

The current Kaggle default uses research-aligned quality controls rather than just bigger budgets.

Notable current behavior:

- `balanced_quality_t4` now uses coverage-aware SFT selection
- it also uses coverage-aware preference-pair selection
- true SFT packing stays enabled
- preference stays bounded instead of open-ended
- distillation stays light and automatically disables if teacher files are missing
- GPU overrides now use ceilings for memory-sensitive knobs instead of clobbering the profile

## Troubleshooting

### Input shows in the sidebar but the runtime cannot find it

Use the config output at the top of the notebook, not the Kaggle sidebar, as the source of truth.

The notebook now prints:

- `MOUNTED_INPUTS`
- resolved source/training/teacher/warm-start input dirs

If the runtime mount name differs from the dataset card name, the notebook should still resolve it by contents.

### Source bootstrap tries Git and fails on Git LFS

Preferred fix:

- attach `supermix-source`

Fallback behavior:

- the notebook now prefers a GitHub source archive fallback instead of sparse-checkout against LFS-heavy repo paths

### Hugging Face download is slow or rate-limited

Use a Kaggle Secret named:

- `HF_TOKEN`

The notebook auto-loads it and sets:

- `HF_TOKEN`
- `HF_HUB_TOKEN`
- `HUGGING_FACE_HUB_TOKEN`

### Teacher distillation is not active

If the notebook says teacher assets were not found, that means the required files were not discovered in the attached teacher input.

In that case:

- training still runs
- distillation is disabled automatically

### Warm start is not active

If the notebook says no warm-start artifact was found:

- training still runs
- it starts from the base model with fresh LoRA adapters

### GPU stays at 0%

Possible reasons:

- dataset prep is still running on CPU
- the run has stalled before actual model training
- you are checking too soon after launch

Check:

- Step 5 log tail
- whether checkpoints appear
- whether GPU usage increases after `[train] fine-tuning Qwen with LoRA...`

### Kaggle says another mount/unmount operation is in progress

That is Kaggle session state, not a notebook bug.

Do this:

- wait 1 to 3 minutes
- refresh once
- retry the attachment

If it keeps happening:

- stop the session
- refresh
- start a fresh session
- reattach inputs and secrets before rerunning

### The notebook says training is already running

That means `LAUNCH_MODE = 'background'` already launched a process and the PID file still points to a live process.

Use Step 5 to inspect status instead of relaunching.

If you really want to replace it:

- set `FORCE_RESTART = True`
- rerun the launch cell

### Optional browser-side auto-scroll helper

If you want a lightweight browser-side helper that only scrolls the Kaggle tab and does not move your mouse or block the rest of the computer, use:

- `output/kaggle-tab-autoscroll.js`

How to use it:

1. Open the Kaggle notebook tab.
2. Open DevTools console.
3. Paste the contents of `output/kaggle-tab-autoscroll.js`.
4. Press Enter.

How to stop it:

- run `window.__supermixKaggleAutoScrollStop?.();` in the same tab

Important:

- it only scrolls the page
- it pauses briefly after manual interaction in that tab
- it is a convenience hack, not a supported or reliable way to prevent Kaggle idle/session reclaim

### How to estimate ETA

Kaggle does not automatically give a trustworthy full ETA for this pipeline.

Use:

- Step 5 log tail
- checkpoint frequency
- GPU activity

ETA becomes more meaningful once the run is printing actual train-step logs instead of only data-prep logs.

## Best practice for free tier

Use this workflow:

1. fresh import of the latest notebook from `Supermix_29`
2. attach existing inputs
3. add `HF_TOKEN`
4. leave `TRAIN_PROFILE = 'balanced_quality_t4'`
5. run from the top
6. monitor with Step 5
7. package or save outputs before the session expires
8. feed the exported artifact back in as `supermix-warm-start` for the next run

## If you want local parity

Kaggle can stay close to local on trainer path and architecture, but not everything is identical:

- session duration is different
- storage is ephemeral
- cloud runtime limits are different
- free-tier throughput is lower than an unconstrained long local run

So the right goal on Kaggle is:

- same core training system
- better quality-per-session
- reliable resume flow

not:

- pretending a free T4 is the same as an unconstrained long local workstation run
