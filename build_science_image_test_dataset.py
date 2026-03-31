import argparse
import json
import random
from pathlib import Path
from typing import Dict, List, Tuple

from PIL import Image, ImageDraw


CANVAS = (128, 128)


def _save(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path)


def _blank(bg=(255, 255, 255)) -> Image.Image:
    return Image.new("RGB", CANVAS, bg)


def _draw_cell(path: Path) -> Dict[str, str]:
    im = _blank((245, 252, 245))
    d = ImageDraw.Draw(im)
    d.ellipse((12, 12, 116, 116), fill=(160, 220, 160), outline=(40, 120, 40), width=3)
    d.ellipse((44, 44, 84, 84), fill=(110, 90, 180), outline=(60, 40, 120), width=3)
    for x, y in [(28, 30), (90, 34), (31, 87), (93, 90)]:
        d.ellipse((x, y, x + 10, y + 7), fill=(90, 160, 90))
    _save(im, path)
    return {"concept": "cell", "caption": "simple cell diagram with a large circular cell and a central nucleus", "tags": "biology,cell,nucleus,diagram,green,purple"}


def _draw_magnet(path: Path) -> Dict[str, str]:
    im = _blank((252, 252, 252))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((20, 20, 108, 108), radius=20, outline=(60, 60, 60), width=4)
    d.rectangle((20, 20, 64, 108), fill=(220, 60, 60))
    d.rectangle((64, 20, 108, 108), fill=(70, 110, 220))
    d.rectangle((36, 36, 92, 92), fill=(252, 252, 252))
    d.text((30, 8), "N", fill=(120, 0, 0))
    d.text((92, 8), "S", fill=(0, 0, 120))
    _save(im, path)
    return {"concept": "magnet", "caption": "horseshoe magnet diagram with red and blue poles labeled N and S", "tags": "physics,magnet,magnetism,north,south,red,blue"}


def _draw_circuit(path: Path) -> Dict[str, str]:
    im = _blank((255, 255, 248))
    d = ImageDraw.Draw(im)
    d.line((18, 64, 42, 64), fill=(50, 50, 50), width=3)
    d.line((42, 50, 42, 78), fill=(50, 50, 50), width=3)
    d.line((49, 42, 49, 86), fill=(50, 50, 50), width=3)
    d.line((49, 64, 92, 64), fill=(50, 50, 50), width=3)
    d.ellipse((90, 46, 122, 78), outline=(240, 180, 30), width=4)
    d.line((106, 78, 106, 112), fill=(50, 50, 50), width=3)
    d.line((106, 112, 18, 112), fill=(50, 50, 50), width=3)
    d.line((18, 112, 18, 64), fill=(50, 50, 50), width=3)
    d.line((98, 38, 114, 30), fill=(240, 180, 30), width=2)
    d.line((106, 34, 106, 20), fill=(240, 180, 30), width=2)
    d.line((114, 38, 122, 30), fill=(240, 180, 30), width=2)
    _save(im, path)
    return {"concept": "circuit", "caption": "simple circuit diagram with a battery and a bulb connected in one loop", "tags": "physics,electricity,circuit,battery,bulb,series"}


def _draw_water_cycle(path: Path) -> Dict[str, str]:
    im = _blank((230, 245, 255))
    d = ImageDraw.Draw(im)
    d.ellipse((10, 90, 70, 124), fill=(70, 140, 230))
    d.ellipse((75, 15, 120, 42), fill=(245, 245, 245), outline=(180, 180, 180))
    d.ellipse((90, 22, 127, 47), fill=(245, 245, 245), outline=(180, 180, 180))
    d.ellipse((60, 26, 95, 50), fill=(245, 245, 245), outline=(180, 180, 180))
    for x in [72, 84, 96, 108]:
        d.line((x, 54, x - 4, 74), fill=(60, 120, 220), width=2)
    d.polygon([(32, 82), (44, 64), (54, 82)], fill=(250, 210, 70), outline=(220, 170, 40))
    d.arc((18, 38, 78, 98), start=250, end=340, fill=(80, 160, 90), width=3)
    d.arc((42, 42, 102, 102), start=70, end=150, fill=(80, 160, 90), width=3)
    _save(im, path)
    return {"concept": "water cycle", "caption": "water cycle icon with water, sun, cloud, rain, and curved arrows", "tags": "earth_science,water_cycle,evaporation,condensation,precipitation"}


