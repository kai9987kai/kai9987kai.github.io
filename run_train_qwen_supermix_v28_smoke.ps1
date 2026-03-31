param(
    [string]$BaseModel = "Qwen/Qwen2.5-0.5B-Instruct",
    [string]$OutputDir = "artifacts\qwen_supermix_enhanced_v28_improvements_smoke",
    [string]$Device = "auto",
    [string]$ResumeWarmStartDir = "artifacts\qwen_supermix_enhanced_v26_full",
    [string[]]$ExtraArgs = @()
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$repoRoot = (Resolve-Path $PSScriptRoot).Path
Set-Location $repoRoot

$env:HF_HUB_OFFLINE = "1"
$env:TRANSFORMERS_OFFLINE = "1"
$env:PYTHONUNBUFFERED = "1"

function Get-PythonCommand {
    if ($env:SUPERMIX_PYTHON -and (Test-Path $env:SUPERMIX_PYTHON)) {
        return (Resolve-Path $env:SUPERMIX_PYTHON).Path
    }
    foreach ($candidate in @(
        (Join-Path $repoRoot ".venv-dml\Scripts\python.exe"),
        (Join-Path $repoRoot ".venv\Scripts\python.exe")
    )) {
        if (Test-Path $candidate) {
            return (Resolve-Path $candidate).Path
        }
    }
    $cmd = Get-Command python -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }
    return "python"
}

function Get-LatestAdapterCheckpoint([string]$RunDir) {
    if (-not (Test-Path $RunDir)) {
        return $null
    }
    $latestFile = Join-Path $RunDir "latest_adapter_checkpoint.txt"
    if (Test-Path $latestFile) {
        $checkpointDir = (Get-Content $latestFile -Raw).Trim()
        if ($checkpointDir) {
            $candidatePaths = @($checkpointDir)
            if (-not [System.IO.Path]::IsPathRooted($checkpointDir)) {
                $candidatePaths += (Join-Path (Get-Location).Path $checkpointDir)
                $candidatePaths += (Join-Path $RunDir $checkpointDir)
            }
            foreach ($candidate in $candidatePaths) {
                if (Test-Path $candidate) {
                    return (Resolve-Path $candidate).Path
                }
            }
        }
    }
    $checkpointMeta = Get-ChildItem -Path (Join-Path $RunDir "checkpoints") -Recurse -Filter checkpoint_meta.json -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if ($checkpointMeta) {
        $adapterDir = Join-Path (Split-Path $checkpointMeta.FullName -Parent) "adapter"
        if (Test-Path $adapterDir) {
            return (Resolve-Path $adapterDir).Path
        }
    }
    return $null
}

$logicalCpu = [Math]::Max(1, [Environment]::ProcessorCount)
$interopCpu = [Math]::Max(1, [Math]::Min(4, [Math]::Floor($logicalCpu / 2)))

