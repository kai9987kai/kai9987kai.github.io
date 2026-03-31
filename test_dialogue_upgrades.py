import os
import sys


sys.path.append(os.path.join(os.getcwd(), "source"))

from chat_pipeline import build_context, featurize_text, pick_response, resolve_feature_mode, text_to_model_input
from qwen_supermix_pipeline import _followup_paraphrase_variants, _paired_response_score, _pairs_from_messages


def _cand(text: str, bucket_score: float = 0.5):
    vec = featurize_text(text).tolist()
    return {
        "text": text,
        "vec": vec,
        "ctx_vec": vec,
        "count": 1,
        "bucket_score": float(bucket_score),
    }


def smoke_test_dialogue_upgrades():
    messages = [
        {"role": "user", "content": "Explain gradient checkpointing."},
        {"role": "assistant", "content": "It trades extra compute for lower activation memory during backprop."},
        {"role": "user", "content": "Make it shorter."},
        {"role": "assistant", "content": "It saves memory by recomputing activations."},
    ]
    pairs = _pairs_from_messages(messages)
    assert len(pairs) == 2, f"Expected 2 message pairs, got {len(pairs)}"
    assert "User: Explain gradient checkpointing." in pairs[1].user, "Prior turn missing from preserved context"
    assert pairs[1].user.rstrip().endswith("User: Make it shorter."), "Latest turn missing from preserved context"

    followup_user = pairs[1].user
    good_answer = "It saves memory by recomputing activations."
    bad_answer = "Painting landscapes can be relaxing and expressive."
    good_score, _ = _paired_response_score(followup_user, good_answer)
    bad_score, _ = _paired_response_score(followup_user, bad_answer)
    assert good_score > bad_score, f"Expected aligned follow-up answer to score higher ({good_score} <= {bad_score})"

    recent = ["Gradient checkpointing trades extra compute for lower memory during training by recomputing activations during backpropagation."]
    shorter = pick_response(
        candidates=[
            _cand("Gradient checkpointing lowers memory use by recomputing activations.", 0.8),
            _cand("Creativity can help you imagine new ideas in writing.", 0.9),
        ],
        query_text="make it shorter",
        recent_assistant_messages=recent,
        response_temperature=0.0,
        style_mode="balanced",
        creativity=0.2,
    )
    assert len(shorter.split()) < len(recent[0].split()), f"Expected shorter follow-up rewrite, got: {shorter}"
    assert "checkpoint" in shorter.lower() or "memory" in shorter.lower(), f"Expected topic continuity, got: {shorter}"

    context = build_context(
        history=[("Explain gradient checkpointing.", recent[0])],
        user_text="Make it shorter and clearer.",
        max_turns=2,
    )
    assert resolve_feature_mode("context_v2", smarter_auto=True) == "context_mix_v3"
    assert "System: conversation_tags=followup,shorten,rewrite" in context, f"Expected explicit control tags, got: {context}"
    assert "System: topic_terms=" in context, f"Expected topic terms in context, got: {context}"
    smart_x = text_to_model_input(context, feature_mode="context_mix_v3")
    assert tuple(smart_x.shape) == (1, 1, 128), f"Unexpected smart context tensor shape: {tuple(smart_x.shape)}"
    assert float(smart_x.abs().sum().item()) > 0.0, "Expected non-zero smart context features"

    ambiguous_context = build_context(history=[], user_text="make it better", max_turns=0)
    assert "System: expected_act=clarify" in ambiguous_context, f"Expected clarify act, got: {ambiguous_context}"
    assert "System: ambiguity_tags=" in ambiguous_context, f"Expected ambiguity tags, got: {ambiguous_context}"

    deeper = pick_response(
        candidates=[
            _cand("It saves memory.", 0.7),
            _cand("It saves memory by recomputing activations during backpropagation, which increases compute.", 0.8),
        ],
        query_text="go deeper step by step",
        recent_assistant_messages=["It saves memory."],
        response_temperature=0.0,
        style_mode="balanced",
        creativity=0.0,
    )
    assert deeper.startswith("1) "), f"Expected reasoning refine pass to add structure, got: {deeper}"

    creative = pick_response(
        candidates=[
            _cand("Gradient checkpointing is like packing a lighter backpack and reloading supplies later.", 0.7),
            _cand("Gradient checkpointing saves memory.", 0.8),
        ],
        query_text="make it more creative",
        recent_assistant_messages=["Gradient checkpointing saves memory by recomputing activations later."],
        response_temperature=0.0,
        style_mode="balanced",
        creativity=0.9,
    )
    assert "Creative take:" in creative or "Think of it like" in creative, f"Expected creative refinement, got: {creative}"

    clarify = pick_response(
        candidates=[
            _cand("You should improve it by adding more detail.", 0.9),
            _cand("Creative answers often use vivid language.", 0.8),
        ],
        query_text="make it better",
        recent_assistant_messages=[],
        response_temperature=0.0,
        style_mode="balanced",
        creativity=0.0,
    )
    clarify_low = clarify.lower()
    assert "what" in clarify_low and (
        "text" in clarify_low or "topic" in clarify_low or "referring" in clarify_low
    ), f"Expected clarification question, got: {clarify}"

    clarify_score, _ = _paired_response_score(
        "make it better",
        "What are you referring to? Paste the text or topic you want improved.",
    )
    direct_score, _ = _paired_response_score(
        "make it better",
        "You should improve it by adding more detail and examples.",
    )
    assert clarify_score > direct_score, f"Expected clarification to outrank direct guess ({clarify_score} <= {direct_score})"

    paraphrases = _followup_paraphrase_variants(context, max_variants=2)
    assert paraphrases, "Expected follow-up paraphrase variants"
    assert any(p.rstrip().endswith("User: Give me a shorter version.") or p.rstrip().endswith("User: Can you make that more concise?") for p in paraphrases), (
        f"Expected paraphrased follow-up variants, got: {paraphrases}"
    )

    print("Dialogue upgrade smoke test PASSED!")


if __name__ == "__main__":
    smoke_test_dialogue_upgrades()