def _draw_moon_phases(path: Path) -> Dict[str, str]:
    im = _blank((20, 22, 40))
    d = ImageDraw.Draw(im)
    centers = [16, 40, 64, 88, 112]
    for i, cx in enumerate(centers):
        d.ellipse((cx - 10, 54, cx + 10, 74), fill=(225, 225, 215))
        if i == 0:
            d.ellipse((cx - 10, 54, cx + 8, 74), fill=(20, 22, 40))
        elif i == 1:
            d.ellipse((cx - 6, 54, cx + 6, 74), fill=(20, 22, 40))
        elif i == 3:
            d.ellipse((cx - 6, 54, cx + 10, 74), fill=(20, 22, 40))
        elif i == 4:
            d.ellipse((cx - 8, 54, cx + 10, 74), fill=(20, 22, 40))
    _save(im, path)
    return {"concept": "moon phases", "caption": "moon phases strip with several moons showing different illuminated shapes", "tags": "astronomy,moon,phases,crescent,full_moon"}


def _draw_plant_photosynthesis(path: Path) -> Dict[str, str]:
    im = _blank((240, 250, 235))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 96, 128, 128), fill=(150, 110, 70))
    d.line((64, 96, 64, 48), fill=(60, 140, 60), width=5)
    d.ellipse((44, 46, 70, 66), fill=(70, 170, 70), outline=(40, 120, 40))
    d.ellipse((60, 42, 90, 64), fill=(70, 170, 70), outline=(40, 120, 40))
    d.ellipse((34, 62, 60, 84), fill=(70, 170, 70), outline=(40, 120, 40))
    d.ellipse((68, 60, 96, 84), fill=(70, 170, 70), outline=(40, 120, 40))
    d.ellipse((10, 10, 34, 34), fill=(250, 220, 60), outline=(240, 180, 20))
    for y in [18, 26, 34]:
        d.line((36, y, 58, y + 10), fill=(240, 190, 60), width=2)
    _save(im, path)
    return {"concept": "photosynthesis", "caption": "plant diagram with green leaves, sunlight, and soil", "tags": "biology,plant,photosynthesis,leaf,sunlight"}


def _draw_solar_system(path: Path) -> Dict[str, str]:
    im = _blank((15, 15, 25))
    d = ImageDraw.Draw(im)
    d.ellipse((8, 52, 28, 72), fill=(250, 200, 70))
    d.ellipse((36, 56, 44, 64), fill=(160, 160, 170))
    d.ellipse((56, 54, 68, 66), fill=(80, 150, 230))
    d.ellipse((82, 50, 98, 66), fill=(210, 140, 90))
    d.ellipse((108, 48, 126, 66), fill=(220, 210, 160))
    d.arc((102, 44, 130, 72), 15, 180, fill=(210, 210, 190), width=1)
    _save(im, path)
    return {"concept": "solar system", "caption": "simple solar system sketch with sun and several planets", "tags": "astronomy,solar_system,sun,planet,space"}


def _draw_dna(path: Path) -> Dict[str, str]:
    im = _blank((250, 248, 255))
    d = ImageDraw.Draw(im)
    d.line((38, 20, 46, 108), fill=(110, 70, 180), width=3)
    d.line((90, 20, 82, 108), fill=(70, 140, 220), width=3)
    for i, y in enumerate(range(24, 108, 12)):
        x1 = 40 + (i % 2) * 4
        x2 = 88 - (i % 2) * 4
        d.line((x1, y, x2, y + 6), fill=(160, 120, 200), width=2)
    _save(im, path)
    return {"concept": "DNA", "caption": "stylized DNA ladder with two curved strands and connecting rungs", "tags": "biology,dna,genetics,helix,diagram"}


