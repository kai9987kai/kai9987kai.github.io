import argparse
import json
import random
from pathlib import Path
from typing import Dict, List, Tuple


SCIENCE_FACTS: List[Dict[str, str]] = [
    # Scientific method / lab
    {"concept": "observation", "domain": "scientific_method", "definition": "information gathered using senses or tools", "example": "recording that a plant grew 2 cm in a week", "contrast": "inference", "contrast_note": "an observation is directly measured or seen, while an inference is an interpretation"},
    {"concept": "hypothesis", "domain": "scientific_method", "definition": "a testable explanation for an observation", "example": "plants grow faster with more light", "contrast": "theory", "contrast_note": "a hypothesis is a proposed explanation to test, while a theory is a broad explanation supported by extensive evidence"},
    {"concept": "variable", "domain": "scientific_method", "definition": "a factor that can change in an experiment", "example": "amount of sunlight", "contrast": "constant", "contrast_note": "a variable changes, while a constant is kept the same"},
    {"concept": "control group", "domain": "scientific_method", "definition": "the group in an experiment that does not receive the tested change", "example": "plants given plain water while another group gets fertilizer", "contrast": "experimental group", "contrast_note": "the control group is the baseline for comparison"},
    {"concept": "independent variable", "domain": "scientific_method", "definition": "the variable the experimenter changes on purpose", "example": "temperature setting in a heating test", "contrast": "dependent variable", "contrast_note": "the independent variable is changed and the dependent variable is measured"},
    {"concept": "dependent variable", "domain": "scientific_method", "definition": "the variable that is measured as a result", "example": "how long the ice takes to melt", "contrast": "independent variable", "contrast_note": "the dependent variable responds to the independent variable"},
    {"concept": "peer review", "domain": "scientific_method", "definition": "evaluation of scientific work by other experts before publication", "example": "scientists checking methods and conclusions in a submitted paper", "contrast": "advertising", "contrast_note": "peer review checks evidence and methods rather than promoting a claim"},
    {"concept": "SI unit", "domain": "measurement", "definition": "a standard metric unit used in science", "example": "meter, kilogram, second", "contrast": "nonstandard unit", "contrast_note": "SI units allow consistent measurements across experiments"},
    {"concept": "lab safety goggles", "domain": "lab_safety", "definition": "protective eyewear used to shield the eyes during experiments", "example": "wearing goggles while heating chemicals", "contrast": "regular glasses", "contrast_note": "regular glasses are not designed to fully protect against splashes"},
    # Physics
    {"concept": "force", "domain": "physics", "definition": "a push or pull that can change motion", "example": "pushing a box across the floor", "contrast": "mass", "contrast_note": "force changes motion, while mass measures amount of matter"},
    {"concept": "gravity", "domain": "physics", "definition": "the force that pulls objects toward one another", "example": "an apple falling toward Earth", "contrast": "magnetism", "contrast_note": "gravity acts on mass, while magnetism acts on magnetic materials and moving charges"},
    {"concept": "friction", "domain": "physics", "definition": "a force that opposes motion between surfaces", "example": "bike brakes slowing a wheel", "contrast": "thrust", "contrast_note": "friction resists motion, while thrust pushes an object forward"},
    {"concept": "speed", "domain": "physics", "definition": "distance traveled per unit time", "example": "60 kilometers per hour", "contrast": "acceleration", "contrast_note": "speed describes how fast, while acceleration describes change in speed or direction"},
    {"concept": "acceleration", "domain": "physics", "definition": "the rate of change of velocity", "example": "a car increasing from 20 to 40 km/h", "contrast": "constant speed", "contrast_note": "acceleration means velocity changes over time"},
    {"concept": "energy", "domain": "physics", "definition": "the ability to do work or cause change", "example": "stored chemical energy in a battery", "contrast": "power", "contrast_note": "energy is the capacity to do work, while power is the rate of using energy"},
    {"concept": "kinetic energy", "domain": "physics", "definition": "energy an object has because it is moving", "example": "a rolling ball", "contrast": "potential energy", "contrast_note": "kinetic energy depends on motion while potential energy is stored due to position or condition"},
    {"concept": "potential energy", "domain": "physics", "definition": "stored energy due to position or condition", "example": "a book on a high shelf", "contrast": "kinetic energy", "contrast_note": "potential energy is stored and can convert into kinetic energy"},
    {"concept": "electric current", "domain": "physics", "definition": "flow of electric charge", "example": "charges moving through a wire in a closed circuit", "contrast": "voltage", "contrast_note": "current is charge flow, while voltage is electrical potential difference"},
    {"concept": "voltage", "domain": "physics", "definition": "electric potential difference that pushes charge through a circuit", "example": "a 9-volt battery", "contrast": "current", "contrast_note": "voltage provides the push and current is the resulting flow"},
    {"concept": "series circuit", "domain": "physics", "definition": "a circuit with one path for current", "example": "two bulbs connected in a single loop", "contrast": "parallel circuit", "contrast_note": "series circuits have one path, while parallel circuits have multiple paths"},
    {"concept": "parallel circuit", "domain": "physics", "definition": "a circuit with multiple paths for current", "example": "household wiring", "contrast": "series circuit", "contrast_note": "parallel circuits allow devices to work independently"},
    {"concept": "wave", "domain": "physics", "definition": "a disturbance that transfers energy", "example": "light or sound waves", "contrast": "particle", "contrast_note": "a wave transfers energy through oscillation"},
    {"concept": "frequency", "domain": "physics", "definition": "how many wave cycles pass a point each second", "example": "a sound tone with higher pitch has higher frequency", "contrast": "wavelength", "contrast_note": "frequency counts cycles per second and wavelength measures distance between crests"},
    # Chemistry
    {"concept": "atom", "domain": "chemistry", "definition": "the smallest unit of an element that keeps its properties", "example": "a carbon atom", "contrast": "molecule", "contrast_note": "atoms can join to form molecules"},
    {"concept": "molecule", "domain": "chemistry", "definition": "two or more atoms chemically bonded", "example": "water (H2O)", "contrast": "atom", "contrast_note": "a molecule contains bonded atoms"},
    {"concept": "element", "domain": "chemistry", "definition": "a pure substance made of one type of atom", "example": "oxygen", "contrast": "compound", "contrast_note": "an element has one atom type while a compound has atoms of different elements bonded"},
    {"concept": "compound", "domain": "chemistry", "definition": "a substance formed when atoms of different elements bond", "example": "carbon dioxide", "contrast": "mixture", "contrast_note": "compounds are chemically bonded while mixtures are physically combined"},
    {"concept": "mixture", "domain": "chemistry", "definition": "a combination of substances not chemically bonded", "example": "salt water", "contrast": "compound", "contrast_note": "mixtures can often be separated by physical means"},
    {"concept": "physical change", "domain": "chemistry", "definition": "a change in form or state without creating a new substance", "example": "ice melting", "contrast": "chemical change", "contrast_note": "physical changes do not form a new substance"},
    {"concept": "chemical change", "domain": "chemistry", "definition": "a change that forms one or more new substances", "example": "iron rusting", "contrast": "physical change", "contrast_note": "chemical changes produce substances with new properties"},
    {"concept": "acid", "domain": "chemistry", "definition": "a substance that can donate hydrogen ions in solution", "example": "vinegar", "contrast": "base", "contrast_note": "acids and bases have different properties and react with each other"},
    {"concept": "base", "domain": "chemistry", "definition": "a substance that can accept hydrogen ions or release hydroxide ions in solution", "example": "baking soda solution", "contrast": "acid", "contrast_note": "bases often feel slippery and can neutralize acids"},
    {"concept": "density", "domain": "chemistry", "definition": "mass per unit volume", "example": "oil floating on water because it is less dense", "contrast": "weight", "contrast_note": "density compares mass and volume, while weight depends on gravity"},
    # Biology
    {"concept": "cell", "domain": "biology", "definition": "the basic unit of life", "example": "a skin cell", "contrast": "tissue", "contrast_note": "cells join to form tissues"},
    {"concept": "nucleus", "domain": "biology", "definition": "the cell structure that contains genetic material in many cells", "example": "the nucleus in a plant cell", "contrast": "cytoplasm", "contrast_note": "the nucleus stores DNA while cytoplasm fills the cell and holds organelles"},
    {"concept": "DNA", "domain": "biology", "definition": "the molecule that carries genetic instructions", "example": "DNA in chromosomes", "contrast": "protein", "contrast_note": "DNA stores genetic information while proteins perform many cell functions"},
    {"concept": "photosynthesis", "domain": "biology", "definition": "the process plants use to make food using light, carbon dioxide, and water", "example": "a green leaf making glucose in sunlight", "contrast": "cellular respiration", "contrast_note": "photosynthesis stores energy in food while respiration releases energy from food"},
    {"concept": "cellular respiration", "domain": "biology", "definition": "the process cells use to release energy from food", "example": "cells using glucose to make usable energy", "contrast": "photosynthesis", "contrast_note": "respiration releases energy for cell activities"},
    {"concept": "ecosystem", "domain": "biology", "definition": "a community of organisms and their physical environment", "example": "a pond ecosystem", "contrast": "population", "contrast_note": "an ecosystem includes many species and nonliving factors, while a population is one species"},
    {"concept": "food chain", "domain": "biology", "definition": "a sequence showing how energy moves through organisms by eating and being eaten", "example": "grass -> rabbit -> fox", "contrast": "food web", "contrast_note": "a food chain is one pathway, while a food web shows many pathways"},
    {"concept": "habitat", "domain": "biology", "definition": "the natural environment where an organism lives", "example": "a forest for many birds", "contrast": "niche", "contrast_note": "habitat is where it lives, while niche describes its role"},
    {"concept": "adaptation", "domain": "biology", "definition": "a trait that helps an organism survive and reproduce", "example": "thick fur in cold climates", "contrast": "acclimation", "contrast_note": "adaptations are inherited traits, while acclimation is an individual adjustment"},
    # Earth science / astronomy
    {"concept": "water cycle", "domain": "earth_science", "definition": "continuous movement of water through evaporation, condensation, and precipitation", "example": "rain falling after cloud formation", "contrast": "rock cycle", "contrast_note": "the water cycle describes water movement while the rock cycle describes rock changes"},
    {"concept": "weather", "domain": "earth_science", "definition": "short-term atmospheric conditions in a place", "example": "today's rain and wind", "contrast": "climate", "contrast_note": "weather is short-term and climate is long-term pattern"},
    {"concept": "climate", "domain": "earth_science", "definition": "long-term pattern of weather in a region", "example": "a desert climate is dry over many years", "contrast": "weather", "contrast_note": "climate averages weather over long time periods"},
    {"concept": "erosion", "domain": "earth_science", "definition": "movement of rock or soil by water, wind, ice, or gravity", "example": "a river carrying sediment downstream", "contrast": "weathering", "contrast_note": "weathering breaks material down and erosion moves it"},
    {"concept": "weathering", "domain": "earth_science", "definition": "breaking down of rocks at Earth's surface", "example": "rocks cracking after freezing and thawing", "contrast": "erosion", "contrast_note": "weathering breaks down material but does not necessarily move it"},
    {"concept": "rotation", "domain": "astronomy", "definition": "spinning of an object around its axis", "example": "Earth rotating once about every 24 hours", "contrast": "revolution", "contrast_note": "rotation causes day and night, while revolution is orbiting around another object"},
    {"concept": "revolution", "domain": "astronomy", "definition": "movement of one object around another", "example": "Earth revolving around the Sun", "contrast": "rotation", "contrast_note": "revolution contributes to the year"},
    {"concept": "planet", "domain": "astronomy", "definition": "a large body that orbits a star and does not produce its own light by fusion", "example": "Earth", "contrast": "star", "contrast_note": "planets orbit stars, while stars generate energy by fusion"},
    {"concept": "star", "domain": "astronomy", "definition": "a hot glowing sphere of gas producing energy by nuclear fusion", "example": "the Sun", "contrast": "planet", "contrast_note": "stars emit their own light while planets mostly reflect light"},
    {"concept": "moon phase", "domain": "astronomy", "definition": "the apparent shape of the Moon's lit portion as seen from Earth", "example": "crescent moon", "contrast": "eclipse", "contrast_note": "moon phases are due to changing viewing angles of sunlight, not Earth's shadow"},
]


