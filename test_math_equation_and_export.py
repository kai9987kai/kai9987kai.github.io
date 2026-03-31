from pathlib import Path

from PIL import Image

from source.chat_export import copy_generated_image, render_chat_transcript_image
from source.math_equation_model import extract_request_text, solve_intent


def test_math_solver_handles_wrapped_equation_prompt() -> None:
    wrapped = (
        "You are one consultant in a multimodel answer panel.\n"
        "Give a concise answer draft.\n\n"
        "Request:\nSolve 2*x + 4 = 10"
    )
    assert extract_request_text(wrapped) == "Solve 2*x + 4 = 10"
    solved = solve_intent(wrapped, "solve_equation")
    assert "x = 3" in solved["response"]


def test_chat_export_renders_png_and_copies_image(tmp_path: Path) -> None:
    source_image = tmp_path / "source.png"
    Image.new("RGB", (96, 96), "#336699").save(source_image)

    transcript = [
        {"role": "user", "kind": "text", "response": "Solve 2*x + 4 = 10", "model_label": "You"},
        {
            "role": "assistant",
            "kind": "image",
            "prompt_used": "blue square sample",
            "output_path": str(source_image),
            "model_label": "V36 Native Image",
        },
    ]

    rendered = render_chat_transcript_image(
        transcript,
        destination_hint=str(tmp_path / "chat_export.png"),
        default_dir=tmp_path / "exports",
        session_id="session-xyz",
    )
    assert rendered.exists()
    assert rendered.suffix.lower() == ".png"

    copied = copy_generated_image(str(source_image), str(tmp_path / "saved"), tmp_path / "fallback")
    assert copied.exists()
    assert copied.parent.name == "saved"