def _draw_thermometer(path: Path) -> Dict[str, str]:
    im = _blank((248, 250, 255))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((58, 18, 70, 96), radius=6, outline=(80, 80, 90), width=2)
    d.ellipse((48, 86, 80, 118), fill=(220, 60, 60), outline=(140, 40, 40), width=2)
    d.rectangle((61, 40, 67, 94), fill=(220, 60, 60))
    for y in range(24, 88, 10):
        d.line((74, y, 88, y), fill=(70, 70, 70), width=1)
    _save(im, path)
    return {"concept": "temperature", "caption": "thermometer icon with red liquid column", "tags": "science,measurement,temperature,thermometer"}


def _draw_states_of_matter(path: Path) -> Dict[str, str]:
    im = _blank((255, 255, 255))
    d = ImageDraw.Draw(im)
    panels = [(4, 20, 40, 108), (44, 20, 84, 108), (88, 20, 124, 108)]
    for rect in panels:
        d.rectangle(rect, outline=(60, 60, 60), width=2)
    # solid: dense grid
    for x in range(10, 35, 8):
        for y in range(28, 60, 8):
            d.ellipse((x, y, x + 4, y + 4), fill=(90, 140, 220))
    # liquid: clustered lower
    for x, y in [(50, 78), (57, 72), (64, 82), (72, 76), (76, 84), (60, 88), (68, 90)]:
        d.ellipse((x, y, x + 5, y + 5), fill=(70, 180, 170))
    # gas: spread out
    for x, y in [(95, 30), (110, 44), (99, 62), (116, 76), (103, 94)]:
        d.ellipse((x, y, x + 5, y + 5), fill=(230, 130, 90))
    _save(im, path)
    return {"concept": "states of matter", "caption": "three-panel particle diagram showing solid, liquid, and gas particle spacing", "tags": "chemistry,matter,solid,liquid,gas,particles"}


def _draw_prism_light(path: Path) -> Dict[str, str]:
    im = _blank((250, 250, 252))
    d = ImageDraw.Draw(im)
    d.polygon([(56, 30), (42, 96), (92, 84)], fill=(235, 245, 255), outline=(90, 120, 180))
    d.line((8, 62, 46, 62), fill=(220, 220, 220), width=4)
    colors = [(220, 60, 60), (240, 150, 40), (230, 220, 50), (70, 180, 90), (80, 130, 230)]
    for i, c in enumerate(colors):
        d.line((72, 66, 118, 54 + i * 8), fill=c, width=2)
    _save(im, path)
    return {"concept": "light dispersion", "caption": "prism diagram splitting a beam of light into several colors", "tags": "physics,light,prism,dispersion,spectrum"}


DRAWERS = [
    ("cell_diagram", _draw_cell),
    ("magnet_poles", _draw_magnet),
    ("simple_circuit", _draw_circuit),
    ("water_cycle_icon", _draw_water_cycle),
    ("moon_phases_strip", _draw_moon_phases),
    ("plant_photosynthesis", _draw_plant_photosynthesis),
    ("solar_system_sketch", _draw_solar_system),
    ("dna_ladder", _draw_dna),
    ("thermometer_icon", _draw_thermometer),
    ("states_of_matter_particles", _draw_states_of_matter),
    ("prism_dispersion", _draw_prism_light),
]


