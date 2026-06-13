/* RSI Agent Laboratory UI Orchestration & Controller */

document.addEventListener("DOMContentLoaded", () => {
  // Initialize Core Agents & Charts
  const agent = new RSIAgent();
  const radarChart = new CritiqueRadarChart("radarCanvas");
  const flowVisualizer = new NeuralFlowVisualizer("networkCanvas");

  // Start continuous rendering loops
  radarChart.startAnimateLoop();
  flowVisualizer.startAnimateLoop();

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
    overrideClarity: document.getElementById("overrideClarity")
  };

  // State Management
  let isProcessing = false;
  let activeMemoryTab = "semantic"; // semantic or episodic
  let lastEvaluatedTurnIndex = null; // tracking turn for manual override

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
    // Populate code editor with DEFAULT HEURISTICS
    el.codeTextarea.value = JSON.stringify(agent.promptManager.activeHeuristics, null, 2);
    updateLineNumbers();

    // Reset components UI
    updateTelemetry();
    updateCritiqueBars([60, 60, 60, 60]);
    updateStrategyWeightsUI();
    renderMemoryList();

    // Welcome Messages
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

    // Update settings sliders to match backend variables
    el.tempSlider.value = agent.temperature;
    el.tempVal.textContent = agent.temperature.toFixed(1);
    el.retrievalDepth.value = agent.retrievalDepth;
    el.depthVal.textContent = agent.retrievalDepth;
    el.learningRate.value = agent.learningRate;
    el.lrVal.textContent = agent.learningRate.toFixed(2);
  };

  const updateCritiqueBars = (values) => {
    // values = [helpfulness, toneMatch, reasoningDepth, heuristicClarity]
    el.barHelpfulness.style.width = `${values[0]}%`;
    el.barTone.style.width = `${values[1]}%`;
    el.barReasoning.style.width = `${values[2]}%`;
    el.barClarity.style.width = `${values[3]}%`;

    el.lblHelpfulness.textContent = `${values[0]}%`;
    el.lblTone.textContent = `${values[1]}%`;
    el.lblReasoning.textContent = `${values[2]}%`;
    el.lblClarity.textContent = `${values[3]}%`;

    // Redraw Radar Chart with target coordinates
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

  // Helper: Append lines to step-by-step thinking trace logger
  const logTrace = (node, msg) => {
    const line = document.createElement("div");
    line.className = `trace-line ${node}`;
    line.textContent = `[${node.toUpperCase()}] ${msg}`;
    el.thoughtLog.appendChild(line);
    el.thoughtLog.scrollTop = el.thoughtLog.scrollHeight;
  };

  // Helper: Render Chat Message Node
  const addChatMessage = (text, role, critiqueScores = null, turnIdx = null) => {
    const msgNode = document.createElement("div");
    msgNode.className = `message ${role}`;
    msgNode.textContent = text;

    // If assistant reply contains critique metrics, render a manual tuning selector link
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
  };

  // Custom typing delay node
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

  // EXECUTE USER PROMPT PIPELINE
  const handleSendPrompt = async () => {
    const rawText = el.composerInput.value.trim();
    if (!rawText || isProcessing) return;

    isProcessing = true;
    playSound("click");
    el.composerInput.value = "";
    el.sendPromptBtn.disabled = true;

    // Add user question to layout
    addChatMessage(rawText, "user");

    // Show loading indicators
    showTyping();
    el.thoughtLog.innerHTML = ""; // Clear trace terminal
    el.thoughtLogContainer.classList.add("expanded");

    // Execute synchronous processing backend to fetch logs and scores immediately
    const execution = await agent.processQuery(rawText);

    // Coordinate the visualizer node highlight sequence according to traces
    let currentTraceIdx = 0;
    const isMutationExpected = !!execution.mutation;

    await flowVisualizer.runPipelineTrace(isMutationExpected, (activeNode) => {
      // Coordinate corresponding step logs into terminal when visual nodes light up
      while (currentTraceIdx < execution.traces.length) {
        const item = execution.traces[currentTraceIdx];
        if (item.node === activeNode || (activeNode === "memory" && item.node === "system") || (activeNode === "perception" && item.node === "system")) {
          logTrace(item.node, item.msg);
          currentTraceIdx++;
        } else {
          break; // Let other segments coordinate arrivals
        }
      }
    });

    // Clean remaining traces
    while (currentTraceIdx < execution.traces.length) {
      const item = execution.traces[currentTraceIdx];
      logTrace(item.node, item.msg);
      currentTraceIdx++;
    }

    // Process Complete: Update Telemetry and Chart Values
    removeTyping();
    playSound(isMutationExpected ? "mutate" : "complete");

    // Output answer bubble
    addChatMessage(execution.response, "agent", execution.critique, agent.turns);

    // Update Telemetry stats
    updateTelemetry();
    updateCritiqueBars([
      execution.critique.helpfulness,
      execution.critique.toneMatch,
      execution.critique.reasoningDepth,
      execution.critique.heuristicClarity
    ]);
    updateStrategyWeightsUI();
    renderMemoryList();

    // If a prompt mutation occurred, render diff template in Prompt Diff tab
    if (execution.mutation) {
      addChatMessage(`System mutation logged under version ${execution.mutation.version}: ${execution.mutation.description}`, "reflection");
      renderDiffViewer(execution.mutation);
      populateMutationSelector();
    }

    el.sendPromptBtn.disabled = false;
    isProcessing = false;
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

    // Inject manual override critique scores back to specific episodic node
    const episode = agent.memory.episodic.find(ep => ep.turn === lastEvaluatedTurnIndex);
    if (episode) {
      episode.critique = overriddenScores;
    }

    el.thoughtLog.innerHTML = "";
    logTrace("critic", `Manual critique override received for Turn ${lastEvaluatedTurnIndex}.`);
    logTrace("critic", `Injecting scores: Helpfulness=${overriddenScores.helpfulness}%, Tone Match=${overriddenScores.toneMatch}%, Reasoning Depth=${overriddenScores.reasoningDepth}%, Clarity=${overriddenScores.heuristicClarity}%`);

    // Force agent adjustments
    agent.adjustWeights(overriddenScores, agent.learningRate);
    updateStrategyWeightsUI();

    // Check if mutation threshold triggered
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
      renderDiffViewer(mutation);
      populateMutationSelector();
      
      // Focus Prompt Diff tab to show user the changes
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
    
    // Add header line
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
    
    // Default base state option
    const baseOpt = document.createElement("option");
    baseOpt.value = "base";
    baseOpt.textContent = "v1.0.0 (Base Prompt System)";
    el.diffVerSelector.appendChild(baseOpt);

    // List historical mutations
    agent.promptManager.mutationsLog.forEach((m, idx) => {
      const opt = document.createElement("option");
      opt.value = String(idx);
      opt.textContent = `${m.version} (${m.description.substring(0, 30)}...)`;
      el.diffVerSelector.appendChild(opt);
    });

    // Select latest
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

  // Sync scroll line numbers and editor box
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
      
      renderDiffViewer(result.logEntry);
      populateMutationSelector();
      updateTelemetry();
      
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
    isProcessing = false;
    playSound("complete");
  });

  // Reset System
  el.hardResetBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to restore factory defaults? This clears memory vaults, prompt versions, and strategies weights.")) {
      playSound("click");
      agent.reset();
      el.messagesContainer.innerHTML = "";
      el.thoughtLog.innerHTML = "";
      initUI();
    }
  });

  // Sidebar controls
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

  // Heuristics editor buttons
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

    addChatMessage(`Forced prompt mutation applied under version ${mut.version}: ${mut.description}`, "reflection");
    renderDiffViewer(mut);
    populateMutationSelector();
    updateTelemetry();
    switchTab("diff-tab");
  });

  // Diff selector version changes
  el.diffVerSelector.addEventListener("change", (e) => {
    playSound("click");
    const val = e.target.value;
    if (val === "base") {
      // Create a dummy base diff representing original prompt
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

  el.sendPromptBtn.addEventListener("click", handleSendPrompt);

  // RUN MAIN SETUP INITIALIZATIONS
  initUI();
});
