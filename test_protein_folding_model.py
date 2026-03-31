from __future__ import annotations

import os
import sys

import torch

sys.path.append(os.path.join(os.getcwd(), "source"))

from protein_folding_model import (
    PROTEIN_CONCEPT_LABELS,
    ProteinFoldingMiniNet,
    build_vocab,
    choose_answer_variant,
    encode_text,
    encode_words,
    heuristic_protein_concept,
    looks_like_protein_folding_prompt,
)
from train_protein_folding_model import build_rows, split_rows


def test_protein_prompt_detection_and_heuristics():
    prompt = "Why does pLDDT matter in protein structure prediction?"
    assert looks_like_protein_folding_prompt(prompt)
    assert heuristic_protein_concept(prompt) == "alphafold_confidence"


def test_protein_rows_cover_all_concepts():
    rows, summary, answer_bank = build_rows(seed=11)
    concepts = {row.concept for row in rows}
    assert concepts == set(PROTEIN_CONCEPT_LABELS)
    assert summary["source_rows"] == len(rows)
    assert all(answer_bank.get(label) for label in PROTEIN_CONCEPT_LABELS)


def test_protein_split_keeps_validation_coverage():
    rows, _summary, _answer_bank = build_rows(seed=19)
    train_rows, val_rows = split_rows(rows, seed=23)
    assert train_rows
    assert val_rows
    assert {row.concept for row in val_rows} == set(PROTEIN_CONCEPT_LABELS)


def test_protein_network_builds_and_runs():
    prompts = [
        "Explain hydrophobic collapse in protein folding.",
        "How are RMSD and TM-score different for protein models?",
    ]
    vocab = build_vocab(prompts)
    char_ids = torch.tensor([encode_text(prompt, vocab, 96) for prompt in prompts], dtype=torch.long)
    word_ids = torch.tensor([encode_words(prompt, word_buckets=128, max_words=16) for prompt in prompts], dtype=torch.long)
    model = ProteinFoldingMiniNet(
        vocab_size=len(vocab),
        num_concepts=len(PROTEIN_CONCEPT_LABELS),
        char_embed_dim=16,
        conv_channels=24,
        word_buckets=128,
        word_embed_dim=12,
        hidden_dim=32,
    )
    outputs = model(char_ids, word_ids)
    assert outputs.shape == (2, len(PROTEIN_CONCEPT_LABELS))


def test_variant_selection_tracks_prompt_style():
    assert choose_answer_variant("Give a concise benchmark-style answer about hydrophobic collapse.") == "concise_answer"
    assert choose_answer_variant("Why does this matter for protein structure prediction?") == "structure_prediction_link"
    assert choose_answer_variant("Correct this misconception about chaperones.") == "error_correction"


if __name__ == "__main__":
    tests = [
        test_protein_prompt_detection_and_heuristics,
        test_protein_rows_cover_all_concepts,
        test_protein_split_keeps_validation_coverage,
        test_protein_network_builds_and_runs,
        test_variant_selection_tracks_prompt_style,
    ]
    for test in tests:
        print(f"Running {test.__name__}...")
        test()
