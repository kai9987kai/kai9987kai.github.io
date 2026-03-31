import argparse
import json
import random
import re
from pathlib import Path
from typing import Any, List, Sequence, Tuple

from chat_pipeline import load_conversation_examples
from expand_conversation_data import (
    blend_pairs,
    extract_last_user,
    mutate_assistant,
    mutate_user,
    normalize_spaces,
    sanitize_pair,
)


LOW_VALUE_PATTERNS = (
    re.compile(r"^\s*(i do not know|i don't know|not sure)\b", re.I),
    re.compile(r"^\s*(cannot help|can't help)\b", re.I),
    re.compile(r"\b(as an ai language model)\b", re.I),
)
PROGRAMMING_HINT_PATTERNS = (
    re.compile(r"```"),
    re.compile(r"`[^`]+`"),
    re.compile(
        r"\b(python|javascript|typescript|java|c\+\+|c#|rust|go|sql|html|css|bash|powershell|regex|docker|kubernetes|api|json|yaml|xml|git|pip|npm|pytest|traceback|stack trace|exception|segfault|nullpointer|keyerror|indexerror)\b",
        re.I,
    ),
    re.compile(r"\b(def|class|import|from|return|async|await|lambda|function|const|let|var|SELECT|INSERT|UPDATE|DELETE)\b"),
    re.compile(r"[A-Za-z_][A-Za-z0-9_]*\("),
    re.compile(r"==|!=|<=|>=|=>|->|::|&&|\|\|"),
)
PROGRAMMING_KEYWORDS = {
    "python",
    "javascript",
    "typescript",
    "java",
    "c++",
    "c#",
    "rust",
    "go",
    "sql",
    "bash",
    "powershell",
    "regex",
    "docker",
    "kubernetes",
    "git",
    "pip",
    "npm",
    "pytest",
    "traceback",
    "exception",
    "function",
    "method",
    "class",
    "module",
    "package",
    "import",
    "return",
    "variable",
    "loop",
    "array",
    "list",
    "dict",
    "object",
    "database",
    "query",
    "schema",
    "migration",
    "json",
    "yaml",
    "api",
    "endpoint",
    "debug",
    "compile",
    "runtime",
}


def _tokenize(text: str) -> List[str]:
    return re.findall(r"[A-Za-z0-9_']+", text.lower())


def _programming_signal_score(user: str, assistant: str) -> float:
    text = f"{user}\n{assistant}"
    score = 0.0
    for pat in PROGRAMMING_HINT_PATTERNS:
        if pat.search(text):
            score += 1.0
    toks = _tokenize(text)
    if toks:
        keyword_hits = sum(1 for tok in toks if tok in PROGRAMMING_KEYWORDS)
        score += min(4.0, 0.5 * keyword_hits)
        symbol_hits = len(re.findall(r"[{}()\[\];<>/\\\\=*:+-]", text))
        if symbol_hits >= 6:
            score += min(2.0, symbol_hits / 20.0)
    return score


def _is_programming_pair(user: str, assistant: str, min_signal: float = 1.5) -> bool:
    return _programming_signal_score(user, assistant) >= float(min_signal)


def _repetition_ratio(text: str) -> float:
    toks = _tokenize(text)
    if not toks:
        return 1.0
    unique = len(set(toks))
    return 1.0 - float(unique) / float(max(1, len(toks)))


def _is_high_quality_pair(
    user: str,
    assistant: str,
    min_user_chars: int,
    min_assistant_chars: int,
    max_repeat_ratio: float,
) -> bool:
    user = normalize_spaces(user)
    assistant = normalize_spaces(assistant)
    if len(user) < int(min_user_chars):
        return False
    if len(assistant) < int(min_assistant_chars):
        return False
    if len(_tokenize(assistant)) < 3:
        return False
    if _repetition_ratio(assistant) > float(max_repeat_ratio):
        return False
    if re.search(r"(.)\1{7,}", assistant):
        return False
    for pat in LOW_VALUE_PATTERNS:
        if pat.search(assistant):
            return False
    return True


def _load_pairs_from_jsonl(
    path: str,
    min_user_chars: int,
    min_assistant_chars: int,
    max_repeat_ratio: float,
) -> List[Tuple[str, str]]:
    out: List[Tuple[str, str]] = []
    examples = load_conversation_examples(path)
    for ex in examples:
        user = extract_last_user(ex.context)
        assistant = ex.response.strip()
        user, assistant = sanitize_pair(user, assistant)
        if _is_high_quality_pair(
            user,
            assistant,
            min_user_chars=min_user_chars,
            min_assistant_chars=min_assistant_chars,
            max_repeat_ratio=max_repeat_ratio,
        ):
            out.append((user, assistant))
    return out


