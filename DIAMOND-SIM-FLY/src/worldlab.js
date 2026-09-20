(function() {
"use strict";
const {GRID_SIZE, CELL_SIZE, GRID_CELLS, ACTIONS, ACTION_COUNT, MAX_ENERGY, HISTORY_LIMIT, MAX_PATH, clamp, lerp, indexOf, xyOf, format, hsl, RNG, Environment, Agent, createRun, stepRun, collectMetrics} = DiamondCore;
    const el = id => document.getElementById(id);
    const worldCanvas = el("world-canvas");
    const modelCanvas = el("model-canvas");
    const chartCanvas = el("chart-canvas");
    const worldCtx = worldCanvas.getContext("2d");
    const modelCtx = modelCanvas.getContext("2d");
    const chartCtx = chartCanvas.getContext("2d");

    class ChartRenderer {
      constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
      }

      draw(history, mode) {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#050813";
        ctx.fillRect(0, 0, w, h);

        const series = this.getSeries(history, mode);
        const padding = { left: 48, right: 18, top: 24, bottom: 34 };

        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
          const y = padding.top + (i / 5) * (h - padding.top - padding.bottom);
          ctx.beginPath();
          ctx.moveTo(padding.left, y);
          ctx.lineTo(w - padding.right, y);
          ctx.stroke();
        }

        ctx.fillStyle = "rgba(238,244,255,0.75)";
        ctx.font = "22px Inter, system-ui, sans-serif";
        ctx.fillText(this.title(mode), padding.left, 22);

        if (history.length < 2) {
          ctx.fillStyle = "rgba(238,244,255,0.5)";
          ctx.font = "16px Inter, system-ui, sans-serif";
          ctx.fillText("Run or step the simulation to collect data.", padding.left, h / 2);
          return;
        }

        const allValues = series.flatMap(s => s.values);
        let min = Math.min(...allValues);
        let max = Math.max(...allValues);
        if (Math.abs(max - min) < 0.0001) {
          max += 1;
          min -= 1;
        }
        const plotW = w - padding.left - padding.right;
        const plotH = h - padding.top - padding.bottom;

        const xOf = i => padding.left + (i / (history.length - 1)) * plotW;
        const yOf = value => padding.top + (1 - (value - min) / (max - min)) * plotH;

        series.forEach((s, si) => {
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 3;
          ctx.beginPath();
          s.values.forEach((value, i) => {
            const x = xOf(i);
            const y = yOf(value);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();

          ctx.fillStyle = s.color;
          ctx.font = "13px Inter, system-ui, sans-serif";
          ctx.fillText(s.label, padding.left + si * 185, h - 9);
        });

        ctx.fillStyle = "rgba(238,244,255,0.55)";
        ctx.font = "12px Inter, system-ui, sans-serif";
        ctx.fillText(format(max, 2), 6, padding.top + 4);
        ctx.fillText(format(min, 2), 6, h - padding.bottom);
      }

      title(mode) {
        if (mode === "model") return "World-model learning";
        if (mode === "survival") return "Survival pressure";
        return "Reward signals";
      }

      getSeries(history, mode) {
        if (mode === "model") {
          return [
            { label: "Model MAE", color: "#ff8fab", values: history.map(d => d.mae) },
            { label: "Uncertainty", color: "#9bbcff", values: history.map(d => d.uncertainty) },
            { label: "Coverage", color: "#78f0d1", values: history.map(d => d.coverage) }
          ];
        }
        if (mode === "survival") {
          return [
            { label: "Energy fraction", color: "#ffd166", values: history.map(d => d.energyPct) },
            { label: "Collisions", color: "#ff6b7a", values: history.map(d => d.collisions) },
            { label: "Hazard hits", color: "#c084fc", values: history.map(d => d.hazards) }
          ];
        }
        return [
          { label: "Extrinsic reward", color: "#55e68a", values: history.map(d => d.reward) },
          { label: "Intrinsic reward", color: "#78f0d1", values: history.map(d => d.intrinsic) }
        ];
      }
    }

    class Simulation {
      constructor() {
        this.bindControls();
        this.chart = new ChartRenderer(chartCanvas, chartCtx);
        this.running = false;
        this.frame = 0;
        this.reset();
      }

      bindControls() {
        this.controls = {
          seed: el("seed-input"),
          numAgents: el("num-agents"),
          stepsFrame: el("steps-frame"),
          diffusion: el("diffusion-steps"),
          learningRate: el("learning-rate"),
          discount: el("discount"),
          epsilon: el("epsilon"),
          curiosity: el("curiosity"),
          planning: el("planning"),
          horizon: el("horizon"),
          observeRadius: el("observe-radius"),
          modelView: el("model-view"),
          planner: el("planner-mode"),
          riskAversion: el("risk-aversion"),
          communication: el("communication"),
          movingHazards: el("moving-hazards"),
          showTrails: el("show-trails"),
          showPlans: el("show-plans"),
          chartMode: el("chart-mode")
        };

        const syncLabels = () => {
          el("seed-value").textContent = this.controls.seed.value;
          el("num-agents-value").textContent = this.controls.numAgents.value;
          el("steps-frame-value").textContent = this.controls.stepsFrame.value;
          el("diffusion-steps-value").textContent = this.controls.diffusion.value;
          el("learning-rate-value").textContent = this.controls.learningRate.value;
          el("discount-value").textContent = this.controls.discount.value;
          el("epsilon-value").textContent = this.controls.epsilon.value;
          el("curiosity-value").textContent = this.controls.curiosity.value;
          el("risk-aversion-value").textContent = this.controls.riskAversion.value;
          el("planning-value").textContent = this.controls.planning.value;
          el("horizon-value").textContent = this.controls.horizon.value;
          el("observe-radius-value").textContent = this.controls.observeRadius.value;
        };

        Object.values(this.controls).forEach(control => control.addEventListener("input", () => {
          syncLabels();
          this.draw();
          if (control === this.controls.seed || control === this.controls.numAgents) el("run-status").textContent = "Seed and agent count apply on Reset.";
        }));
        syncLabels();

        el("run-button").addEventListener("click", () => this.toggleRun());
        el("step-button").addEventListener("click", () => {
          this.pause();
          this.step();
          this.draw();
        });
        el("reset-button").addEventListener("click", () => this.reset());
        el("export-csv").addEventListener("click", () => this.exportCSV());
        el("save-json").addEventListener("click", () => this.saveSnapshot());
        el("load-snapshot-button").addEventListener("click", () => el("load-json").click());
        el("load-json").addEventListener("change", evt => this.loadSnapshot(evt));
        el("preset-curious").addEventListener("click", () => this.applyPreset("curious"));
        el("preset-planner").addEventListener("click", () => this.applyPreset("planner"));
        el("preset-swarm").addEventListener("click", () => this.applyPreset("swarm"));
        el("selected-agent").addEventListener("change", () => this.draw());
        el("experiment-run").addEventListener("click", () => this.runExperiment());
        el("experiment-cancel").addEventListener("click", () => { this.cancelExperiment = true; });
        el("experiment-json").addEventListener("click", () => this.download("diamond-comparison.json",JSON.stringify(this.experimentResult,null,2),"application/json"));
        el("experiment-csv").addEventListener("click", () => this.download("diamond-comparison.csv",DiamondExperiments.toCSV(this.experimentResult),"text/csv"));
        document.addEventListener("visibilitychange", () => { if(document.hidden) this.pause(); });
      }

      params() {
        return {
          learningRate: parseFloat(this.controls.learningRate.value),
          discount: parseFloat(this.controls.discount.value),
          epsilon: parseFloat(this.controls.epsilon.value),
          curiosity: parseFloat(this.controls.curiosity.value),
          planning: parseInt(this.controls.planning.value, 10),
          planningHorizon: parseInt(this.controls.horizon.value, 10),
          observeRadius: parseInt(this.controls.observeRadius.value, 10),
          diffusionSteps: parseInt(this.controls.diffusion.value, 10),
          communication: this.controls.communication.checked,
          movingHazards: this.controls.movingHazards.checked,
          planner: this.controls.planner.value,
          riskAversion: Number(this.controls.riskAversion.value)
        };
      }

      adoptRun(run) {
        this.run = run; this.env=run.env;this.rng=run.rng;this.agents=run.agents;
        this.stepCount=run.stepCount;this.history=run.history;
        el("selected-agent").replaceChildren(...run.agents.map(a => {
          const option=document.createElement("option");option.value=a.id;option.textContent="Agent "+a.id;return option;
        }));
      }

      reset() {
        try {
          const run=createRun(Number(this.controls.seed.value),Number(this.controls.numAgents.value),this.params());
          this.pause();this.adoptRun(run);this.bindLabelsOnly();this.draw();
          this.toast("New world · seed "+run.seed+" · "+run.agents.length+" agents.");
        } catch(error) { this.toast(error.message); }
      }

      applyPreset(name) {
        if (name === "curious") {
          this.controls.planner.value = 'beam';
          this.controls.curiosity.value = 1.35;
          this.controls.epsilon.value = 0.14;
          this.controls.planning.value = 10;
          this.controls.horizon.value = 2;
          this.controls.communication.checked = false;
          this.toast("Preset: high-curiosity isolated explorers.");
        } else if (name === "planner") {
          this.controls.planner.value = 'beam';
          this.controls.curiosity.value = 0.45;
          this.controls.epsilon.value = 0.05;
          this.controls.planning.value = 56;
          this.controls.horizon.value = 5;
          this.controls.communication.checked = false;
          this.toast("Preset: model-heavy planner with lower randomness.");
        } else {
          this.controls.planner.value = 'beam';
          this.controls.numAgents.value = 8;
          this.controls.curiosity.value = 0.75;
          this.controls.epsilon.value = 0.08;
          this.controls.planning.value = 20;
          this.controls.horizon.value = 3;
          this.controls.communication.checked = true;
          this.toast("Preset: communicating swarm map-builders.");
          this.reset();
          return;
        }
        this.bindLabelsOnly();
      }

      bindLabelsOnly() {
        this.controls.seed.dispatchEvent(new Event("input"));
        if(this.run && Number(this.controls.seed.value)===this.run.seed && Number(this.controls.numAgents.value)===this.agents.length)
          el("run-status").textContent=this.running?"Running · pauses when this tab is hidden":"Paused · Space to run · S to step · R to reset · F for fullscreen";
      }

      pause() {
        this.running=false;
        cancelAnimationFrame(this.frame);this.frame=0;
        el("run-button").textContent="Run";
        el("run-status").textContent="Paused · Space to run · S to step · R to reset · F for fullscreen";
      }

      toggleRun() {
        if(this.running) {this.pause();return;}
        this.running=true;
        el("run-button").textContent="Pause";
        el("run-status").textContent="Running · pauses when this tab is hidden";
        this.frame=requestAnimationFrame(()=>this.loop());
      }

      loop() {
        this.frame=0;
        if(!this.running) return;
        try {
          const start=performance.now(),steps=Number(this.controls.stepsFrame.value);
          for(let i=0;i<steps;i++) {this.step();if(performance.now()-start>=12) break;}
          this.draw();
          this.frame=requestAnimationFrame(()=>this.loop());
        } catch(error) {this.pause();this.toast(error.message);}
      }

      step() {
        this.run.params=this.params();
        stepRun(this.run);this.stepCount=this.run.stepCount;
      }

      updatePanels(metrics = this.history[this.history.length - 1]) {
        if (!metrics) {
          metrics = collectMetrics(this.run);
        }
        el("metric-step").textContent = metrics.step;
        el("metric-coverage").textContent = `${format(metrics.coverage * 100, 1)}%`;
        el("metric-reward").textContent = format(metrics.reward, 2);
        el("metric-intrinsic").textContent = format(metrics.intrinsic, 2);
        el("metric-mae").textContent = format(metrics.mae, 2);
        el("metric-uncertainty").textContent = format(metrics.uncertainty, 2);
        el("metric-energy").textContent = `${format(metrics.energyPct * 100, 0)}%`;
        el("metric-collisions").textContent = metrics.collisions;
        el("metric-hazards").textContent = metrics.hazards;
        el("metric-respawns").textContent = metrics.respawns;

        const agentList = el("agent-list");
        agentList.innerHTML = "";
        for (const agent of this.agents) {
          const card = document.createElement("div");
          card.className = "agent-card";
          card.innerHTML = `
            <span class="agent-dot" style="color:${hsl(agent.id)}; background:${hsl(agent.id)}"></span>
            <div>
              <strong>Agent ${agent.id}</strong>
              <p>pos (${agent.x}, ${agent.y}) · energy ${format((agent.energy / MAX_ENERGY) * 100, 0)}% · coverage ${format(agent.coverage() * 100, 1)}%</p>
              <p>R ${format(agent.totalExtrinsic, 1)} · curiosity ${format(agent.totalIntrinsic, 1)} · collisions ${agent.collisions}</p>
            </div>
          `;
          agentList.appendChild(card);
        }

      }

      draw() {
        if(!this.run) return;
        this.updatePanels();
        // Positions track logical ticks so pause/step remains visually exact.
        for (const a of this.agents) { a.renderX=a.x;a.renderY=a.y; }
        this.drawWorld();
        this.drawModel();
        this.chart.draw(this.history, this.controls.chartMode.value);
      }

      drawWorld() {
        worldCtx.clearRect(0, 0, worldCanvas.width, worldCanvas.height);
        for (let y = 0; y < GRID_SIZE; y++) {
          for (let x = 0; x < GRID_SIZE; x++) {
            const i = indexOf(x, y);
            let fill;
            if (this.env.obstacles[i]) {
              fill = "#596176";
            } else {
              const v = clamp(this.env.state[i] / 10, 0, 1);
              const r = Math.floor(5 + 18 * v);
              const g = Math.floor(20 + 210 * v);
              const b = Math.floor(24 + 70 * v);
              fill = `rgb(${r}, ${g}, ${b})`;
            }
            worldCtx.fillStyle = fill;
            worldCtx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);

            if (this.env.energy[i]) {
              worldCtx.fillStyle = "#ffd166";
              worldCtx.fillRect(x * CELL_SIZE + 2, y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
            }
          }
        }

        // Pulse visualization
        if (this.env.pulseLoc) {
          const p = this.env.pulseLoc;
          const progress = 1 - (p.life / 10);
          const radius = p.radius * CELL_SIZE * (0.5 + progress * 1.5);
          worldCtx.strokeStyle = `rgba(85, 230, 138, ${p.life / 10})`;
          worldCtx.lineWidth = 2;
          worldCtx.beginPath();
          worldCtx.arc(p.x * CELL_SIZE + CELL_SIZE / 2, p.y * CELL_SIZE + CELL_SIZE / 2, radius, 0, Math.PI * 2);
          worldCtx.stroke();
        }

        for (const h of this.env.hazards) {
          worldCtx.fillStyle = "#ff4d6d";
          worldCtx.beginPath();
          worldCtx.arc(h.x * CELL_SIZE + 5, h.y * CELL_SIZE + 5, 4.6, 0, Math.PI * 2);
          worldCtx.fill();
        }

        this.drawAgents(worldCtx, false);
      }

      drawModel() {
        modelCtx.clearRect(0, 0, modelCanvas.width, modelCanvas.height);
        const view = this.controls.modelView.value;
        const agent=this.agents.find(a=>a.id===Number(el("selected-agent").value)) || this.agents[0];
        const model={belief:agent.belief,uncertainty:agent.uncertainty,visits:agent.visits,error:agent.error,
          qmax:Float32Array.from({length:GRID_CELLS},(_,i)=>agent.bestActionValue(i))};

        let maxVisits = 1;
        for (const v of model.visits) maxVisits = Math.max(maxVisits, v);

        for (let y = 0; y < GRID_SIZE; y++) {
          for (let x = 0; x < GRID_SIZE; x++) {
            const i = indexOf(x, y);
            let fill;
            if (this.env.obstacles[i]) {
              fill = "#333849";
            } else if (view === "uncertainty") {
              const v = clamp(model.uncertainty[i], 0, 1);
              fill = `rgb(${Math.floor(25 + 190 * v)}, ${Math.floor(40 + 75 * (1 - v))}, ${Math.floor(70 + 160 * v)})`;
            } else if (view === "qmax") {
              const v = clamp((model.qmax[i] + 1) / 4, 0, 1);
              fill = `rgb(${Math.floor(20 + 210 * v)}, ${Math.floor(26 + 120 * v)}, ${Math.floor(50 + 40 * (1 - v))})`;
            } else if (view === "visits") {
              const v = Math.log(1 + model.visits[i]) / Math.log(1 + maxVisits);
              fill = `rgb(${Math.floor(15 + 80 * v)}, ${Math.floor(24 + 150 * v)}, ${Math.floor(60 + 190 * v)})`;
            } else if (view === "error") {
              const v = clamp(model.error[i] / 5, 0, 1);
              fill = `rgb(${Math.floor(18 + 220 * v)}, ${Math.floor(20 + 60 * (1 - v))}, ${Math.floor(45 + 60 * (1 - v))})`;
            } else {
              const v = clamp(model.belief[i] / 10, 0, 1);
              fill = `rgb(${Math.floor(4 + 40 * v)}, ${Math.floor(18 + 210 * v)}, ${Math.floor(32 + 95 * v)})`;
            }
            modelCtx.fillStyle = fill;
            modelCtx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
          }
        }

        this.drawAgents(modelCtx, true);
      }

      drawAgents(ctx, isModelCanvas) {
        for (const agent of this.agents) {
          if(isModelCanvas && agent.id!==Number(el("selected-agent").value)) continue;
          
          // Draw MPC Imagined Plans on Model Canvas
          if (isModelCanvas && this.controls.showPlans.checked && agent.currentPlan.length > 1) {
            ctx.strokeStyle = hsl(agent.id, 0.6);
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            agent.currentPlan.forEach((p, idx) => {
              const px = p.x * CELL_SIZE + CELL_SIZE / 2;
              const py = p.y * CELL_SIZE + CELL_SIZE / 2;
              if (idx === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            });
            ctx.stroke();
            ctx.setLineDash([]);

            agent.currentPlan.forEach((p, idx) => {
              if (idx === 0) return;
              const px = p.x * CELL_SIZE + CELL_SIZE / 2;
              const py = p.y * CELL_SIZE + CELL_SIZE / 2;
              ctx.fillStyle = hsl(agent.id, 1 - idx * 0.15);
              ctx.beginPath();
              ctx.arc(px, py, 3, 0, Math.PI * 2);
              ctx.fill();
            });
          }

          // Draw trails
          if (this.controls.showTrails.checked && agent.path.length > 1) {
            ctx.strokeStyle = hsl(agent.id, 0.35);
            ctx.lineWidth = 2;
            ctx.beginPath();
            agent.path.forEach((p, idx) => {
              const px = p.x * CELL_SIZE + CELL_SIZE / 2;
              const py = p.y * CELL_SIZE + CELL_SIZE / 2;
              if (idx === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            });
            ctx.stroke();
          }

          const rx = agent.renderX * CELL_SIZE + CELL_SIZE / 2;
          const ry = agent.renderY * CELL_SIZE + CELL_SIZE / 2;

          // Energy aura
          const energyPct = agent.energy / MAX_ENERGY;
          ctx.fillStyle = hsl(agent.id, 0.15 * energyPct);
          ctx.beginPath();
          ctx.arc(rx, ry, 10 + 4 * energyPct, 0, Math.PI * 2);
          ctx.fill();

          // Agent core
          ctx.fillStyle = hsl(agent.id, 0.95);
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(rx, ry, 5.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      exportCSV() {
        const rows = [
          ["step", "avg_reward", "avg_intrinsic", "coverage", "model_mae", "avg_uncertainty", "energy_pct", "collisions", "hazard_hits", "respawns", "prediction_error"]
        ];
        for (const d of this.history) {
          rows.push([d.step, d.reward, d.intrinsic, d.coverage, d.mae, d.uncertainty, d.energyPct, d.collisions, d.hazards, d.respawns, d.predictionError]);
        }
        this.download("diamond_world_model_lab_metrics.csv", rows.map(row => row.join(",")).join("\n"), "text/csv");
      }

      captureSnapshot() {
        this.run.params=this.params();
        return DiamondState.serializeRun(this.run);
      }

      saveSnapshot() {
        this.download("diamond-worldlab-v3.json",JSON.stringify(this.captureSnapshot()),"application/json");
      }

      restoreSnapshot(data) {
        const run=DiamondState.restoreRun(data);
        this.pause();this.adoptRun(run);
        this.controls.seed.value=run.seed;this.controls.numAgents.value=run.agents.length;
        const mapping={planningHorizon:"horizon",diffusionSteps:"diffusion"};
        for(const [key,value] of Object.entries(run.params)) {
          const control=this.controls[mapping[key]||key];
          if(control.type==="range") control.step="any";
          if(control.type==="checkbox") control.checked=value;else control.value=value;
        }
        this.bindLabelsOnly();this.draw();
      }

      async loadSnapshot(evt) {
        const file=evt.target.files[0];if(!file) return;
        try {
          if(file.size>16*1024*1024) throw new Error("Snapshot exceeds the 16 MB limit.");
          this.restoreSnapshot(JSON.parse(await file.text()));
          this.toast("Snapshot restored exactly. Press Run to continue.");
        } catch(error) {this.toast("Snapshot unchanged: "+error.message);}
        finally {evt.target.value="";}
      }

      async runExperiment() {
        if(this.experimentBusy) return;
        const options={seeds:el("experiment-seeds").value.split(",").map(s=>Number(s.trim())),
          steps:Number(el("experiment-steps").value),numAgents:this.agents.length,
          baseline:el("experiment-baseline").value,params:this.params()};
        try {DiamondExperiments.validateOptions(options);} catch(error) {el("experiment-status").textContent=error.message;return;}
        this.pause();this.experimentBusy=true;this.cancelExperiment=false;
        el("experiment-run").disabled=true;el("experiment-cancel").disabled=false;
        el("experiment-json").disabled=true;el("experiment-csv").disabled=true;
        el("experiment-results").replaceChildren();el("experiment-progress").value=0;
        try {
          const result=await DiamondExperiments.runExperiment(options,{
            shouldCancel:()=>this.cancelExperiment,
            yieldControl:()=>new Promise(resolve=>setTimeout(resolve,0)),
            onProgress:p=>{
              el("experiment-progress").value=p.completedPairs/p.totalPairs;
              el("experiment-status").textContent=`Seed ${p.seed} · ${p.phase} · ${p.step}/${p.steps} steps · ${p.completedPairs}/${p.totalPairs} pairs`;
            }
          });
          this.experimentResult=result;this.renderExperiment(result);
          el("experiment-json").disabled=false;el("experiment-csv").disabled=false;
        } catch(error) {el("experiment-status").textContent="Comparison failed: "+error.message;}
        finally {this.experimentBusy=false;el("experiment-run").disabled=false;el("experiment-cancel").disabled=true;}
      }

      renderExperiment(result) {
        const summary=result.summary;
        el("experiment-progress").value=result.completedPairs/result.totalPairs;
        el("experiment-status").textContent=`${result.complete?"Complete":"Cancelled · partial results"} · ${result.completedPairs}/${result.totalPairs} paired seeds · ${result.config.steps} steps per run · ${result.config.numAgents} agents`;
        const box=el("experiment-results");box.replaceChildren();
        if(!result.completedPairs) return;
        const callout=document.createElement("p");callout.className="result-callout";
        const ci=summary.ci95?`95% paired bootstrap interval: ${format(summary.ci95[0])} to ${format(summary.ci95[1])}.`:"At least two completed seeds are needed for an interval.";
        callout.textContent=`Mean reward difference per agent: ${summary.meanDelta>=0?"+":""}${format(summary.meanDelta)}. ${ci} ${summary.interpretation}`;
        box.appendChild(callout);
        const wrap=document.createElement("div");wrap.className="table-wrap";
        const table=document.createElement("table");
        const head=document.createElement("thead"),hr=document.createElement("tr");
        for(const name of ["Seed","Beam reward","Baseline reward","Difference","Beam hazards","Baseline hazards"]) {const th=document.createElement("th");th.scope="col";th.textContent=name;hr.appendChild(th);}
        head.appendChild(hr);table.appendChild(head);
        const body=document.createElement("tbody");
        for(const pair of result.pairs) {
          const row=document.createElement("tr");
          for(const value of [pair.seed,format(pair.candidate.totalExtrinsicPerAgent),format(pair.baseline.totalExtrinsicPerAgent),format(pair.delta.totalExtrinsicPerAgent),pair.candidate.hazardHits,pair.baseline.hazardHits]) {const td=document.createElement("td");td.textContent=value;row.appendChild(td);}
          body.appendChild(row);
        }
        table.appendChild(body);wrap.appendChild(table);box.appendChild(wrap);
      }

      download(filename, text, type) {
        const blob = new Blob([text], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(()=>URL.revokeObjectURL(url),1000);
        this.toast(filename + " exported.");
      }

      toast(message) {
        const box = el("toast");
        box.textContent = message;
        box.classList.add("show");
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => box.classList.remove("show"), 2200);
      }
    }

    const simulation = new Simulation();

    window.addEventListener("keydown", event => {
      if (event.target.matches("input, select, textarea, button, a")) return;
      if (event.key === " ") {
        event.preventDefault();
        simulation.toggleRun();
      } else if (event.key.toLowerCase() === "s") {
        simulation.pause();simulation.step();
        simulation.draw();
      } else if (event.key.toLowerCase() === "r") {
        simulation.reset();
      } else if(event.key.toLowerCase()==="f") {
        (document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()).catch(()=>simulation.toast("Fullscreen unavailable."));
      }
    });
    window.diamondLab = simulation;
    window.advanceTime = ms => {
      if(!Number.isFinite(ms)||ms<0||ms>60000) throw new Error("advanceTime accepts 0–60000 ms");
      simulation.pause();
      const ticks=Math.floor(ms/(1000/60)+1e-8);
      for(let i=0;i<ticks;i++) simulation.step();
      simulation.draw();
    };
    window.render_game_to_text = () => JSON.stringify({
      coordinates:"60x60 grid; origin top-left; x right, y down",running:simulation.running,
      seed:simulation.run.seed,step:simulation.stepCount,planner:simulation.params().planner,
      selectedAgent:Number(el("selected-agent").value),metrics:simulation.history.at(-1)||collectMetrics(simulation.run),
      agents:simulation.agents.map(a=>({id:a.id,x:a.x,y:a.y,energy:a.energy,reward:a.totalExtrinsic,respawns:a.respawns,plan:a.currentPlan})),
      hazards:simulation.env.hazards,experimentBusy:!!simulation.experimentBusy
    });

})();