QUESTION_FRAMES = [
    "Explain the science concept \"{concept}\" in simple terms.",
    "What is {concept} in basic science?",
    "Give a beginner-friendly definition of {concept}.",
]

EXAMPLE_FRAMES = [
    "Give one real-world example of {concept}.",
    "What is an example of {concept}?",
    "Name a simple example that shows {concept}.",
]

COMPARE_FRAMES = [
    "What is the difference between {concept} and {contrast}?",
    "Compare {concept} vs {contrast} in one short explanation.",
    "How is {concept} different from {contrast}?",
]

TEACHER_FRAMES = [
    "Teach {concept} to a middle-school student in 2-3 sentences.",
    "Explain {concept} like I am a beginner and include one example.",
]

QUIZ_FRAMES = [
    "Quick science quiz: define {concept} and give one example.",
    "Study check: what does {concept} mean, and what is one example?",
]

TRUE_FALSE_FRAMES = [
    "Is this statement true or false? \"{statement}\" If false, correct it.",
]


def _clean(text: str) -> str:
    return " ".join(str(text).split()).strip()


def _make_truth_statement(fact: Dict[str, str], rng: random.Random) -> Tuple[str, str]:
    concept = fact["concept"]
    definition = fact["definition"]
    contrast = fact["contrast"]
    contrast_note = fact["contrast_note"]
    if rng.random() < 0.5:
        statement = f"{concept.capitalize()} means {definition}."
        answer = "True. " + statement
    else:
        statement = f"{concept.capitalize()} is the same as {contrast}."
        answer = f"False. {contrast_note.capitalize()}."
    return statement, answer


