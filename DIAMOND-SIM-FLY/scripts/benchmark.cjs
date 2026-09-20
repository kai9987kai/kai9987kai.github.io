#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const experiments = require("../src/worldlab-experiments.js");

function usage() {
  return `Usage: node scripts/benchmark.cjs [options]
  --seeds 11,29,47,71,101   Distinct positive uint32 seeds (2-30)
  --steps 150              Equal step budget per arm (1-2000)
  --agents 2               Agents sharing each world (1-12)
  --baseline legacy        legacy, greedy, or random
  --params '{"riskAversion":0.5}'  Shared JSON parameter overrides
  --bootstrap 2000         Paired-seed bootstrap samples (100-10000)
  --bootstrap-seed 20260912 Independent bootstrap RNG seed
  --output output/benchmark.json  Write full JSON receipt
  --csv output/benchmark.csv      Write completed pairs as CSV
  --help                   Show this help

Candidate planner is beam. Same seeds match initial conditions, not trajectories.
This toy-model comparison does not establish improvement on every metric.`;
}

function parseArgs(args) {
  const options = {};
  let output;
  let csv;
  const value = index => {
    if (index + 1 >= args.length || args[index + 1].startsWith("--")) {
      throw new Error(`Missing value for ${args[index]}.`);
    }
    return args[index + 1];
  };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === "--help" || flag === "-h") return { help: true };
    const raw = value(i);
    if (flag === "--seeds") {
      if (raw.split(",").some(seed => !seed.trim())) throw new Error("Seed entries cannot be empty.");
      options.seeds = raw.split(",").map(Number);
    } else if (flag === "--steps") options.steps = Number(raw);
    else if (flag === "--agents") options.numAgents = Number(raw);
    else if (flag === "--baseline") options.baseline = raw;
    else if (flag === "--bootstrap") options.bootstrapSamples = Number(raw);
    else if (flag === "--bootstrap-seed") options.bootstrapSeed = Number(raw);
    else if (flag === "--params") options.params = JSON.parse(raw);
    else if (flag === "--output") output = path.resolve(raw);
    else if (flag === "--csv") csv = path.resolve(raw);
    else throw new Error(`Unknown option ${flag}.`);
    i++;
  }
  experiments.validateOptions(options);
  return { options, output, csv };
}

function writeOutput(filename, contents) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, contents, "utf8");
}

async function main(args = process.argv.slice(2)) {
  const parsed = parseArgs(args);
  if (parsed.help) { process.stdout.write(usage() + "\n"); return; }
  let cancelled = false;
  const cancel = () => { cancelled = true; };
  process.once("SIGINT", cancel);
  let result;
  try {
    result = await experiments.runExperiment(parsed.options, { shouldCancel: () => cancelled });
  } finally {
    process.removeListener("SIGINT", cancel);
  }
  if (parsed.output) writeOutput(parsed.output, JSON.stringify(result, null, 2) + "\n");
  if (parsed.csv) writeOutput(parsed.csv, experiments.toCSV(result));
  const summary = result.summary;
  const number = value => value === null ? "n/a" : value.toFixed(4);
  process.stdout.write(`${result.protocol.version}: beam vs ${result.config.baseline}\n`);
  process.stdout.write(`${result.completedPairs}/${result.totalPairs} seed pairs; ${result.config.steps} steps; ${result.config.numAgents} agents per world; ${result.complete ? "complete" : "cancelled (completed pairs only)"}\n`);
  process.stdout.write(`Mean per-agent extrinsic delta: ${number(summary.meanDelta)}; 95% paired bootstrap interval: ${summary.ci95 ? summary.ci95.map(number).join(" to ") : "n/a"}\n`);
  if (summary.deltaMeans) {
    process.stdout.write(`Mean deltas: coverage ${(summary.deltaMeans.coverage * 100).toFixed(2)} pp; hazard hits ${number(summary.deltaMeans.hazardHits)}; respawns ${number(summary.deltaMeans.respawns)}; collisions ${number(summary.deltaMeans.collisions)}\n`);
  }
  process.stdout.write(summary.interpretation + "\n");
  if (parsed.output) process.stdout.write(`JSON: ${parsed.output}\n`);
  if (parsed.csv) process.stdout.write(`CSV: ${parsed.csv}\n`);
  if (!result.complete) process.exitCode = 130;
  return result;
}

if (require.main === module) {
  main().catch(error => { process.stderr.write(`Benchmark failed: ${error.message}\n`); process.exitCode = 1; });
}

module.exports = { main, parseArgs, usage };