def _rows_for_image(image_path: str, meta: Dict[str, str], rng: random.Random) -> List[Dict[str, str]]:
    concept = meta["concept"]
    caption = meta["caption"]
    tags = meta["tags"]
    rows: List[Dict[str, str]] = []
    qa_templates: List[Tuple[str, str, str]] = [
        (
            "Describe the science idea shown in this image.",
            f"This image appears to show {concept}. {caption.capitalize()}.",
            "describe_concept",
        ),
        (
            "What science concept best matches this picture?",
            f"The best match is {concept}.",
            "identify_concept",
        ),
        (
            "Give a short explanation of the concept in this image for a beginner.",
            f"This image represents {concept}. In simple terms, it shows a basic visual model of {concept} used for science learning.",
            "beginner_explain",
        ),
        (
            "List a few visual clues from the image that support your answer.",
            f"Visual clues: {caption}.",
            "visual_clues",
        ),
    ]

    # Add concept-specific rows.
    if concept == "cell":
        qa_templates.append(("What part of the cell is highlighted in the center?", "The center region represents the nucleus.", "cell_part"))
    if concept == "magnet":
        qa_templates.append(("What do the red and blue ends represent?", "They represent opposite magnetic poles (north and south).", "magnet_poles"))
    if concept == "circuit":
        qa_templates.append(("Is this more like a series circuit or a parallel circuit?", "It looks like a simple series circuit because it shows one loop path.", "circuit_type"))
    if concept == "water cycle":
        qa_templates.append(("Name two processes shown in this water cycle image.", "Possible processes shown are evaporation, condensation, and precipitation.", "water_cycle_processes"))
    if concept == "moon phases":
        qa_templates.append(("What does this image teach about the Moon?", "It shows that the Moon appears in different phases depending on the visible lit portion.", "moon_phases"))
    if concept == "photosynthesis":
        qa_templates.append(("What energy source is shown for the plant?", "Sunlight is shown as the energy source for photosynthesis.", "photosynthesis_energy"))
    if concept == "states of matter":
        qa_templates.append(("What do the particle patterns suggest about solids, liquids, and gases?", "They suggest solids have tightly packed particles, liquids are close but can move, and gases are far apart.", "particle_model"))
    if concept == "light dispersion":
        qa_templates.append(("What happens to light in this diagram?", "A beam of light passes through a prism and spreads into multiple colors.", "dispersion"))

    for user_prompt, answer, task in qa_templates:
        rows.append(
            {
                "user": user_prompt,
                "assistant": answer,
                "image_path": image_path,
                "image_caption": caption,
                "image_tags": tags,
                "topic": "science_image_tests",
                "concept": concept,
                "task": task,
            }
        )
        if rng.random() < 0.35:
            rows.append(
                {
                    "user": "Please answer briefly: " + user_prompt,
                    "assistant": answer,
                    "image_path": image_path,
                    "image_caption": caption,
                    "image_tags": tags,
                    "topic": "science_image_tests",
                    "concept": concept,
                    "task": task + "_brief",
                }
            )
    return rows


def main() -> None:
    ap = argparse.ArgumentParser(description="Generate a small science image QA dataset with local test images.")
    ap.add_argument("--output", default="conversation_data.science_image_tests_v1.jsonl")
    ap.add_argument("--images_dir", default="science_test_images")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--repeats", type=int, default=1, help="How many augmented QA passes to generate per image.")
    args = ap.parse_args()

    rng = random.Random(int(args.seed))
    images_dir = Path(args.images_dir)
    out_rows: List[Dict[str, str]] = []
    repeats = max(1, int(args.repeats))
    for name, fn in DRAWERS:
        img_path = images_dir / f"{name}.png"
        meta = fn(img_path)
        for ridx in range(repeats):
            rows = _rows_for_image(str(img_path), meta, rng)
            for row in rows:
                if repeats > 1:
                    row["variant_pass"] = ridx
                    if rng.random() < 0.30:
                        row["user"] = "Look at the image and answer: " + row["user"]
                    elif rng.random() < 0.20:
                        row["user"] = "Image question: " + row["user"]
                out_rows.append(row)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        for row in out_rows:
            f.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")

    print(f"Images: {len(DRAWERS)}")
    print(f"Rows: {len(out_rows)}")
    print(f"Repeats: {repeats}")
    print(f"Images dir: {images_dir}")
    print(f"Wrote: {out_path}")


if __name__ == "__main__":
    main()
