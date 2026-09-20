#!/usr/bin/env node
/**
 * Reproducible headless run of the connectome benchmark.
 *
 * Every arm sees the same seed set, and comparisons are paired percentile
 * bootstrap intervals over seed-level differences. Writes a receipt including
 * source hashes so a recorded result can be tied to the code that produced it.
 *
 *   node scripts/connectome-benchmark.cjs
 *   node scripts/connectome-benchmark.cjs --seeds 1,2,3 --steps 200 \
 *     --arms Syncytium_16B_Legacy,Syncytium_16B --reference Syncytium_16B_Legacy \
 *     --output output/connectome.json --csv output/connectome.csv
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { ConnectomeBenchmarkRunner } = require("../src/connectome-benchmark.js");

function parseArgs(argv) {
  const options = {
    episodes: 10,
    steps: 150,
    seeds: null,
    arms: null,
    reference: null,
    output: null,
    csv: null,
    bootstrapSamples: 2000,
    bootstrapSeed: 20260912
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    const needsValue = () => {
      if (value === undefined) throw new Error(`${flag} needs a value`);
      i++;
      return value;
    };
    switch (flag) {
      case "--episodes": options.episodes = Number(needsValue()); break;
      case "--steps": options.steps = Number(needsValue()); break;
      case "--seeds": options.seeds = needsValue().split(",").map(s => Number(s.trim())); break;
      case "--arms": options.arms = needsValue().split(",").map(s => s.trim()).filter(Boolean); break;
      case "--reference": options.reference = needsValue(); break;
      case "--output": options.output = needsValue(); break;
      case "--csv": options.csv = needsValue(); break;
      case "--bootstrap-samples": options.bootstrapSamples = Number(needsValue()); break;
      case "--bootstrap-seed": options.bootstrapSeed = Number(needsValue()); break;
      case "--help":
      case "-h":
        console.log(fs.readFileSync(__filename, "utf8").split("*/")[0]);
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown flag: ${flag}`);
    }
  }
  if (!Number.isInteger(options.episodes) || options.episodes < 2) {
    throw new Error("--episodes must be an integer of at least 2; paired intervals need two seeds");
  }
  if (!Number.isInteger(options.steps) || options.steps < 1) {
    throw new Error("--steps must be a positive integer");
  }
  if (options.seeds) {
    for (const seed of options.seeds) {
      if (!Number.isInteger(seed) || seed < 1) throw new Error(`Invalid seed: ${seed}`);
    }
  }
  return options;
}

function hashSources() {
  const files = [
    "src/fly-brain-engine.js",
    "src/fly-lif-circuit.js",
    "src/connectome-benchmark.js",
    "scripts/connectome-benchmark.cjs"
  ];
  const hashes = {};
  for (const file of files) {
    const full = path.join(__dirname, "..", file);
    hashes[file] = crypto.createHash("sha256").update(fs.readFileSync(full)).digest("hex");
  }
  return hashes;
}

function toCSV(report) {
  const rows = [["arm", "seed", "netScore", "diamonds", "hazards", "stasis", "finalEnergy", "uniqueCells", "stepsSurvived"].join(",")];
  for (const arm of report.arms) {
    for (const episode of arm.raw) {
      rows.push([
        arm.arm, episode.seed, episode.netScore, episode.diamondsCollected,
        episode.hazardsHit, episode.stasisEvents, episode.finalEnergy,
        episode.uniqueCells, episode.stepsSurvived
      ].join(","));
    }
  }
  return `${rows.join("\n")}\n`;
}

function formatInterval(ci) {
  if (!ci) return "n/a";
  const sign = value => (value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2));
  return `[${sign(ci[0])}, ${sign(ci[1])}]`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const runner = new ConnectomeBenchmarkRunner();
  const started = Date.now();

  const report = await runner.runComparativeBenchmark({
    episodesPerArm: options.episodes,
    stepLimit: options.steps,
    seeds: options.seeds,
    arms: options.arms,
    reference: options.reference,
    bootstrapSamples: options.bootstrapSamples,
    bootstrapSeed: options.bootstrapSeed
  });

  report.runtimeMs = Date.now() - started;
  report.sourceHashes = hashSources();
  report.node = process.version;

  console.log(`\nConnectome benchmark — ${report.seeds.length} seeds x ${report.stepLimit} steps`);
  console.log(`seeds: ${report.seeds.join(", ")}\n`);
  const pad = (text, width) => String(text).padEnd(width);
  console.log([pad("arm", 22), pad("net", 9), pad("IQM", 9), pad("win%", 7), pad("diamonds", 10), pad("hazards", 9), "cells"].join(""));
  for (const arm of report.arms) {
    console.log([
      pad(arm.arm, 22), pad(arm.meanNetScore, 9), pad(arm.iqmNetScore, 9),
      pad(arm.winRate, 7), pad(arm.meanDiamonds, 10), pad(arm.meanHazards, 9), arm.meanUniqueCells
    ].join(""));
  }

  console.log(`\npaired differences against ${report.reference}`);
  console.log([pad("arm", 22), pad("delta", 10), pad("95% interval", 22), pad("P(improve)", 12), "separates from 0"].join(""));
  for (const comparison of report.comparisons) {
    console.log([
      pad(comparison.arm, 22),
      pad(comparison.meanDelta.toFixed(2), 10),
      pad(formatInterval(comparison.ci95), 22),
      pad(comparison.probabilityOfImprovement.toFixed(2), 12),
      comparison.separatesFromZero ? "yes" : "no"
    ].join(""));
  }
  console.log(`\nAn interval that straddles zero is not evidence of a difference either way.`);
  console.log(`Completed in ${(report.runtimeMs / 1000).toFixed(1)} s on ${report.node}.`);

  for (const [target, contents] of [[options.output, JSON.stringify(report, null, 2)], [options.csv, options.csv ? toCSV(report) : null]]) {
    if (!target || contents === null) continue;
    fs.mkdirSync(path.dirname(path.resolve(target)), { recursive: true });
    fs.writeFileSync(path.resolve(target), contents);
    console.log(`wrote ${target}`);
  }
}

main().catch(error => {
  console.error(`connectome-benchmark: ${error.message}`);
  process.exitCode = 1;
});
