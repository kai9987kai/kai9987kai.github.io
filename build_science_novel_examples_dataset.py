import argparse
import json
import random
from pathlib import Path
from typing import Dict, List

from build_science_knowledge_dataset import SCIENCE_FACTS


def _clean(text: str) -> str:
    return " ".join(str(text or "").split()).strip()


ANALOGY_FRAMES = [
    "Give a creative analogy for {concept} that a beginner can understand.",
    "Explain {concept} with a vivid metaphor and a real example.",
    "Use an analogy to teach {concept} in simple language.",
]

STORY_FRAMES = [
    "Write a short science mini-scene that demonstrates {concept}.",
    "Give a 3-4 sentence story example that shows {concept} in action.",
    "Create a small real-life narrative that helps explain {concept}.",
]

DIALOGUE_FRAMES = [
    "Write a short teacher-student dialogue explaining {concept}.",
    "Create a brief Q&A conversation that teaches {concept} clearly.",
]

MISCONCEPTION_FRAMES = [
    "A student says: \"{misbelief}\" Correct this and explain {concept}.",
    "Fix this misconception about {concept}: \"{misbelief}\"",
]

COMPARE_STORY_FRAMES = [
    "Use a short story to explain the difference between {concept} and {contrast}.",
    "Teach {concept} vs {contrast} with one concrete scenario.",
]


def _misbelief(fact: Dict[str, str], rng: random.Random) -> str:
    concept = fact["concept"]
    contrast = fact["contrast"]
    if rng.random() < 0.5:
        return f"{concept} is basically the same as {contrast}"
    return f"{concept} has no effect in real life"


def _analogy_answer(fact: Dict[str, str], rng: random.Random) -> str:
    concept = fact["concept"]
    definition = fact["definition"]
    example = fact["example"]
    contrast = fact["contrast"]
    analogy_bank = [
        f"Think of {concept} like a tool that helps us understand {definition}.",
        f"You can picture {concept} as a simple pattern in everyday life: {definition}.",
        f"{concept.capitalize()} is like a clue in a mystery: it points to what is happening in a system.",
    ]
    out = rng.choice(analogy_bank)
    out += f" For example, {example}. "
    out += f"It is not the same as {contrast}; {fact['contrast_note']}."
    return _clean(out)


def _story_answer(fact: Dict[str, str], rng: random.Random) -> str:
    concept = fact["concept"]
    definition = fact["definition"]
    example = fact["example"]
    domain = fact["domain"].replace("_", " ")
    openers = [
        "During a class experiment,",
        "On a walk outside,",
        "In a small lab demonstration,",
        "While doing homework,",
    ]
    learner = rng.choice(["a student", "Maya", "Jordan", "the class"])
    text = (
        f"{rng.choice(openers)} {learner} noticed something important. "
        f"The moment showed {concept}: {definition}. "
        f"A clear example is {example}. "
        f"That is why this idea matters in {domain}."
    )
    return _clean(text)


def _dialogue_answer(fact: Dict[str, str], rng: random.Random) -> str:
    concept = fact["concept"]
    definition = fact["definition"]
    example = fact["example"]
    return _clean(
        f"Student: What is {concept}? "
        f"Teacher: {concept.capitalize()} is {definition}. "
        f"Student: Can you give an example? "
        f"Teacher: Sure—{example}."
    )


def _misconception_answer(fact: Dict[str, str], rng: random.Random) -> str:
    concept = fact["concept"]
    definition = fact["definition"]
    example = fact["example"]
    contrast_note = fact["contrast_note"]
    return _clean(
        f"That statement is incorrect. {concept.capitalize()} is {definition}. "
        f"{contrast_note.capitalize()}. "
        f"A good example is {example}."
    )


def _compare_story_answer(fact: Dict[str, str], rng: random.Random) -> str:
    concept = fact["concept"]
    contrast = fact["contrast"]
    contrast_note = fact["contrast_note"]
    example = fact["example"]
    return _clean(
        f"In a simple scenario, {example}. "
        f"This helps show {concept} rather than {contrast}. "
        f"{contrast_note.capitalize()}."
    )


def _make_row(fact: Dict[str, str], rng: random.Random) -> Dict[str, str]:
    task = rng.choices(
        ["analogy", "story", "dialogue", "misconception", "compare_story"],
        weights=[24, 30, 18, 16, 12],
        k=1,
    )[0]
    if task == "analogy":
        user = rng.choice(ANALOGY_FRAMES).format(concept=fact["concept"])
        assistant = _analogy_answer(fact, rng)
    elif task == "story":
        user = rng.choice(STORY_FRAMES).format(concept=fact["concept"])
        assistant = _story_answer(fact, rng)
    elif task == "dialogue":
        user = rng.choice(DIALOGUE_FRAMES).format(concept=fact["concept"])
        assistant = _dialogue_answer(fact, rng)
    elif task == "misconception":
        mis = _misbelief(fact, rng)
        user = rng.choice(MISCONCEPTION_FRAMES).format(concept=fact["concept"], misbelief=mis)
        assistant = _misconception_answer(fact, rng)
    else:
        user = rng.choice(COMPARE_STORY_FRAMES).format(concept=fact["concept"], contrast=fact["contrast"])
        assistant = _compare_story_answer(fact, rng)

    if rng.random() < 0.08:
        user = _clean("Be vivid but accurate. " + user)
    elif rng.random() < 0.06:
        user = _clean("Make it easy for a middle-school student. " + user)

    return {
        "user": _clean(user),
        "assistant": _clean(assistant),
        "topic": "science_novel_examples",
        "domain": fact["domain"],
        "concept": fact["concept"],
        "task": task,
        "style": "novel_example",
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Build a science dataset with richer narrative/analogy/novel-style examples.")
    ap.add_argument("--output", default="conversation_data.science_novel_examples_v1.jsonl")
    ap.add_argument("--target", type=int, default=2000000)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--progress_every", type=int, default=250000)
    args = ap.parse_args()

    rng = random.Random(int(args.seed))
    facts: List[Dict[str, str]] = list(SCIENCE_FACTS)
    if not facts:
        raise RuntimeError("No science facts configured.")

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    target = max(1, int(args.target))
    domain_counts: Dict[str, int] = {}
    task_counts: Dict[str, int] = {}
    with out_path.open("w", encoding="utf-8") as f:
        for i in range(target):
            fact = rng.choice(facts)
            row = _make_row(fact, rng)
            f.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
            domain = str(row.get("domain", ""))
            task = str(row.get("task", ""))
            domain_counts[domain] = domain_counts.get(domain, 0) + 1
            task_counts[task] = task_counts.get(task, 0) + 1
            if args.progress_every > 0 and (i + 1) % int(args.progress_every) == 0:
                print(f"Wrote {i + 1}/{target}")

    print(f"Concepts: {len(facts)}")
    print(f"Output rows: {target}")
    print("Domains:", ", ".join(f"{k}={v}" for k, v in sorted(domain_counts.items())))
    print("Tasks:", ", ".join(f"{k}={v}" for k, v in sorted(task_counts.items())))
    print(f"Wrote: {out_path}")


if __name__ == "__main__":
    main()