def _answer_for_task(fact: Dict[str, str], task: str, rng: random.Random) -> str:
    concept = fact["concept"]
    definition = fact["definition"]
    example = fact["example"]
    contrast = fact["contrast"]
    contrast_note = fact["contrast_note"]
    if task == "define":
        prefixes = ["Definition:", "Answer:", "Simple explanation:", ""]
        prefix = rng.choice(prefixes)
        out = f"{concept.capitalize()} is {definition}."
        return _clean((prefix + " " + out).strip())
    if task == "example":
        return _clean(f"Example: {example}.")
    if task == "compare":
        return _clean(f"{concept.capitalize()} and {contrast} are different: {contrast_note}.")
    if task == "teach":
        return _clean(
            f"{concept.capitalize()} is {definition}. "
            f"A simple example is {example}. "
            f"This helps explain how the concept works in science."
        )
    if task == "quiz":
        return _clean(f"{concept.capitalize()} means {definition}. One example is {example}.")
    if task == "true_false":
        statement, answer = _make_truth_statement(fact, rng)
        return _clean(answer)
    return _clean(f"{concept.capitalize()} is {definition}. Example: {example}.")


def _make_row(fact: Dict[str, str], rng: random.Random) -> Dict[str, str]:
    concept = fact["concept"]
    contrast = fact["contrast"]
    task = rng.choices(
        ["define", "example", "compare", "teach", "quiz", "true_false"],
        weights=[28, 16, 18, 16, 12, 10],
        k=1,
    )[0]
    if task == "define":
        user = rng.choice(QUESTION_FRAMES).format(concept=concept)
    elif task == "example":
        user = rng.choice(EXAMPLE_FRAMES).format(concept=concept)
    elif task == "compare":
        user = rng.choice(COMPARE_FRAMES).format(concept=concept, contrast=contrast)
    elif task == "teach":
        user = rng.choice(TEACHER_FRAMES).format(concept=concept)
    elif task == "quiz":
        user = rng.choice(QUIZ_FRAMES).format(concept=concept)
    else:
        statement, _ = _make_truth_statement(fact, rng)
        user = rng.choice(TRUE_FALSE_FRAMES).format(statement=statement)

    if rng.random() < 0.09:
        user = "Please explain clearly. " + user
    elif rng.random() < 0.07:
        user = "Quick question: " + user

    assistant = _answer_for_task(fact, task, rng)
    if rng.random() < 0.08 and task in {"teach", "compare"}:
        assistant = "Recommended answer: " + assistant

    return {
        "user": _clean(user),
        "assistant": _clean(assistant),
        "topic": "science_essentials",
        "domain": fact["domain"],
        "concept": concept,
        "task": task,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Build a synthetic essential science knowledge conversation dataset.")
    ap.add_argument("--output", default="conversation_data.science_essentials_v1.jsonl")
    ap.add_argument("--target", type=int, default=1000000)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--progress_every", type=int, default=250000)
    args = ap.parse_args()

    rng = random.Random(int(args.seed))
    facts = list(SCIENCE_FACTS)
    if not facts:
        raise RuntimeError("No science facts configured.")

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    domain_counts: Dict[str, int] = {}
    task_counts: Dict[str, int] = {}
    target = max(1, int(args.target))
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
