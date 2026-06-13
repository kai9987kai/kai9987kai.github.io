/* RSI Agent Laboratory UI Orchestration & Controller */

document.addEventListener("DOMContentLoaded", () => {
  // Initialize Core Agents & Charts
  const agent = new RSIAgent();
  const radarChart = new CritiqueRadarChart("radarCanvas");
  const flowVisualizer = new NeuralFlowVisualizer("networkCanvas");

  // Telemetry trend, mutation tree, and neural core charts
  const trendChart = new TrendLineChart("trendCanvas");
  const latentView = new LatentNetView("latentCanvas");
  const hashGridView = new HashGridView("hashCanvas");
  
  const lineageTree = new MutationLineageTree("lineageCanvas", (versionId) => {
    playSound("click");
    switchTab("sandbox-tab");
    
    if (versionId === "v1.0.0") {
      el.codeTextarea.value = JSON.stringify(DEFAULT_HEURISTICS, null, 2);
    } else {
      const idx = agent.promptManager.mutationsLog.findIndex(m => m.version === versionId);
      if (idx !== -1) {
        const historyState = agent.promptManager.history[idx];
        el.codeTextarea.value = JSON.stringify(historyState, null, 2);
      }
    }
    updateLineNumbers();
    logTrace("system", `Loaded prompt configuration state for version ${versionId} into sandbox editor.`);
  });

  // Start continuous rendering loops
  radarChart.startAnimateLoop();
  flowVisualizer.startAnimateLoop();
  
  // Continuous neural core canvases update loop
  const tickNeuralCore = () => {
    latentView.draw(agent.lastLatentVector, agent.lastActionIdx);
    hashGridView.draw(agent.lastHashResult);
    requestAnimationFrame(tickNeuralCore);
  };
  requestAnimationFrame(tickNeuralCore);

  // Elements Caching
  const el = {
    // Labels
    promptVer: document.getElementById("promptVerLabel"),
    mutationsCount: document.getElementById("mutationsCountLabel"),
    turnsCount: document.getElementById("turnsCountLabel"),
    memoryCount: document.getElementById("memoryCountLabel"),
    dominantTopic: document.getElementById("dominantTopicLabel"),
    agentMood: document.getElementById("agentMoodLabel"),
    
    // Sliders
    tempSlider: document.getElementById("tempSlider"),
    tempVal: document.getElementById("tempVal"),
    retrievalDepth: document.getElementById("retrievalDepth"),
    depthVal: document.getElementById("depthVal"),
    learningRate: document.getElementById("learningRate"),
    lrVal: document.getElementById("lrVal"),

    // Critique bars
    barHelpfulness: document.getElementById("barHelpfulness"),
    barTone: document.getElementById("barTone"),
    barReasoning: document.getElementById("barReasoning"),
    barClarity: document.getElementById("barClarity"),
    lblHelpfulness: document.getElementById("metricHelpfulness"),
    lblTone: document.getElementById("metricTone"),
    lblReasoning: document.getElementById("metricReasoning"),
    lblClarity: document.getElementById("metricClarity"),

    // Sidebar weights
    strategyList: document.getElementById("strategyList"),

    // Panels & Containers
    messagesContainer: document.getElementById("messagesContainer"),
    thoughtLog: document.getElementById("thoughtLog"),
    thoughtLogContainer: document.getElementById("thoughtLogContainer"),
    toggleThoughtLog: document.getElementById("toggleThoughtLog"),
    composerInput: document.getElementById("composerInput"),
    sendPromptBtn: document.getElementById("sendPromptBtn"),

    // Top actions
    runReflectBtn: document.getElementById("runReflectBtn"),
    seedExampleBtn: document.getElementById("seedExampleBtn"),
    hardResetBtn: document.getElementById("hardResetBtn"),

    // Tab buttons and Panes
    tabBtns: document.querySelectorAll(".tab-btn"),
    tabPanes: document.querySelectorAll(".tab-pane"),

    // Diff view
    diffViewer: document.getElementById("diffViewer"),
    diffVerSelector: document.getElementById("diffVersionSelector"),

    // Memory database elements
    memorySearchInput: document.getElementById("memorySearchInput"),
    memorySearchBtn: document.getElementById("memorySearchBtn"),
    memSubBtns: document.querySelectorAll(".mem-sub-btn"),
    memoryListItems: document.getElementById("memoryListItems"),
    clearMemoryLink: document.getElementById("clearMemoryLink"),
    forceMutationLink: document.getElementById("forceMutationLink"),

    // Sandbox elements
    codeTextarea: document.getElementById("codeTextarea"),
    codeLineNumbers: document.getElementById("codeLineNumbers"),
    restoreDefaultCodeBtn: document.getElementById("restoreDefaultCodeBtn"),
    injectCodeBtn: document.getElementById("injectCodeBtn"),

    // Feedback modal elements
    critiqueModal: document.getElementById("critiqueModal"),
    closeOverrideBtn: document.getElementById("closeOverrideBtn"),
    applyOverrideBtn: document.getElementById("applyOverrideBtn"),
    lblOverrideHelpfulness: document.getElementById("lblOverrideHelpfulness"),
    lblOverrideTone: document.getElementById("lblOverrideTone"),
    lblOverrideReasoning: document.getElementById("lblOverrideReasoning"),
    lblOverrideClarity: document.getElementById("lblOverrideClarity"),
    overrideHelpfulness: document.getElementById("overrideHelpfulness"),
    overrideTone: document.getElementById("overrideTone"),
    overrideReasoning: document.getElementById("overrideReasoning"),
    overrideClarity: document.getElementById("overrideClarity"),

    // Autopilot elements
    autopilotPlayBtn: document.getElementById("autopilotPlayBtn"),
    autopilotDelay: document.getElementById("autopilotDelay"),
    autoDelayVal: document.getElementById("autoDelayVal"),
    adversarialDiff: document.getElementById("adversarialDiff"),
    autoDiffVal: document.getElementById("autoDiffVal"),
    autoStatusLabel: document.getElementById("autoStatusLabel"),
    autoGenerationsLabel: document.getElementById("autoGenerationsLabel"),

    // Neural Core elements
    qStateGroupSelector: document.getElementById("qStateGroupSelector"),
    qTableMatrix: document.getElementById("qTableMatrix")
  };

  // State Management
  let isProcessing = false;
  let activeMemoryTab = "semantic"; // semantic or episodic
  let lastEvaluatedTurnIndex = null; // tracking turn for manual override

  // Autopilot loop parameters
  let isAutopilotRunning = false;
  let autopilotDelayMs = 2000;
  let adversarialDiffVal = 0.6;
  let autopilotTimeout = null;

  // AUDIO ENGINE: Web Audio API synthesized retro tech clicks
  const playSound = (type) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === "click") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
      } else if (type === "complete") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.setValueAtTime(1000, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.22);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.22);
      } else if (type === "error") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
      } else if (type === "mutate") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      }
    } catch (e) {
      // AudioContext blocked or unsupported, ignore
    }
  };

  // INITIAL SETUP
  const initUI = () => {
    el.codeTextarea.value = JSON.stringify(agent.promptManager.activeHeuristics, null, 2);
    updateLineNumbers();

    updateTelemetry();
    updateCritiqueBars([60, 60, 60, 60]);
    updateStrategyWeightsUI();
    renderMemoryList();
    renderQTableMatrix();

    trendChart.draw(agent.autopilotHistory);
    lineageTree.draw(agent.mutationLineage, agent.promptManager.activeVersion);

    addChatMessage("System online. Recursive self-improvement simulation ready.", "system");
    addChatMessage("Agent initialization success. Dynamic weights loaded, vector db semantic arrays initialized.\nTry feeding a test scenario to start iteration loops.", "agent");
  };

  // UI STATE REFRESH BLOCKS
  const updateTelemetry = () => {
    el.promptVer.textContent = agent.promptManager.activeVersion;
    el.mutationsCount.textContent = String(agent.mutations);
    el.turnsCount.textContent = String(agent.turns);
    
    const episodicCount = agent.memory.episodic.length;
    const semanticCount = agent.memory.semantic.length;
    el.memoryCount.textContent = `${episodicCount} / ${semanticCount}`;
    
    el.dominantTopic.textContent = agent.dominantTopic;
    el.agentMood.textContent = agent.mood;

    el.tempSlider.value = agent.temperature;
    el.tempVal.textContent = agent.temperature.toFixed(1);
    el.retrievalDepth.value = agent.retrievalDepth;
    el.depthVal.textContent = agent.retrievalDepth;
    el.learningRate.value = agent.learningRate;
    el.lrVal.textContent = agent.learningRate.toFixed(2);

    el.autoGenerationsLabel.textContent = String(agent.turns);
    el.autopilotDelay.value = (autopilotDelayMs / 1000).toFixed(1);
    el.autoDelayVal.textContent = `${(autopilotDelayMs / 1000).toFixed(1)}s`;
    el.adversarialDiff.value = adversarialDiffVal;
    el.autoDiffVal.textContent = adversarialDiffVal.toFixed(1);
  };

  const updateCritiqueBars = (values) => {
    el.barHelpfulness.style.width = `${values[0]}%`;
    el.barTone.style.width = `${values[1]}%`;
    el.barReasoning.style.width = `${values[2]}%`;
    el.barClarity.style.width = `${values[3]}%`;

    el.lblHelpfulness.textContent = `${values[0]}%`;
    el.lblTone.textContent = `${values[1]}%`;
    el.lblReasoning.textContent = `${values[2]}%`;
    el.lblClarity.textContent = `${values[3]}%`;

    radarChart.draw(values);
  };

  const updateStrategyWeightsUI = () => {
    el.strategyList.innerHTML = "";
    agent.strategies.forEach(strat => {
      const percentage = Math.round(strat.weight * 100);
      const row = document.createElement("div");
      row.className = "strategy-item";
      row.innerHTML = `
        <span class="strategy-name">${strat.label}</span>
        <div class="strategy-weight-container">
          <div class="strategy-bar">
            <div class="strategy-fill" style="width: ${percentage}%"></div>
          </div>
          <span class="strategy-val">${percentage}%</span>
        </div>
      `;
      el.strategyList.appendChild(row);
    });
  };

  const logTrace = (node, msg) => {
    const line = document.createElement("div");
    line.className = `trace-line ${node}`;
    line.textContent = `[${node.toUpperCase()}] ${msg}`;
    el.thoughtLog.appendChild(line);
    el.thoughtLog.scrollTop = el.thoughtLog.scrollHeight;
  };

  const addChatMessage = (text, role, critiqueScores = null, turnIdx = null) => {
    const msgNode = document.createElement("div");
    msgNode.className = `message ${role}`;
    msgNode.textContent = text;

    if (role === "agent" && critiqueScores && turnIdx !== null) {
      const tag = document.createElement("div");
      tag.className = "message-critique-tag";
      tag.innerHTML = `
        <button class="tune-btn" data-turn="${turnIdx}">
          ⚙️ Override Critique & Adapt
        </button>
      `;
      
      tag.querySelector(".tune-btn").addEventListener("click", (e) => {
        playSound("click");
        lastEvaluatedTurnIndex = turnIdx;
        openTuningModal(critiqueScores);
      });
      msgNode.appendChild(tag);
    }

    el.messagesContainer.appendChild(msgNode);
    el.messagesContainer.scrollTop = el.messagesContainer.scrollHeight;
    
    if (el.messagesContainer.childNodes.length > 60) {
      el.messagesContainer.removeChild(el.messagesContainer.firstChild);
    }
  };

  let typingBubble = null;
  const showTyping = () => {
    typingBubble = document.createElement("div");
    typingBubble.className = "message agent";
    typingBubble.innerHTML = `
      <div class="typing">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>
    `;
    el.messagesContainer.appendChild(typingBubble);
    el.messagesContainer.scrollTop = el.messagesContainer.scrollHeight;
  };

  const removeTyping = () => {
    if (typingBubble) {
      typingBubble.remove();
      typingBubble = null;
    }
  };

  // EXECUTE PROMPT PIPELINE (Accepts custom text for autopilot loops)
  const handleSendPrompt = async (customPromptText = null) => {
    const rawText = customPromptText !== null ? customPromptText.trim() : el.composerInput.value.trim();
    if (!rawText || isProcessing) return;

    isProcessing = true;
    playSound("click");
    
    if (customPromptText === null) {
      el.composerInput.value = "";
    }
    el.sendPromptBtn.disabled = true;

    addChatMessage(rawText, "user");

    showTyping();
    el.thoughtLog.innerHTML = "";
    el.thoughtLogContainer.classList.add("expanded");

    const execution = await agent.processQuery(rawText);

    let currentTraceIdx = 0;
    const isMutationExpected = !!execution.mutation;

    await flowVisualizer.runPipelineTrace(isMutationExpected, (activeNode) => {
      while (currentTraceIdx < execution.traces.length) {
        const item = execution.traces[currentTraceIdx];
        if (item.node === activeNode || (activeNode === "memory" && item.node === "system") || (activeNode === "perception" && item.node === "system")) {
          logTrace(item.node, item.msg);
          currentTraceIdx++;
        } else {
          break;
        }
      }
    });

    while (currentTraceIdx < execution.traces.length) {
      const item = execution.traces[currentTraceIdx];
      logTrace(item.node, item.msg);
      currentTraceIdx++;
    }

    removeTyping();
    playSound(isMutationExpected ? "mutate" : "complete");

    addChatMessage(execution.response, "agent", execution.critique, agent.turns);

    updateTelemetry();
    updateCritiqueBars([
      execution.critique.helpfulness,
      execution.critique.toneMatch,
      execution.critique.reasoningDepth,
      execution.critique.heuristicClarity
    ]);
    updateStrategyWeightsUI();
    renderMemoryList();
    renderQTableMatrix(); // Redraw Q-Learning heatmap cells

    trendChart.draw(agent.autopilotHistory);
    lineageTree.draw(agent.mutationLineage, agent.promptManager.activeVersion);

    if (execution.mutation) {
      addChatMessage(`System mutation logged under version ${execution.mutation.version}: ${execution.mutation.description}`, "reflection");
      renderDiffViewer(execution.mutation);
      populateMutationSelector();
    }

    el.sendPromptBtn.disabled = false;
    isProcessing = false;
  };

  // AUTOPILOT LOOP ORCHESTRATION
  const runAutopilotStep = async () => {
    if (!isAutopilotRunning) return;

    const challenge = agent.adversary.generateChallenge(agent.metrics, adversarialDiffVal);
    logTrace("system", `Adversary generated challenge for dimension '${challenge.dimension.toUpperCase()}': "${challenge.promptText}"`);

    await handleSendPrompt(challenge.promptText);

    if (isAutopilotRunning) {
      autopilotTimeout = setTimeout(runAutopilotStep, autopilotDelayMs);
    }
  };

  const startAutopilot = () => {
    isAutopilotRunning = true;
    el.autopilotPlayBtn.classList.add("running");
    el.autopilotPlayBtn.querySelector(".icon").textContent = "⏸";
    el.autopilotPlayBtn.querySelector(".text").textContent = "Pause Autopilot";
    el.autoStatusLabel.textContent = "RUNNING";
    el.autoStatusLabel.style.color = "var(--accent-emerald)";
    
    logTrace("system", "Autopilot Loop initialized. Autonomous self-play feedback activated.");
    runAutopilotStep();
  };

  const stopAutopilot = () => {
    isAutopilotRunning = false;
    if (autopilotTimeout) clearTimeout(autopilotTimeout);
    el.autopilotPlayBtn.classList.remove("running");
    el.autopilotPlayBtn.querySelector(".icon").textContent = "▶";
    el.autopilotPlayBtn.querySelector(".text").textContent = "Start Autopilot";
    el.autoStatusLabel.textContent = "PAUSED";
    el.autoStatusLabel.style.color = "var(--accent-amber)";
    logTrace("system", "Autopilot Loop paused.");
  };

  // OVERRIDE METRICS OVERLAY INTERACTION
  const openTuningModal = (critique) => {
    el.overrideHelpfulness.value = critique.helpfulness;
    el.lblOverrideHelpfulness.textContent = critique.helpfulness;

    el.overrideTone.value = critique.toneMatch;
    el.lblOverrideTone.textContent = critique.toneMatch;

    el.overrideReasoning.value = critique.reasoningDepth;
    el.lblOverrideReasoning.textContent = critique.reasoningDepth;

    el.overrideClarity.value = critique.heuristicClarity;
    el.lblOverrideClarity.textContent = critique.heuristicClarity;

    el.critiqueModal.classList.add("active");
  };

  const closeTuningModal = () => {
    el.critiqueModal.classList.remove("active");
  };

  const handleApplyOverride = () => {
    closeTuningModal();
    if (lastEvaluatedTurnIndex === null) return;

    playSound("mutate");
    const overriddenScores = {
      helpfulness: parseInt(el.overrideHelpfulness.value),
      toneMatch: parseInt(el.overrideTone.value),
      reasoningDepth: parseInt(el.overrideReasoning.value),
      heuristicClarity: parseInt(el.overrideClarity.value)
    };

    const episode = agent.memory.episodic.find(ep => ep.turn === lastEvaluatedTurnIndex);
    if (episode) {
      episode.critique = overriddenScores;
    }

    el.thoughtLog.innerHTML = "";
    logTrace("critic", `Manual critique override received for Turn ${lastEvaluatedTurnIndex}.`);
    logTrace("critic", `Injecting scores: Helpfulness=${overriddenScores.helpfulness}%, Tone Match=${overriddenScores.toneMatch}%, Reasoning Depth=${overriddenScores.reasoningDepth}%, Clarity=${overriddenScores.heuristicClarity}%`);

    // Force Q-learning policy update
    const reward = +(0.3 * overriddenScores.helpfulness + 0.3 * overriddenScores.toneMatch + 0.2 * overriddenScores.reasoningDepth + 0.2 * overriddenScores.heuristicClarity) / 10.0;
    const qUpdate = agent.qEngine.updateQValue(agent.lastStateIdx, agent.lastActionIdx, reward, agent.lastStateIdx);
    logTrace("critic", `Q-learning overridden. State-Action (${agent.lastStateIdx}, ${agent.lastActionIdx}) Q-value updated: ${qUpdate.oldVal} -> ${qUpdate.newVal} (Delta: ${qUpdate.delta > 0 ? '+' : ''}${qUpdate.delta})`);

    // Synchronize biases
    agent.syncStrategyWeightsFromQ(agent.lastStateIdx);
    updateStrategyWeightsUI();
    renderQTableMatrix();

    const threshold = 68;
    const deficiencies = {};
    if (overriddenScores.helpfulness < threshold) deficiencies.helpfulness = overriddenScores.helpfulness;
    if (overriddenScores.toneMatch < threshold) deficiencies.tone = overriddenScores.toneMatch;
    if (overriddenScores.reasoningDepth < threshold) deficiencies.reasoning = overriddenScores.reasoningDepth;
    if (overriddenScores.heuristicClarity < threshold) deficiencies.clarity = overriddenScores.heuristicClarity;

    if (Object.keys(deficiencies).length > 0) {
      agent.mutations += 1;
      logTrace("mutator", `Deficiencies flagged from manual feedback. Running optimization...`);
      const mutation = agent.promptManager.mutateHeuristics(deficiencies, agent.learningRate);
      logTrace("mutator", `Manual override triggered mutation: ${mutation.version} - ${mutation.description}`);

      addChatMessage(`Manual override triggered prompt mutation ${mutation.version}: ${mutation.description}`, "reflection");
      
      const historyItem = agent.autopilotHistory.find(h => h.turn === lastEvaluatedTurnIndex);
      if (historyItem) {
        historyItem.mutated = true;
        historyItem.promptVer = mutation.version;
      }
      
      renderDiffViewer(mutation);
      populateMutationSelector();
      switchTab("diff-tab");
    } else {
      logTrace("mutator", "Scores remain above mutation threshold. Weights adjusted, prompt unchanged.");
    }

    updateTelemetry();
    updateCritiqueBars([
      overriddenScores.helpfulness,
      overriddenScores.toneMatch,
      overriddenScores.reasoningDepth,
      overriddenScores.heuristicClarity
    ]);
    
    trendChart.draw(agent.autopilotHistory);
    lineageTree.draw(agent.mutationLineage, agent.promptManager.activeVersion);
  };

  // TAB PANES NAVIGATOR
  const switchTab = (tabId) => {
    el.tabBtns.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === tabId);
    });
    el.tabPanes.forEach(pane => {
      pane.classList.toggle("active", pane.id === tabId);
    });
  };

  // RENDERING DIFF VIEWER LOGS
  const renderDiffViewer = (mutation) => {
    if (!mutation || !mutation.diff) {
      el.diffViewer.innerHTML = `<div class="diff-empty-state">No modifications found under this version.</div>`;
      return;
    }

    el.diffViewer.innerHTML = "";
    
    const headerNode = document.createElement("div");
    headerNode.className = "diff-line header";
    headerNode.innerHTML = `
      <span class="diff-num">-</span>
      <span class="diff-num">+</span>
      <span class="diff-txt">Mutation Diff Details: ${mutation.version} (${mutation.description})</span>
    `;
    el.diffViewer.appendChild(headerNode);

    mutation.diff.forEach(line => {
      const lineNode = document.createElement("div");
      lineNode.className = `diff-line ${line.type}`;
      lineNode.innerHTML = `
        <span class="diff-num">${line.oldNum || ""}</span>
        <span class="diff-num">${line.newNum || ""}</span>
        <span class="diff-txt">${line.text}</span>
      `;
      el.diffViewer.appendChild(lineNode);
    });
  };

  const populateMutationSelector = () => {
    el.diffVerSelector.innerHTML = "";
    
    const baseOpt = document.createElement("option");
    baseOpt.value = "base";
    baseOpt.textContent = "v1.0.0 (Base Prompt System)";
    el.diffVerSelector.appendChild(baseOpt);

    agent.promptManager.mutationsLog.forEach((m, idx) => {
      const opt = document.createElement("option");
      opt.value = String(idx);
      opt.textContent = `${m.version} (${m.description.substring(0, 30)}...)`;
      el.diffVerSelector.appendChild(opt);
    });

    if (agent.promptManager.mutationsLog.length > 0) {
      el.diffVerSelector.value = String(agent.promptManager.mutationsLog.length - 1);
    }
  };

  // RENDERING MEMORY LOG TABLES
  const renderMemoryList = () => {
    el.memoryListItems.innerHTML = "";
    
    if (activeMemoryTab === "semantic") {
      const semanticList = agent.memory.semantic;
      if (semanticList.length === 0) {
        el.memoryListItems.innerHTML = `<div class="mem-empty">Semantic database is empty.<br>Start communicating with the agent to consolidate semantic knowledge nodes automatically.</div>`;
        return;
      }

      semanticList.forEach(node => {
        const card = document.createElement("div");
        card.className = "mem-node-card";
        card.innerHTML = `
          <div class="mem-node-meta">
            <span class="mem-node-label">${node.label}</span>
            <span class="mem-node-val">vector</span>
          </div>
          <div class="mem-node-content">${node.content}</div>
          ${node.associations.length > 0 ? `<div class="mem-node-association">Keywords: ${node.associations.join(", ")}</div>` : ""}
        `;
        el.memoryListItems.appendChild(card);
      });
    } else {
      const episodicList = agent.memory.episodic;
      if (episodicList.length === 0) {
        el.memoryListItems.innerHTML = `<div class="mem-empty">No episodes recorded in current session buffer.</div>`;
        return;
      }

      episodicList.forEach(ep => {
        const card = document.createElement("div");
        card.className = "mem-node-card";
        card.innerHTML = `
          <div class="mem-node-meta">
            <span class="mem-node-label">Turn ${ep.turn}</span>
            <span class="mem-node-val">Prompt: ${ep.promptVer}</span>
          </div>
          <div class="mem-node-content">
            <strong>User:</strong> "${ep.userText.substring(0, 45)}..."<br>
            <strong>Agent:</strong> "${ep.agentResponse.substring(0, 45)}..."
          </div>
          <div class="mem-node-association" style="color: var(--accent-amber)">
            Helpfulness: ${ep.critique.helpfulness}% | Tone Match: ${ep.critique.toneMatch}%
          </div>
        `;
        el.memoryListItems.appendChild(card);
      });
    }
  };

  // RENDER Q-LEARNING Heatmap Matrix cells
  const renderQTableMatrix = () => {
    el.qTableMatrix.innerHTML = "";
    
    const viewType = el.qStateGroupSelector.value;
    const actions = agent.qEngine.actions;

    // Build Table Header
    const headerRow = document.createElement("tr");
    headerRow.innerHTML = "<th>State Variable</th>";
    actions.forEach(a => {
      headerRow.innerHTML += `<th>${a.label}</th>`;
    });
    el.qTableMatrix.appendChild(headerRow);

    // Get current active state indices to highlight active cell
    const activeStateIdx = agent.lastStateIdx;
    const activeActionIdx = agent.lastActionIdx;

    if (viewType === "emotion") {
      // Group Q-values by Emotion states
      const emotions = agent.qEngine.emotions;
      const intentsCount = agent.qEngine.intents.length;
      
      emotions.forEach((emName, emIdx) => {
        const row = document.createElement("tr");
        row.innerHTML = `<th>${emName.toUpperCase()}</th>`;

        // Check if this row represents the active state's emotion
        const isActiveEmotionRow = Math.floor(activeStateIdx / intentsCount) === emIdx;

        actions.forEach((_, aIdx) => {
          // Average Q values across the 6 intents of this emotion
          let sumVal = 0.0;
          for (let iIdx = 0; iIdx < intentsCount; iIdx++) {
            sumVal += agent.qEngine.qTable[emIdx * intentsCount + iIdx][aIdx];
          }
          const avgVal = +(sumVal / intentsCount).toFixed(2);

          // Calculate cell color representation (Green for positive reward, Red for negative)
          let bgColor = "transparent";
          if (avgVal > 0) {
            bgColor = `rgba(16, 185, 129, ${Math.min(0.85, avgVal / 2.0)})`;
          } else if (avgVal < 0) {
            bgColor = `rgba(239, 68, 68, ${Math.min(0.85, Math.abs(avgVal) / 2.0)})`;
          }

          // Highlight cell if it is active
          const isCellHighlighted = isActiveEmotionRow && aIdx === activeActionIdx;
          const hlClass = isCellHighlighted ? "class='q-cell-active'" : "";

          row.innerHTML += `<td ${hlClass} style="background-color: ${bgColor}">${avgVal.toFixed(2)}</td>`;
        });

        el.qTableMatrix.appendChild(row);
      });
    } else {
      // Group Q-values by Intent states
      const intents = agent.qEngine.intents;
      const emotionsCount = agent.qEngine.emotions.length;

      intents.forEach((intentName, iIdx) => {
        const row = document.createElement("tr");
        row.innerHTML = `<th>${intentName.toUpperCase()}</th>`;

        const isActiveIntentRow = (activeStateIdx % intents.length) === iIdx;

        actions.forEach((_, aIdx) => {
          // Average Q values across the 7 emotions for this intent
          let sumVal = 0.0;
          for (let emIdx = 0; emIdx < emotionsCount; emIdx++) {
            sumVal += agent.qEngine.qTable[emIdx * intents.length + iIdx][aIdx];
          }
          const avgVal = +(sumVal / emotionsCount).toFixed(2);

          let bgColor = "transparent";
          if (avgVal > 0) {
            bgColor = `rgba(16, 185, 129, ${Math.min(0.85, avgVal / 2.0)})`;
          } else if (avgVal < 0) {
            bgColor = `rgba(239, 68, 68, ${Math.min(0.85, Math.abs(avgVal) / 2.0)})`;
          }

          const isCellHighlighted = isActiveIntentRow && aIdx === activeActionIdx;
          const hlClass = isCellHighlighted ? "class='q-cell-active'" : "";

          row.innerHTML += `<td ${hlClass} style="background-color: ${bgColor}">${avgVal.toFixed(2)}</td>`;
        });

        el.qTableMatrix.appendChild(row);
      });
    }
  };

  // HEURISTICS SANDBOX CODE EDITOR UTILITIES
  const updateLineNumbers = () => {
    const text = el.codeTextarea.value;
    const lines = text.split("\n").length;
    let html = "";
    for (let i = 1; i <= lines; i++) {
      html += `<div>${i}</div>`;
    }
    el.codeLineNumbers.innerHTML = html;
  };

  el.codeTextarea.addEventListener("scroll", () => {
    el.codeLineNumbers.scrollTop = el.codeTextarea.scrollTop;
  });

  el.codeTextarea.addEventListener("input", updateLineNumbers);

  const handleInjectSandbox = () => {
    playSound("click");
    const jsonStr = el.codeTextarea.value;
    
    el.thoughtLog.innerHTML = "";
    logTrace("system", "Sandbox code compilation triggered.");

    const result = agent.promptManager.compileUserHeuristics(jsonStr);

    if (result.success) {
      playSound("mutate");
      logTrace("mutator", `Compilation success! Version incremented to: ${result.logEntry.version}`);
      addChatMessage(`User injected new heuristics block under version ${result.logEntry.version}`, "reflection");
      
      const prevVer = agent.promptManager.history.length > 0 ? agent.promptManager.history[agent.promptManager.history.length - 1].version : "v1.0.0";
      agent.mutationLineage.push({
        id: result.logEntry.version,
        parent: prevVer,
        desc: result.logEntry.description
      });

      renderDiffViewer(result.logEntry);
      populateMutationSelector();
      updateTelemetry();
      
      trendChart.draw(agent.autopilotHistory);
      lineageTree.draw(agent.mutationLineage, agent.promptManager.activeVersion);
      switchTab("diff-tab");
    } else {
      playSound("error");
      logTrace("alert", `Compilation error: ${result.error}`);
      alert(`Heuristics Compilation Failed:\n${result.error}\n\nPlease check JSON syntax and parameters template structure.`);
    }
  };

  // CORE ACTIONS EVENTS
  
  // Consolidate & Reflect
  el.runReflectBtn.addEventListener("click", () => {
    playSound("click");
    el.thoughtLog.innerHTML = "";
    el.thoughtLogContainer.classList.add("expanded");
    
    const outcome = agent.forceConsolidate((node, msg) => {
      logTrace(node, msg);
    });

    alert(outcome);
    updateTelemetry();
    updateStrategyWeightsUI();
    renderMemoryList();

    const latestMutationIdx = agent.promptManager.mutationsLog.length - 1;
    if (latestMutationIdx >= 0) {
      renderDiffViewer(agent.promptManager.mutationsLog[latestMutationIdx]);
      populateMutationSelector();
      switchTab("diff-tab");
    }

    trendChart.draw(agent.autopilotHistory);
    lineageTree.draw(agent.mutationLineage, agent.promptManager.activeVersion);
  });

  // Seed turns script to instantly demonstrate loop mutations
  el.seedExampleBtn.addEventListener("click", async () => {
    playSound("click");
    if (isProcessing) return;
    
    isProcessing = true;
    el.thoughtLog.innerHTML = "";
    el.thoughtLogContainer.classList.add("expanded");
    addChatMessage("Triggering multi-turn conversation seeding trajectory...", "system");

    // Turn 1
    addChatMessage("Hi, I want to learn about sorting, but write it with errors.", "user");
    let execution = await agent.processQuery("Hi, I want to learn about sorting, but write it with errors.");
    addChatMessage(execution.response, "agent", execution.critique, agent.turns);
    updateCritiqueBars([
      execution.critique.helpfulness,
      execution.critique.toneMatch,
      execution.critique.reasoningDepth,
      execution.critique.heuristicClarity
    ]);

    // Turn 2
    addChatMessage("This sorting code is broken! I am so frustrated because this sorting algorithm keeps failing in my runtime!", "user");
    execution = await agent.processQuery("This sorting code is broken! I am so frustrated because this sorting algorithm keeps failing in my runtime!");
    addChatMessage(execution.response, "agent", execution.critique, agent.turns);
    updateCritiqueBars([
      execution.critique.helpfulness,
      execution.critique.toneMatch,
      execution.critique.reasoningDepth,
      execution.critique.heuristicClarity
    ]);

    if (execution.mutation) {
      renderDiffViewer(execution.mutation);
      populateMutationSelector();
      switchTab("diff-tab");
    }

    updateTelemetry();
    updateStrategyWeightsUI();
    renderMemoryList();
    renderQTableMatrix();
    
    trendChart.draw(agent.autopilotHistory);
    lineageTree.draw(agent.mutationLineage, agent.promptManager.activeVersion);

    isProcessing = false;
    playSound("complete");
  });

  // Reset System
  el.hardResetBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to restore factory defaults? This clears memory vaults, prompt versions, and strategies weights.")) {
      playSound("click");
      stopAutopilot();
      agent.reset();
      el.messagesContainer.innerHTML = "";
      el.thoughtLog.innerHTML = "";
      initUI();
    }
  });

  // Autopilot play/pause toggle
  el.autopilotPlayBtn.addEventListener("click", () => {
    playSound("click");
    if (isAutopilotRunning) {
      stopAutopilot();
    } else {
      startAutopilot();
    }
  });

  // Autopilot loop parameters sliders
  el.autopilotDelay.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    autopilotDelayMs = val * 1000;
    el.autoDelayVal.textContent = `${val.toFixed(1)}s`;
    logTrace("system", `Autopilot loop delay updated to ${autopilotDelayMs}ms.`);
  });

  el.adversarialDiff.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    adversarialDiffVal = val;
    el.autoDiffVal.textContent = val.toFixed(1);
    logTrace("system", `Adversary challenge intensity updated to ${adversarialDiffVal}.`);
  });

  // Neural Core table filters
  el.qStateGroupSelector.addEventListener("change", () => {
    playSound("click");
    renderQTableMatrix();
  });

  // Sidebar parameters sliders
  el.tempSlider.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    agent.temperature = val;
    el.tempVal.textContent = val.toFixed(1);
  });

  el.retrievalDepth.addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    agent.retrievalDepth = val;
    el.depthVal.textContent = val;
  });

  el.learningRate.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    agent.learningRate = val;
    el.lrVal.textContent = val.toFixed(2);
  });

  // Modal actions bind
  el.overrideHelpfulness.addEventListener("input", (e) => el.lblOverrideHelpfulness.textContent = e.target.value);
  el.overrideTone.addEventListener("input", (e) => el.lblOverrideTone.textContent = e.target.value);
  el.overrideReasoning.addEventListener("input", (e) => el.lblOverrideReasoning.textContent = e.target.value);
  el.overrideClarity.addEventListener("input", (e) => el.lblOverrideClarity.textContent = e.target.value);

  el.closeOverrideBtn.addEventListener("click", closeTuningModal);
  el.applyOverrideBtn.addEventListener("click", handleApplyOverride);

  // Tab Header switching click
  el.tabBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      playSound("click");
      switchTab(e.target.dataset.tab);
    });
  });

  // Memory Vault subtabs
  el.memSubBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      playSound("click");
      el.memSubBtns.forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      activeMemoryTab = e.target.dataset.mem;
      renderMemoryList();
    });
  });

  // Memory Vault search input
  el.memorySearchBtn.addEventListener("click", () => {
    playSound("click");
    const query = el.memorySearchInput.value.trim();
    if (!query) {
      renderMemoryList();
      return;
    }

    const hits = agent.memory.query(query, 10);
    el.memoryListItems.innerHTML = "";
    
    const combinedHits = [
      ...hits.semanticHits.map(h => ({ type: "Semantic", title: h.node.label, body: h.node.content, score: h.score })),
      ...hits.episodicHits.map(h => ({ type: "Episodic", title: `Turn ${h.episode.turn}`, body: `U: ${h.episode.userText.substring(0,40)} | A: ${h.episode.agentResponse.substring(0,40)}`, score: h.score }))
    ].sort((a,b) => b.score - a.score);

    if (combinedHits.length === 0) {
      el.memoryListItems.innerHTML = `<div class="mem-empty">No hits matching query: '${query}'</div>`;
      return;
    }

    combinedHits.forEach(hit => {
      const card = document.createElement("div");
      card.className = "mem-node-card";
      card.innerHTML = `
        <div class="mem-node-meta">
          <span class="mem-node-label">${hit.title}</span>
          <span class="mem-node-val" style="color: var(--accent-emerald)">Score: ${hit.score.toFixed(2)}</span>
        </div>
        <div class="mem-node-content">(${hit.type}) ${hit.body}</div>
      `;
      el.memoryListItems.appendChild(card);
    });
  });

  // Heuristics sandbox controls
  el.restoreDefaultCodeBtn.addEventListener("click", () => {
    if (confirm("Restore code sandbox configuration to initial templates?")) {
      playSound("click");
      el.codeTextarea.value = JSON.stringify(DEFAULT_HEURISTICS, null, 2);
      updateLineNumbers();
    }
  });

  el.injectCodeBtn.addEventListener("click", handleInjectSandbox);

  // Link actions
  el.clearMemoryLink.addEventListener("click", () => {
    if (confirm("Reset episodic and semantic database logs?")) {
      playSound("click");
      agent.memory.clear();
      renderMemoryList();
      updateTelemetry();
      alert("Memory Databases Cleared.");
    }
  });

  el.forceMutationLink.addEventListener("click", () => {
    playSound("click");
    el.thoughtLog.innerHTML = "";
    el.thoughtLogContainer.classList.add("expanded");
    
    const mut = agent.forceMutation((node, msg) => {
      logTrace(node, msg);
    });

    addChatMessage(`Forced prompt mutation applied under version ${mut.version}: ${mut.desc || mut.description}`, "reflection");
    renderDiffViewer(mut);
    populateMutationSelector();
    updateTelemetry();
    
    trendChart.draw(agent.autopilotHistory);
    lineageTree.draw(agent.mutationLineage, agent.promptManager.activeVersion);
    switchTab("diff-tab");
  });

  // Diff selector version changes
  el.diffVerSelector.addEventListener("change", (e) => {
    playSound("click");
    const val = e.target.value;
    if (val === "base") {
      const diff = agent.promptManager.generateLineDiff(DEFAULT_HEURISTICS.systemPrompt, DEFAULT_HEURISTICS.systemPrompt);
      renderDiffViewer({ version: "v1.0.0", description: "Initial factory system specifications", diff });
    } else {
      const idx = parseInt(val);
      const mutation = agent.promptManager.mutationsLog[idx];
      renderDiffViewer(mutation);
    }
  });

  // Trace window header collapse trigger
  el.toggleThoughtLog.addEventListener("click", () => {
    playSound("click");
    el.thoughtLogContainer.classList.toggle("expanded");
  });

  // Short-cut chip buttons click
  document.querySelectorAll(".chip-btn").forEach(chip => {
    chip.addEventListener("click", (e) => {
      playSound("click");
      el.composerInput.value = e.target.dataset.text;
      el.composerInput.focus();
    });
  });

  // Composer event keys
  el.composerInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendPrompt();
    }
  });

  el.sendPromptBtn.addEventListener("click", () => handleSendPrompt());

  // RUN MAIN SETUP INITIALIZATIONS
  initUI();
});
