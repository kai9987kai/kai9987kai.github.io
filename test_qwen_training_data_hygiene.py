import os
import sys


sys.path.append(os.path.join(os.getcwd(), "source"))

from qwen_supermix_pipeline import (
    ChatPair,
    _clean_training_text,
    _is_synthetic_template_prompt,
    apply_supermix_distillation,
    filter_eval_pairs,
    filter_sft_training_pairs,
)


class _FakeTeacher:
    def __init__(self, mapping):
        self.mapping = dict(mapping)

    def generate_candidates(self, user_text, temperatures):
        return list(self.mapping.get(user_text, []))


def test_is_synthetic_template_prompt_catches_set_token_framing():
    user = "Present the against argument for climate policy under a debug-set5 debate framing."
    assert _is_synthetic_template_prompt(user)


def test_clean_training_text_strips_synthetic_assistant_scaffolding():
    text = (
        "Start with a scientist frame for clarity: "
        "The against case rests on several pillars. "
        "This variant adds strategic-set4 reflection and comparison."
    )
    cleaned = _clean_training_text(text, is_user=False).lower()
    assert "scientist frame for clarity" not in cleaned
    assert "this variant adds" not in cleaned
    assert "strategic-set4" not in cleaned
    assert cleaned.startswith("the against case rests on several pillars.")


def test_filter_sft_training_pairs_can_drop_synthetic_prompts():
    pairs = [
        ChatPair(
            user="Present the against argument for climate policy under a debug-set5 debate framing.",
            assistant="The against case rests on several pillars.",
            source="dataset",
        )
    ]
    for idx in range(8):
        pairs.append(
            ChatPair(
                user=f"Explain why the sky is blue in example {idx}.",
                assistant="The sky appears blue because air molecules scatter shorter blue wavelengths more strongly.",
                source="dataset",
            )
        )
    kept = filter_sft_training_pairs(
        pairs,
        min_quality_score=-1e9,
        keep_short_answer_prompts=True,
        drop_synthetic_prompts=True,
        min_keep_pairs=8,
    )
    assert len(kept) == 8
    assert all("debug-set5" not in pair.user for pair in kept)


def test_filter_eval_pairs_removes_synthetic_and_low_quality_entries():
    pairs = [
        ChatPair(
            user="Present the against argument for climate policy under a debug-set5 debate framing.",
            assistant="The against case rests on several pillars.",
            source="dataset",
        ),
        ChatPair(
            user="Explain why leaves are green.",
            assistant="ok",
            source="dataset",
        ),
    ]
    for idx in range(8):
        pairs.append(
            ChatPair(
                user=f"Explain why the sky is blue in example {idx}.",
                assistant="The sky appears blue because air molecules scatter shorter blue wavelengths more strongly.",
                source="dataset",
            )
        )
    kept = filter_eval_pairs(
        pairs,
        min_quality_score=0.0,
        drop_synthetic_prompts=True,
        min_keep_pairs=8,
    )
    assert len(kept) == 8
    assert all("debug-set5" not in pair.user for pair in kept)
    assert all(pair.assistant != "ok" for pair in kept)


def test_apply_supermix_distillation_requires_meaningful_gain():
    pair = ChatPair(
        user="Explain why the sky is blue.",
        assistant="Blue light scatters in the atmosphere.",
        source="dataset",
    )
    teacher = _FakeTeacher(
        {
            pair.user: [
                "The sky looks blue because air molecules scatter shorter blue wavelengths more strongly than longer red wavelengths."
            ]
        }
    )
    mixed_strict, generated_strict = apply_supermix_distillation(
        train_pairs=[pair],
        teacher=teacher,
        ratio=1.0,
        max_teacher_samples=1,
        seed=7,
        min_quality_score=0.0,
        min_quality_gain=5.0,
        skip_synthetic_prompts=False,
        log_every=0,
        best_of=1,
    )
    mixed_relaxed, generated_relaxed = apply_supermix_distillation(
        train_pairs=[pair],
        teacher=teacher,
        ratio=1.0,
        max_teacher_samples=1,
        seed=7,
        min_quality_score=0.0,
        min_quality_gain=0.05,
        skip_synthetic_prompts=False,
        log_every=0,
        best_of=1,
    )
    assert generated_strict == 0
    assert len(mixed_strict) == 1
    assert generated_relaxed == 1
    assert len(mixed_relaxed) == 2
    assert any(p.source == "supermix_teacher" for p in mixed_relaxed)


if __name__ == "__main__":
    tests = [
        test_is_synthetic_template_prompt_catches_set_token_framing,
        test_clean_training_text_strips_synthetic_assistant_scaffolding,
        test_filter_sft_training_pairs_can_drop_synthetic_prompts,
        test_filter_eval_pairs_removes_synthetic_and_low_quality_entries,
        test_apply_supermix_distillation_requires_meaningful_gain,
    ]
    for test in tests:
        print(f"Running {test.__name__}...")
        test()
    print("All qwen training data hygiene tests passed.")
