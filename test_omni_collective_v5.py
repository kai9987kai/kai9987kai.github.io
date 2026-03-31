from source.omni_collective_v5_model import _prompt_variants, _task_focus
from source.train_omni_collective_v5 import _coding_delta_rows_v5, _openscad_rows_v5, _prompt_understanding_rows_v5


def test_task_focus_detects_openscad():
    assert _task_focus("Write an OpenSCAD module for a phone stand.") == "openscad"


def test_prompt_variants_include_domain_specific_hint():
    variants = _prompt_variants("Write an OpenSCAD example for a hollow box.", "difference(){ cube([1,1,1]); }")
    assert any("OpenSCAD request" in item for item in variants)
    assert len(variants) >= 4


def test_v5_delta_row_builders_have_expected_domains():
    coding_rows = _coding_delta_rows_v5()
    openscad_rows = _openscad_rows_v5()
    prompt_rows = _prompt_understanding_rows_v5()
    assert coding_rows and all(row.domain == "coding" for row in coding_rows)
    assert openscad_rows and all(row.domain == "coding" for row in openscad_rows)
    assert prompt_rows and any(row.domain == "planning" for row in prompt_rows)