$argsList = @(
    "source\qwen_supermix_pipeline.py",
    "--data", "datasets\conversation_data.quality_anchor_v2.jsonl", "datasets\conversation_data.coding_knowledge_2026_02_19.jsonl", "datasets\conversation_data.world_events_2026_02_19.jsonl", "datasets\conversation_data.supermix_plus_v27_500k.jsonl", "datasets\conversation_data.mega_reasoning_creative_v25_75582.jsonl", "datasets\conversation_data.mega_creative_250k_v2.jsonl",
    "--base_model", $BaseModel,
    "--output_dir", $OutputDir,
    "--max_records", "100",
    "--max_source_fraction", "0.52",
    "--max_synthetic_fraction", "0.06",
    "--max_prompt_signature_count", "4",
    "--data_log_every_records", "2000",
    "--prompt_signature_cap_exempt_sources", "conversation_data.quality_anchor_v2.jsonl,conversation_data.mega_reasoning_creative_v25_75582.jsonl",
    "--eval_size", "10",
    "--eval_min_quality_score", "1.05",
    "--eval_drop_synthetic_prompts",
    "--max_length", "448",
    "--batch_size", "1",
    "--grad_accum_steps", "2",
    "--epochs", "1",
    "--max_steps", "10",
    "--lr", "1.0e-5",
    "--sft_lr_schedule", "cosine_restarts",
    "--sft_lr_restart_period", "4",
    "--sft_warmup_steps", "2",
    "--sft_min_lr_ratio", "0.22",
    "--sft_max_grad_norm", "0.9",
    "--sft_focal_gamma", "1.5",
    "--sft_eval_every_steps", "5",
    "--sft_early_stop_patience", "3",
    "--sft_curriculum_quality_ramp", "0.2",
    "--sft_grad_noise_eta", "0.01",
    "--train_log_every_steps", "1",
    "--save_every_steps", "0",
    "--weight_decay", "0.02",
    "--lora_r", "32",
    "--lora_alpha", "64",
    "--lora_dropout", "0.03",
    "--use_rslora",
    "--use_dora",
    "--lora_init", "pissa_niter_4",
    "--lora_plus_ratio", "16",
    "--neftune_noise_alpha", "5.0",
    "--sft_weight_mode", "quality",
    "--sft_min_weight", "0.62",
    "--sft_max_weight", "1.88",
    "--sft_synthetic_prompt_weight", "0.62",
    "--sft_teacher_source_weight", "0.92",
    "--sft_quality_anchor_boost", "1.14",
    "--sft_coding_boost", "1.24",
    "--sft_events_boost", "1.08",
    "--sft_reasoning_boost", "1.28",
    "--sft_prompt_skill_boost", "1.17",
    "--sft_conversation_boost", "1.24",
    "--sft_creativity_boost", "1.16",
    "--sft_knowledge_density_boost", "1.18",
    "--sft_rdrop_alpha", "0.05",
    "--sft_length_bucketed_batches",
    "--sft_length_bucket_window_mult", "12",
    "--sft_min_quality_score", "0.98",
    "--sft_quality_filter_exempt_sources", "conversation_data.quality_anchor_v2.jsonl,conversation_data.world_events_2026_02_19.jsonl",
    "--sft_drop_synthetic_prompts",
    "--sft_auto_balance_sources",
    "--sft_source_balance_strength", "0.66",
    "--sft_source_balance_max_scale", "1.95",
    "--preference_objective", "ipo",
    "--preference_steps", "10",
    "--preference_rescore_every", "4",
    "--preference_pairs", "34000",
    "--preference_candidate_count", "3",
    "--preference_reject_similarity_min", "0.16",
    "--preference_beta", "1.9",
    "--preference_beta_end", "3.6",
    "--preference_margin", "0.00",
    "--preference_margin_end", "0.00",
    "--preference_label_smoothing", "0.03",
    "--preference_sft_weight", "0.32",
    "--preference_length_weight", "0.08",
    "--preference_hardness_gamma", "1.15",
    "--preference_robust_alpha", "0.30",
    "--preference_robust_eta", "0.08",
    "--preference_robust_clip", "2.5",
    "--preference_wpo_alpha", "0.35",
    "--preference_wpo_clip", "2.5",
    "--preference_reference_anchor_weight", "0.04",
    "--preference_reference_anchor_batch_size", "2",
    "--preference_short_reject_boost", "0.75",
    "--preference_long_reject_boost", "0.25",
    "--preference_min_chosen_quality", "0.92",
    "--preference_min_chosen_words", "8",
    "--preference_min_quality_gap", "0.05",
    "--preference_allow_template_prompts",
    "--preference_max_pairs_per_user", "2",
    "--preference_max_pairs_per_source", "360",
    "--preference_mining_mode", "auto",
    "--preference_mining_progress_every", "30",
    "--preference_mining_max_seconds", "4500",
    "--preference_mining_max_attempt_factor", "20",
    "--preference_coding_focus_boost", "1.30",
    "--preference_reasoning_focus_boost", "1.32",
    "--preference_counterfactual_rejects_per_prompt", "4",
    "--preference_selection_strategy", "innovation_mix",
    "--preference_selection_keep_ratio", "0.58",
    "--preference_selection_min_keep", "160",
    "--preference_selection_max_keep", "220",
    "--preference_selection_hardness_target", "0.46",
    "--preference_selection_hardness_bandwidth", "0.22",
    "--preference_length_bucketed_batches",
    "--preference_length_bucket_window_mult", "12",
    "--preference_lr", "1.4e-5",
    "--preference_lr_schedule", "cosine",
    "--preference_warmup_steps", "18",
    "--preference_min_lr_ratio", "0.30",
    "--preference_max_grad_norm", "0.9",
    "--preference_max_new_tokens", "112",
    "--preference_prompt_max_tokens", "352",
    "--supermix_distill_ratio", "0.14",
    "--supermix_distill_max", "10",
    "--supermix_distill_best_of", "1",
    "--supermix_distill_log_every", "2",
    "--supermix_distill_max_seconds", "12000",
    "--supermix_distill_min_quality", "0.93",
    "--supermix_distill_min_gain", "0.18",
    "--supermix_distill_density_bias", "0.16",
    "--seed", "48",
    "--device", $Device,
    "--device_preference", "cuda,npu,xpu,mps,cpu,dml",
    "--model_dtype", "auto",
    "--gradient_checkpointing",
    "--torch_num_threads", "$logicalCpu",
    "--torch_interop_threads", "$interopCpu",
    "--skip_benchmark"
)

$resumeCheckpoint = Get-LatestAdapterCheckpoint -RunDir $OutputDir
if ($resumeCheckpoint) {
    Write-Host "Resuming from latest checkpoint in $OutputDir"
    $argsList += "--resume_from_latest_checkpoint"
}
else {
    $warmStartCheckpoint = Get-LatestAdapterCheckpoint -RunDir $ResumeWarmStartDir
    if ($warmStartCheckpoint) {
        Write-Host "Warm-starting from checkpoint in $ResumeWarmStartDir"
        $argsList += @("--init_adapter_dir", $warmStartCheckpoint, "--init_adapter_match_lora")
    }
}

if ($ExtraArgs.Count -gt 0) {
    $extraArgsList = @(
        $ExtraArgs |
            Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } |
            ForEach-Object { [string]$_ }
    )
    if ($extraArgsList.Count -gt 0) {
        Write-Host "Applying extra training args: $($extraArgsList -join ' ')"
        $argsList += $extraArgsList
    }
}

& (Get-PythonCommand) -u @argsList