def _write_jsonl(path: str, rows: Sequence[Tuple[str, str]]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        for user, assistant in rows:
            f.write(json.dumps({"user": user, "assistant": assistant}, ensure_ascii=False) + "\n")


def _load_manifest_inputs(path: str) -> List[str]:
    with open(path, "r", encoding="utf-8") as f:
        payload: Any = json.load(f)

    out: List[str] = []
    if isinstance(payload, dict):
        shards = payload.get("shards", [])
        if isinstance(shards, list):
            for item in shards:
                if isinstance(item, dict) and item.get("path"):
                    out.append(str(item["path"]))
                elif isinstance(item, str):
                    out.append(str(item))
    elif isinstance(payload, list):
        for item in payload:
            if isinstance(item, dict) and item.get("path"):
                out.append(str(item["path"]))
            elif isinstance(item, str):
                out.append(str(item))
    return out


def _resolve_input_paths(inputs: Sequence[str], input_manifests: Sequence[str]) -> List[str]:
    out: List[str] = []
    seen = set()

    def add_path(p: str) -> None:
        key = str(Path(p))
        if key in seen:
            return
        seen.add(key)
        out.append(str(p))

    for p in inputs:
        if p:
            add_path(str(p))
    for manifest_path in input_manifests:
        if not manifest_path:
            continue
        for shard_path in _load_manifest_inputs(str(manifest_path)):
            add_path(shard_path)
    return out


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Build a larger merged chat dataset from multiple JSONL sources with dedupe and filtering."
    )
    ap.add_argument(
        "--inputs",
        nargs="*",
        default=[],
        help="Input JSONL files. Supports flat user/assistant pairs and messages format.",
    )
    ap.add_argument(
        "--inputs_manifest",
        nargs="*",
        default=[],
        help="Optional manifest JSON(s) with `shards[].path` entries to expand into input JSONLs.",
    )
    ap.add_argument("--output", default="conversation_data.super_v1.jsonl", help="Output JSONL file.")
    ap.add_argument("--target", type=int, default=220000, help="Target number of examples.")
    ap.add_argument("--creative_prob", type=float, default=0.30, help="Creative augmentation probability.")
    ap.add_argument("--blend_prob", type=float, default=0.20, help="Blend-two-examples augmentation probability.")
    ap.add_argument(
        "--programming_boost_factor",
        type=float,
        default=1.0,
        help="Boost sampling odds for programming-like examples (>1 increases code coverage).",
    )
    ap.add_argument(
        "--programming_min_signal",
        type=float,
        default=1.5,
        help="Programming detection threshold used for code-focused sampling.",
    )
    ap.add_argument(
        "--programming_creative_scale",
        type=float,
        default=0.60,
        help="Scale creative augmentation on programming examples (keeps code more syntactically stable).",
    )
    ap.add_argument(
        "--programming_same_domain_blend_prob",
        type=float,
        default=0.75,
        help="When blending a programming example, probability to blend with another programming example.",
    )
    ap.add_argument("--allow_duplicates", action="store_true", help="Allow duplicates in final output.")
    ap.add_argument("--min_user_chars", type=int, default=4, help="Minimum user-text characters.")
    ap.add_argument("--min_assistant_chars", type=int, default=12, help="Minimum assistant-text characters.")
    ap.add_argument(
        "--max_repeat_ratio",
        type=float,
        default=0.78,
        help="Maximum allowed token repetition ratio in assistant text.",
    )
    ap.add_argument(
        "--max_rows_per_input",
        type=int,
        default=0,
        help="Optional cap per input file after filtering (0 = no cap). Useful for very large shards.",
    )
    ap.add_argument(
        "--skip_missing_inputs",
        action="store_true",
        help="Skip missing input files instead of failing.",
    )
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    rng = random.Random(int(args.seed))
    input_paths = _resolve_input_paths(args.inputs, args.inputs_manifest)
    if not input_paths:
        raise RuntimeError("No inputs resolved. Provide --inputs and/or --inputs_manifest.")

    source_pairs: List[Tuple[str, str]] = []
    max_rows_per_input = max(0, int(args.max_rows_per_input))
    for input_path in input_paths:
        if not Path(input_path).exists():
            if args.skip_missing_inputs:
                print(f"Skipping missing input: {input_path}")
                continue
            raise FileNotFoundError(f"Input not found: {input_path}")
        rows = _load_pairs_from_jsonl(
            input_path,
            min_user_chars=int(args.min_user_chars),
            min_assistant_chars=int(args.min_assistant_chars),
            max_repeat_ratio=float(args.max_repeat_ratio),
        )
        if max_rows_per_input > 0 and len(rows) > max_rows_per_input:
            rows = rng.sample(rows, k=max_rows_per_input)
            print(f"Capped {input_path} to {len(rows)} rows after filtering")
        source_pairs.extend(rows)
        print(f"Loaded {len(rows)} high-quality pairs from {input_path}")

    if not source_pairs:
        raise RuntimeError("No usable pairs found in inputs after filtering.")

    prog_min_signal = float(args.programming_min_signal)
    programming_pairs = [
        pair for pair in source_pairs if _is_programming_pair(pair[0], pair[1], min_signal=prog_min_signal)
    ]
    if programming_pairs:
        prog_keys = {(u, a) for (u, a) in programming_pairs}
        non_programming_pairs = [pair for pair in source_pairs if pair not in prog_keys]
    else:
        non_programming_pairs = list(source_pairs)

    prog_ratio = float(len(programming_pairs)) / float(max(1, len(source_pairs)))
    boost = max(1.0, float(args.programming_boost_factor))
    if programming_pairs and non_programming_pairs:
        effective_prog_ratio = min(
            0.97,
            (prog_ratio * boost) / max(1e-9, (prog_ratio * boost) + (1.0 - prog_ratio)),
        )
    elif programming_pairs:
        effective_prog_ratio = 1.0
    else:
        effective_prog_ratio = 0.0

    rows: List[Tuple[str, str]] = []
    seen = set()
    track_seen = not bool(args.allow_duplicates)

    def sample_pair(prefer_programming: bool = False) -> Tuple[Tuple[str, str], bool]:
        if programming_pairs:
            if not non_programming_pairs:
                return rng.choice(programming_pairs), True
            use_prog = prefer_programming or (rng.random() < effective_prog_ratio)
            if use_prog:
                return rng.choice(programming_pairs), True
            return rng.choice(non_programming_pairs), False
        return rng.choice(source_pairs), False

    def maybe_add(user: str, assistant: str) -> bool:
        user, assistant = sanitize_pair(user, assistant)
        if not _is_high_quality_pair(
            user,
            assistant,
            min_user_chars=int(args.min_user_chars),
            min_assistant_chars=int(args.min_assistant_chars),
            max_repeat_ratio=float(args.max_repeat_ratio),
        ):
            return False

        key = (user.lower(), assistant.lower())
        if track_seen and key in seen:
            return False
        rows.append((user, assistant))
        if track_seen:
            seen.add(key)
        return True

    for user, assistant in source_pairs:
        maybe_add(user, assistant)

    target = max(int(args.target), len(rows))
    max_attempts = max(20000, target * 30)
    attempts = 0
    while len(rows) < target and attempts < max_attempts:
        attempts += 1
        if len(source_pairs) >= 2 and rng.random() < float(args.blend_prob):
            p1, p1_is_prog = sample_pair()
            prefer_prog_p2 = p1_is_prog and (rng.random() < float(args.programming_same_domain_blend_prob))
            p2, _ = sample_pair(prefer_programming=prefer_prog_p2)
            if p1 == p2:
                continue
            user, assistant = blend_pairs(p1, p2, rng)
        else:
            (user, assistant), is_prog = sample_pair()
            creative_prob = float(args.creative_prob) * (
                float(args.programming_creative_scale) if is_prog else 1.0
            )
            user = mutate_user(user, rng, creative_prob=creative_prob)
            assistant = mutate_assistant(assistant, rng, creative_prob=creative_prob)
        maybe_add(user, assistant)

    while len(rows) < target:
        (user, assistant), is_prog = sample_pair()
        creative_prob = float(args.creative_prob) * (
            float(args.programming_creative_scale) if is_prog else 1.0
        )
        user = mutate_user(user, rng, creative_prob=creative_prob)
        assistant = mutate_assistant(assistant, rng, creative_prob=creative_prob)
        user, assistant = sanitize_pair(user, assistant)
        rows.append((normalize_spaces(user), normalize_spaces(assistant)))

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    _write_jsonl(str(output_path), rows[:target])

    print(f"Source pairs (filtered): {len(source_pairs)}")
    print(f"Programming-like source pairs: {len(programming_pairs)} ({prog_ratio * 100:.2f}%)")
    print(f"Programming sampling ratio (effective): {effective_prog_ratio * 100:.2f}%")
    print(f"Unique tracked pairs: {len(seen) if track_seen else 0} (tracking {'on' if track_seen else 'off'})")
    print(f"Output examples: {target}")
    print(f"Resolved input files: {len(input_paths)}")
    print(f"Wrote: {output_path}")


if __name__ == "__main__":
    main()
