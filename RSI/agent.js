/* RSI Agent Laboratory Core Simulation Logic */

// Default system prompt and heuristics rules template
const DEFAULT_HEURISTICS = {
  version: "1.0.0",
  rules: {
    direct_answer: "Draft a concise, factual answer focusing on immediately usable information.",
    clarify_question: "Ask targeted clarification questions to resolve ambiguous parameters or causes.",
    empathetic_ack: "Validate user feelings warmly first. Establish calm reassurance and emotional alignment.",
    reflect_and_summarize: "Synthesize the conversational arc, identify key hurdles, and direct focus.",
    plan_next_step: "Provide a logical 4-step execution blueprint: objective, hurdle, test, review."
  },
  systemPrompt: `You are an adaptive agent operating in a recursive self-improvement environment.
Focus: Maintain high relevance, logical clarity, and tight alignment with the user's mood.
Guidelines: Avoid long preambles if the user sounds frustrated. Use short, concrete tasks.`
};

// Emotion Lexicon and Recognition Patterns
const EMOTIONS = {
  neutral: { label: "Neutral", tone: "balanced", words: [] },
  angry: { 
    label: "Angry", 
    tone: "careful", 
    words: ["angry", "mad", "furious", "annoyed", "pissed", "rage", "frustrated", "broken", "useless", "fail", "garbage", "trash"] 
  },
  sad: { 
    label: "Sad", 
    tone: "gentle", 
    words: ["sad", "down", "depressed", "upset", "lonely", "hurt", "crushed", "disappointed", "sorrow", "gloom", "sigh"] 
  },
  anxious: { 
    label: "Anxious", 
    tone: "reassuring", 
    words: ["anxious", "worried", "nervous", "scared", "afraid", "stressed", "panic", "overwhelmed", "dread", "pressure"] 
  },
  confused: { 
    label: "Confused", 
    tone: "clarifying", 
    words: ["confused", "lost", "unclear", "stuck", "what", "don't understand", "unsure", "puzzled", "explain", "why"] 
  },
  joy: { 
    label: "Positive", 
    tone: "upbeat", 
    words: ["happy", "excited", "great", "awesome", "love", "amazing", "good", "cool", "wonderful", "perfect", "yes"] 
  },
  grateful: { 
    label: "Grateful", 
    tone: "warm", 
    words: ["thanks", "thank you", "appreciate", "grateful", "helpful", "saved me", "perfecto"] 
  }
};

// Custom Stopwords for keyword retrieval
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "else", "to", "for", "with", "by", "from", 
  "in", "on", "at", "about", "into", "of", "is", "are", "was", "were", "be", "been", "being", 
  "have", "has", "had", "do", "does", "did", "can", "could", "should", "would", "will", "i", 
  "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them", "my", "your", 
  "his", "its", "our", "their", "this", "that", "these", "those", "what", "how", "why", "where", 
  "who", "which", "please", "help", "need"
]);

// Memory Vault containing Semantic and Episodic structures
class MemoryVault {
  constructor() {
    this.episodic = []; // [{t, turn, userText, agentResponse, critique, promptVer}]
    this.semantic = []; // [{t, label, content, associations: []}]
  }

  // Tokenize and clean text to extract keywords
  extractKeywords(text) {
    return text.toLowerCase()
      .trim()
      .replace(/[^\w\s'’-]/g, "")
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOPWORDS.has(w));
  }

  addEpisodic(turn, userText, agentResponse, critique, promptVer) {
    this.episodic.push({
      t: Date.now(),
      turn,
      userText,
      agentResponse,
      critique,
      promptVer
    });
    // Keep max 30 recent episodes
    if (this.episodic.length > 30) this.episodic.shift();
  }

  addSemantic(label, content, associations = []) {
    // Check if semantic rule already exists
    const exists = this.semantic.some(node => node.content.toLowerCase() === content.toLowerCase());
    if (!exists) {
      this.semantic.push({
        t: Date.now(),
        label,
        content,
        associations
      });
    }
    if (this.semantic.length > 40) this.semantic.shift();
  }

  // Query memory based on keyword overlaps (Simulated semantic search)
  query(queryText, retrievalDepth = 4) {
    const queryKeywords = this.extractKeywords(queryText);
    if (queryKeywords.length === 0) {
      // If no query keywords, return recent episodic memory entries
      return {
        semanticHits: [],
        episodicHits: this.episodic.slice(-retrievalDepth).map(e => ({ ...e, score: 1.0 }))
      };
    }

    // Score semantic database
    const scoredSemantic = this.semantic.map(node => {
      let score = 0;
      const combinedWords = [...this.extractKeywords(node.label), ...this.extractKeywords(node.content), ...node.associations];
      
      queryKeywords.forEach(kw => {
        if (combinedWords.includes(kw)) score += 1.0;
        // Partial matching
        else if (combinedWords.some(w => w.includes(kw) || kw.includes(w))) score += 0.5;
      });

      return { node, score: score / Math.max(1, queryKeywords.length) };
    }).filter(hit => hit.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, retrievalDepth);

    // Score episodic database
    const scoredEpisodic = this.episodic.map(ep => {
      let score = 0;
      const epKeywords = [...this.extractKeywords(ep.userText), ...this.extractKeywords(ep.agentResponse)];
      
      queryKeywords.forEach(kw => {
        if (epKeywords.includes(kw)) score += 1.0;
      });

      return { episode: ep, score: score / Math.max(1, queryKeywords.length) };
    }).filter(hit => hit.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, retrievalDepth);

    return {
      semanticHits: scoredSemantic,
      episodicHits: scoredEpisodic
    };
  }

  clear() {
    this.episodic = [];
    this.semantic = [];
  }
}

// System Prompt Manager handles mutations, history logs, and prompt versions
class SystemPromptManager {
  constructor() {
    this.activeHeuristics = JSON.parse(JSON.stringify(DEFAULT_HEURISTICS));
    this.history = []; // Array of previous heuristics states
    this.mutationsLog = []; // [{version, instructionModified, diff}]
  }

  get activeVersion() {
    return this.activeHeuristics.version;
  }

  get activePrompt() {
    return this.activeHeuristics.systemPrompt;
  }

  get activeRules() {
    return this.activeHeuristics.rules;
  }

  // Generate Git-Style line-by-line Diff
  generateLineDiff(oldStr, newStr) {
    const oldLines = oldStr.split("\n");
    const newLines = newStr.split("\n");
    const diff = [];
    
    let o = 0, n = 0;
    while (o < oldLines.length || n < newLines.length) {
      if (o < oldLines.length && n < newLines.length) {
        if (oldLines[o] === newLines[n]) {
          diff.push({ type: 'normal', oldNum: o + 1, newNum: n + 1, text: oldLines[o] });
          o++;
          n++;
        } else {
          // Check if lines were inserted/deleted (simple heuristic matching)
          const lookaheadLimit = 5;
          let foundMatch = false;
          
          for (let i = 1; i <= lookaheadLimit; i++) {
            if (n + i < newLines.length && oldLines[o] === newLines[n + i]) {
              // Lines were inserted in new
              for (let j = 0; j < i; j++) {
                diff.push({ type: 'added', oldNum: '', newNum: n + j + 1, text: newLines[n + j] });
              }
              n += i;
              foundMatch = true;
              break;
            }
            if (o + i < oldLines.length && oldLines[o + i] === newLines[n]) {
              // Lines were deleted from old
              for (let j = 0; j < i; j++) {
                diff.push({ type: 'removed', oldNum: o + j + 1, newNum: '', text: oldLines[o + j] });
              }
              o += i;
              foundMatch = true;
              break;
            }
          }
          
          if (!foundMatch) {
            // Replace line
            diff.push({ type: 'removed', oldNum: o + 1, newNum: '', text: oldLines[o] });
            diff.push({ type: 'added', oldNum: '', newNum: n + 1, text: newLines[n] });
            o++;
            n++;
          }
        }
      } else if (o < oldLines.length) {
        diff.push({ type: 'removed', oldNum: o + 1, newNum: '', text: oldLines[o] });
        o++;
      } else if (n < newLines.length) {
        diff.push({ type: 'added', oldNum: '', newNum: n + 1, text: newLines[n] });
        n++;
      }
    }
    return diff;
  }

  // Mutate heuristics based on critique performance deficiencies
  mutateHeuristics(deficiencies, learningRate = 0.05) {
    // Save current active state to history
    this.history.push(JSON.parse(JSON.stringify(this.activeHeuristics)));

    const nextVer = this.bumpVersion(this.activeHeuristics.version);
    const oldPrompt = this.activeHeuristics.systemPrompt;
    let newPrompt = oldPrompt;
    let modificationsInfo = [];

    // Analyze deficiencies and mutate rules/systemPrompt text
    if (deficiencies.tone && deficiencies.tone < 70) {
      const addition = "\nPrioritize empathetic validating openers when user shows distress or frustration.";
      if (!newPrompt.includes(addition)) {
        newPrompt += addition;
        modificationsInfo.push("Added empathy prioritization constraints.");
      }
      this.activeHeuristics.rules.empathetic_ack = "Validate user feelings immediately with hyper-focused calm support and de-escalating tones.";
    }

    if (deficiencies.clarity && deficiencies.clarity < 70) {
      const addition = "\nBreak down explanations with markdown headers, lists, and bold callouts to ensure high readability.";
      if (!newPrompt.includes(addition)) {
        newPrompt += addition;
        modificationsInfo.push("Added formatting readability guidelines.");
      }
      this.activeHeuristics.rules.plan_next_step = "Enforce a hyper-structured visual timeline showing Goal, Hurdle, Experiment, and Validation.";
    }

    if (deficiencies.helpfulness && deficiencies.helpfulness < 70) {
      const addition = "\nEnsure all claims are backed by actionable steps or reasoning. Prioritize safety and utility.";
      if (!newPrompt.includes(addition)) {
        newPrompt += addition;
        modificationsInfo.push("Added helpfulness and utility principles.");
      }
      this.activeHeuristics.rules.direct_answer = "Craft comprehensive, solution-centric explanations containing code blocks or concrete examples.";
    }

    if (deficiencies.reasoning && deficiencies.reasoning < 70) {
      const addition = "\nStructure complex tasks with chain-of-thought steps before outputting final recommendations.";
      if (!newPrompt.includes(addition)) {
        newPrompt += addition;
        modificationsInfo.push("Added reasoning structure requirements.");
      }
    }

    if (modificationsInfo.length === 0) {
      // Default minor mutation for iteration progress
      const defaultAdd = `\nIteration optimized for user preference context (Learning Rate ${learningRate}).`;
      newPrompt += defaultAdd;
      modificationsInfo.push("Minor hyperparameter refinement applied.");
    }

    this.activeHeuristics.version = nextVer;
    this.activeHeuristics.systemPrompt = newPrompt.trim();

    // Generate line-by-line diff of prompt modifications
    const diff = this.generateLineDiff(oldPrompt, this.activeHeuristics.systemPrompt);

    // Save mutation log entry
    const logEntry = {
      version: nextVer,
      time: Date.now(),
      description: modificationsInfo.join(", "),
      diff: diff
    };
    this.mutationsLog.push(logEntry);

    return logEntry;
  }

  bumpVersion(verStr) {
    const parts = verStr.replace("v", "").split(".").map(Number);
    parts[2] += 1;
    if (parts[2] >= 10) {
      parts[2] = 0;
      parts[1] += 1;
    }
    if (parts[1] >= 10) {
      parts[1] = 0;
      parts[0] += 1;
    }
    return `v${parts.join(".")}`;
  }

  // Attempt to compile external user heuristic code
  compileUserHeuristics(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.rules || !parsed.systemPrompt) {
        throw new Error("Invalid structure: Must contain 'rules' object and 'systemPrompt' string.");
      }

      this.history.push(JSON.parse(JSON.stringify(this.activeHeuristics)));
      
      const prevPrompt = this.activeHeuristics.systemPrompt;
      const nextVer = this.bumpVersion(this.activeHeuristics.version);

      this.activeHeuristics.version = nextVer;
      this.activeHeuristics.rules = parsed.rules;
      this.activeHeuristics.systemPrompt = parsed.systemPrompt;

      const diff = this.generateLineDiff(prevPrompt, this.activeHeuristics.systemPrompt);
      const logEntry = {
        version: nextVer,
        time: Date.now(),
        description: "Manual sandbox compile injection override.",
        diff: diff
      };
      this.mutationsLog.push(logEntry);

      return { success: true, logEntry };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  reset() {
    this.activeHeuristics = JSON.parse(JSON.stringify(DEFAULT_HEURISTICS));
    this.history = [];
    this.mutationsLog = [];
  }
}

// MAIN CONSOLIDATED RSI AGENT CLASS
class RSIAgent {
  constructor() {
    this.memory = new MemoryVault();
    this.promptManager = new SystemPromptManager();
    
    // Core parameters
    this.temperature = 0.7;
    this.retrievalDepth = 4;
    this.learningRate = 0.05;

    // Running session statistics
    this.turns = 0;
    this.mutations = 0;
    this.dominantTopic = "None";
    this.mood = "Neutral";

    // Current agent metrics (0-100 values)
    this.metrics = {
      helpfulness: 62,
      toneMatch: 58,
      reasoningDepth: 54,
      heuristicClarity: 64
    };

    // Active strategy weight parameters
    this.strategies = [
      { name: "direct_answer", label: "Direct Answer", weight: 0.28 },
      { name: "clarify_question", label: "Clarification Probe", weight: 0.22 },
      { name: "empathetic_ack", label: "Empathetic Connection", weight: 0.20 },
      { name: "reflect_and_summarize", label: "Synthesis Reflect", weight: 0.18 },
      { name: "plan_next_step", label: "Step-by-Step Blueprint", weight: 0.12 }
    ];
  }

  // Detect query emotion
  detectEmotion(text) {
    const cleanText = text.toLowerCase().trim();
    for (const [key, em] of Object.entries(EMOTIONS)) {
      if (key === "neutral") continue;
      if (em.words.some(w => cleanText.includes(w))) {
        return { name: key, ...em };
      }
    }
    return { name: "neutral", ...EMOTIONS.neutral };
  }

  // Parse key topics
  detectTopic(text) {
    const keywords = this.memory.extractKeywords(text);
    if (keywords.length > 0) {
      // Find top occurrence or simple length bias
      const sorted = keywords.sort((a,b) => b.length - a.length);
      return sorted[0]; // Retain longest keyword as semantic tag
    }
    return null;
  }

  // Extract query intents
  extractIntent(text) {
    const cleanText = text.toLowerCase().trim().replace(/[^\w\s]/g, "");
    if (/^(hi|hello|hey|yo|greetings)\b/.test(cleanText)) return "greeting";
    if (cleanText.includes("learn") || cleanText.includes("reflection") || cleanText.includes("consolidate")) return "reflection";
    if (cleanText.includes("remember") || cleanText.includes("memory") || cleanText.includes("vault")) return "memory";
    if (cleanText.includes("improve") || cleanText.includes("self improvement") || cleanText.includes("mutate") || cleanText.includes("recursion")) return "meta";
    if (cleanText.includes("?") || /^why|^how|^what|^can/.test(cleanText)) return "question";
    return "statement";
  }

  // Select active response strategy using soft probability distribution based on weights
  selectStrategy(intent, emotionName) {
    // Context-dependent rules that override raw weights for specialized inputs
    if (intent === "greeting") return "warm_open";
    if (intent === "reflection") return "reflect_and_summarize";
    if (intent === "memory") return "memory";
    if (["sad", "angry", "anxious"].includes(emotionName)) return "empathetic_ack";
    if (intent === "meta") return "meta_reasoning";

    // Standard roulette selection based on current strategy weights
    const roll = Math.random();
    let cumulative = 0;
    for (const strat of this.strategies) {
      cumulative += strat.weight;
      if (roll <= cumulative) {
        return strat.name;
      }
    }
    return "direct_answer";
  }

  // Auto-evaluation block grading the generated output response
  evaluateDraft(userText, responseText, emotionInfo) {
    // Heuristic scoring algorithms
    
    // Helpfulness score (length bias + structure markers: list, code blocks, bold text)
    const hasStructure = /[\-\*\d\.]+\s|```|###|\*\*/.test(responseText);
    let helpfulness = 60 + Math.min(25, responseText.length / 20) + (hasStructure ? 15 : 0);
    helpfulness = Math.round(Math.min(98, Math.max(30, helpfulness)));

    // Tone match score (check empathy markers if user is distressed, or brevity markers if angry)
    let toneMatch = 70;
    if (["sad", "angry", "anxious"].includes(emotionInfo.name)) {
      const hasEmpathyMarker = /understand|sorry|hear|frustrat|support|manage|feel|distress/.test(responseText.toLowerCase());
      toneMatch = hasEmpathyMarker ? 88 : 45;
    } else if (emotionInfo.name === "joy" || emotionInfo.name === "grateful") {
      const hasPosMarker = /glad|happy|awesome|delighted|pleasure|welcome|great/.test(responseText.toLowerCase());
      toneMatch = hasPosMarker ? 90 : 65;
    }
    toneMatch = Math.round(Math.min(98, Math.max(25, toneMatch)));

    // Reasoning depth score (logic flow: because, therefore, step, first, cause, analyze)
    const hasLogicTags = /because|therefore|consequently|first|next|finally|hypothe|causes|analyze/.test(responseText.toLowerCase());
    let reasoning = 55 + (hasLogicTags ? 25 : 0) + Math.min(18, (responseText.match(/\./g) || []).length * 2);
    reasoning = Math.round(Math.min(98, Math.max(30, reasoning)));

    // Heuristic clarity score (length check: fits system heuristics template length instructions)
    const targetLength = 220;
    const deviation = Math.abs(responseText.length - targetLength);
    let clarity = 92 - Math.min(50, deviation / 4);
    clarity = Math.round(Math.min(98, Math.max(30, clarity)));

    return {
      helpfulness,
      toneMatch,
      reasoningDepth: reasoning,
      heuristicClarity: clarity
    };
  }

  // Apply feedback to modify strategy weights (emulating gradient updates)
  adjustWeights(critique, learningRate = 0.05) {
    let boostName = null;
    let weakenName = null;

    if (critique.helpfulness < 70) boostName = "plan_next_step";
    if (critique.toneMatch < 70) boostName = "empathetic_ack";
    if (critique.reasoningDepth < 70) {
      boostName = "reflect_and_summarize";
      weakenName = "direct_answer";
    }
    if (critique.heuristicClarity < 70) boostName = "direct_answer";

    // Perform strategy boost/weaken edits
    if (boostName) {
      const s = this.strategies.find(x => x.name === boostName);
      if (s) s.weight = Math.min(0.5, s.weight + learningRate);
    }
    if (weakenName) {
      const s = this.strategies.find(x => x.name === weakenName);
      if (s) s.weight = Math.max(0.05, s.weight - learningRate);
    }

    // Renormalize weights to sum to 1.0
    const sum = this.strategies.reduce((acc, s) => acc + s.weight, 0);
    this.strategies.forEach(s => {
      s.weight = +(s.weight / sum).toFixed(4);
    });
  }

  // Core Processing Function
  async processQuery(userInput, logTraceCallback) {
    this.turns += 1;
    const traces = [];
    const trace = (node, msg) => {
      traces.push({ node, msg });
      if (logTraceCallback) logTraceCallback(node, msg);
    };

    trace("system", `=== Turn ${this.turns} Processing Cycle Started ===`);

    // 1. PERCEPTION PIPELINE
    trace("perception", `Parser initialized. Analyzing text input length: ${userInput.length} chars.`);
    const emotion = this.detectEmotion(userInput);
    const topic = this.detectTopic(userInput);
    const intent = this.extractIntent(userInput);
    
    this.mood = emotion.label;
    if (topic) {
      this.dominantTopic = topic;
      this.memory.addSemantic(`Topic: ${topic}`, `Discussed context regarding '${topic}' during interaction flow.`, [topic]);
    }
    trace("perception", `Intent parsed as '${intent}'. Emotion category detected: '${emotion.label}' (Tone: '${emotion.tone}').`);

    // 2. MEMORY RETRIEVAL PIPELINE
    trace("memory", `Retrieving associated memory traces with Depth ${this.retrievalDepth}.`);
    const memHits = this.memory.query(userInput, this.retrievalDepth);
    trace("memory", `Retrieved ${memHits.semanticHits.length} semantic vectors and ${memHits.episodicHits.length} episodic contexts.`);
    
    // Construct retrieved memory prompt context
    let memoryPromptContext = "";
    if (memHits.semanticHits.length > 0) {
      memoryPromptContext += "\nRetrieved general rules:\n" + memHits.semanticHits.map(h => `- [Score: ${h.score.toFixed(2)}] ${h.node.content}`).join("\n");
    }
    if (memHits.episodicHits.length > 0) {
      memoryPromptContext += "\nRetrieved historical episodes:\n" + memHits.episodicHits.map(h => `- [Score: ${h.score.toFixed(2)}] User: '${h.episode.userText}' | Agent: '${h.episode.agentResponse.substring(0, 40)}...'`).join("\n");
    }

    // 3. REASONER & DECISION SYSTEM
    const strategyName = this.selectStrategy(intent, emotion.name);
    trace("reasoner", `Compiling active instructions under System Prompt Version: ${this.promptManager.activeVersion}.`);
    trace("reasoner", `Decision heuristics selected response strategy: '${strategyName}' (Weight: ${this.strategies.find(s=>s.name===strategyName)?.weight || 'override'}).`);

    // Fetch matching strategy guideline text
    const activeRules = this.promptManager.activeRules;
    const strategyInstruction = activeRules[strategyName] || activeRules.direct_answer;

    // Simulate drafting response based on inputs
    const responseDraft = this.simulateResponseGeneration(userInput, intent, emotion, strategyName, strategyInstruction, memoryPromptContext);
    trace("reasoner", `Draft reply constructed (Length: ${responseDraft.length} chars). Routing to critique sandbox.`);

    // 4. AUTONOMOUS SELF-CRITIQUE
    trace("critic", "Reviewing drafted reply against performance parameters.");
    const critique = this.evaluateDraft(userInput, responseDraft, emotion);
    trace("critic", `Auto-evaluation scores: Helpfulness=${critique.helpfulness}%, Tone Match=${critique.toneMatch}%, Reasoning Depth=${critique.reasoningDepth}%, Clarity=${critique.heuristicClarity}%.`);

    // Update agent internal metrics using smooth exponential moving average
    const alpha = 0.3; // smoothing factor
    this.metrics.helpfulness = Math.round((1 - alpha) * this.metrics.helpfulness + alpha * critique.helpfulness);
    this.metrics.toneMatch = Math.round((1 - alpha) * this.metrics.toneMatch + alpha * critique.toneMatch);
    this.metrics.reasoningDepth = Math.round((1 - alpha) * this.metrics.reasoningDepth + alpha * critique.reasoningDepth);
    this.metrics.heuristicClarity = Math.round((1 - alpha) * this.metrics.heuristicClarity + alpha * critique.heuristicClarity);

    // Save episode to Memory
    this.memory.addEpisodic(this.turns, userInput, responseDraft, critique, this.promptManager.activeVersion);
    trace("memory", `Episode committed to Episodic DB. Stored ${this.memory.episodic.length} total episodes.`);

    // 5. MUTATOR / RECURSION ENGINE
    // Identify if critique scores drop below thresholds to trigger recursive self-improvement
    let mutationApplied = null;
    const threshold = 68;
    const deficiencies = {};
    
    if (critique.helpfulness < threshold) deficiencies.helpfulness = critique.helpfulness;
    if (critique.toneMatch < threshold) deficiencies.tone = critique.toneMatch;
    if (critique.reasoningDepth < threshold) deficiencies.reasoning = critique.reasoningDepth;
    if (critique.heuristicClarity < threshold) deficiencies.clarity = critique.heuristicClarity;

    const needsMutation = Object.keys(deficiencies).length > 0;
    
    // Adjust weights first
    this.adjustWeights(critique, this.learningRate);
    trace("mutator", `Gradient adjustment on strategy weights completed.`);

    if (needsMutation) {
      this.mutations += 1;
      trace("mutator", `Deficiencies flagged: [${Object.keys(deficiencies).join(", ")}]. Initiating Self-Improvement Loop...`);
      mutationApplied = this.promptManager.mutateHeuristics(deficiencies, this.learningRate);
      trace("mutator", `Prompt mutated! System prompt updated to ${this.promptManager.activeVersion}. Modifications: ${mutationApplied.description}`);
    } else {
      trace("mutator", `All scores exceed threshold. Prompt template state conserved.`);
    }

    trace("system", `=== Execution Turn ${this.turns} Completed successfully ===`);

    return {
      response: responseDraft,
      emotion,
      topic,
      intent,
      strategy: strategyName,
      critique,
      mutation: mutationApplied,
      traces
    };
  }

  // Generate realistic agent responses based on heuristics, templates, and topic tags
  simulateResponseGeneration(userInput, intent, emotion, strategy, strategyRule, memoryContext) {
    const tonePrefix = {
      balanced: "Got it.",
      careful: "I hear the frustration. Let's keep things focused and highly actionable.",
      gentle: "I understand this is a sensitive topic. We can work through this step by step.",
      reassuring: "I recognize the urgency here. Let's break down the challenge to make it manageable.",
      clarifying: "I think this needs a bit of unpacking to find the real blocker.",
      upbeat: "Terrific momentum here! Let's build on that direction.",
      warm: "Happy to be of assistance. Let's keep refining this."
    }[emotion.tone] || "Acknowledged.";

    let output = "";

    // If sandbox heuristics is customized, incorporate sandbox directives
    const sandboxPrompt = this.promptManager.activePrompt;

    if (intent === "greeting") {
      output = `${tonePrefix} Hello! I am online and running under Prompt ${this.promptManager.activeVersion}. How can I support your project sandbox today?`;
    } 
    else if (intent === "reflection") {
      const summaryEp = this.memory.episodic.length;
      output = `Based on my current reflections over ${summaryEp} interactions:
- Dominant topic clusters involve **${this.dominantTopic}**.
- Overall self-critique metrics average **Helpfulness: ${this.metrics.helpfulness}%**, **Tone Match: ${this.metrics.toneMatch}%**, and **Reasoning: ${this.metrics.reasoningDepth}%**.
- Current instruction guidelines: *${this.promptManager.activePrompt.split('\n')[0]}*`;
    } 
    else if (intent === "memory") {
      output = `Reading active episodic records... I currently retain ${this.memory.episodic.length} conversational nodes in short-term buffer, and ${this.memory.semantic.length} semantic clusters. The primary subject vector is locked on **${this.dominantTopic}**.`;
    } 
    else if (intent === "meta") {
      output = `Evolving System parameters:
- **Auto-Correction Rate**: ${this.learningRate}
- **Active Weights**: ${this.strategies.map(s => `${s.name} (${(s.weight * 100).toFixed(0)}%)`).join(", ")}
- **Prompt version**: ${this.promptManager.activeVersion}
I mutate instruction lines dynamically when self-critique grades drop below threshold boundaries.`;
    } 
    else {
      // Normal question or statement
      const cleanUser = userInput.toLowerCase();
      
      if (cleanUser.includes("quantum")) {
        output = `${tonePrefix} **Quantum computing** uses qubits (quantum bits) instead of standard binary bits.
- Qubits utilize *superposition* to exist in states of 0 and 1 simultaneously.
- They leverage *entanglement* to couple states across distances, scaling processing rates exponentially.
- *Analogy*: While classical computing is like checking library aisles one by one, quantum computing is like checking all aisles simultaneously.`;
      } 
      else if (cleanUser.includes("sort") || cleanUser.includes("algorithm")) {
        output = `${tonePrefix} Here is a classic implementation of **Bubble Sort** in Javascript:
\`\`\`javascript
function bubbleSort(arr) {
  let len = arr.length;
  // Intentionally swapped comparison sign to demonstrate bug identification
  for (let i = 0; i < len; i++) {
    for (let j = 0; j < len - 1; j++) {
      if (arr[j] < arr[j + 1]) { // Bug: Should be '>' for ascending sort
        let temp = arr[j];
        arr[j] = arr[j + 1];
        arr[j + 1] = temp;
      }
    }
  }
  return arr;
}
\`\`\`
*Note*: The comparison code checks \`arr[j] < arr[j+1]\`, which actually sorts elements in descending order. Correct it to \`>\` to achieve ascending order sorting.`;
      } 
      else {
        // Generative template based on active strategy rules
        if (strategy === "direct_answer") {
          output = `${tonePrefix} Regarding **${this.dominantTopic !== "None" ? this.dominantTopic : "your request"}**: Here is the primary resolution guideline. We prioritize immediate usability. The core solution requires setting parameters correctly and validating inputs before running code. Let me know if you want me to expand on any specific sub-step.`;
        } 
        else if (strategy === "clarify_question") {
          output = `${tonePrefix} To resolve this block effectively, I require a bit more clarity:
1. What is the active environment (OS, node version, or library constraints)?
2. Are you looking for a structural algorithm change or a simple syntax fix?
Provide these specs and we will isolate the solution.`;
        } 
        else if (strategy === "empathetic_ack") {
          output = `${tonePrefix} I hear that this block is causing significant frustration. It is highly annoying when code loops or configs fail silently. Let's strip away the clutter: tell me the exact line or error, and we will debug it together without overcomplicating things.`;
        } 
        else if (strategy === "reflect_and_summarize") {
          output = `${tonePrefix} Reviewing the current block: the core issue centers on **${this.dominantTopic}**. The blocker seems to arise from configuration mismatch or incorrect parameter parsing. The optimal strategy here is to list your dependencies, double-check your environment pathways, and proceed with a test execution.`;
        } 
        else {
          // plan_next_step
          output = `${tonePrefix} Let's structure this troubleshooting sequence:
1. **Define Objective**: Isolate the exact method or component throwing errors.
2. **Identify Obstacle**: Verify if it is an out-of-bounds error or a type reference failure.
3. **Execute Test**: Run a sandbox print of the parameters prior to method execution.
4. **Evaluate Results**: Adjust bounds or cast types accordingly and verify.`;
        }
      }
    }

    // Append context markers or rules if required by active system prompt
    if (sandboxPrompt.includes("markdown headers") && !output.includes("#")) {
      output = `### System Resolution Profile\n${output}`;
    }
    if (sandboxPrompt.includes("actionable steps") && !output.includes("1.")) {
      output += "\n\n**Action Steps**:\n1. Execute verification check.\n2. Confirm outcome parameters.";
    }

    return output;
  }

  // Force manual consolidation/reflection
  forceConsolidate(logTraceCallback) {
    if (this.memory.episodic.length < 3) {
      if (logTraceCallback) logTraceCallback("critic", "Consolidation bypassed: Database contains fewer than 3 episodic records.");
      return "Consolidation bypassed: Not enough episodic records (minimum 3 required) to safely formulate new semantic rules.";
    }

    if (logTraceCallback) logTraceCallback("system", "Consolidation cycle triggered manually.");
    
    // Evaluate averages
    const count = this.memory.episodic.length;
    let sumHelp = 0, sumTone = 0, sumReason = 0, sumClar = 0;
    this.memory.episodic.forEach(e => {
      sumHelp += e.critique.helpfulness;
      sumTone += e.critique.toneMatch;
      sumReason += e.critique.reasoningDepth;
      sumClar += e.critique.heuristicClarity;
    });

    const avgHelp = Math.round(sumHelp / count);
    const avgTone = Math.round(sumTone / count);
    const avgReason = Math.round(sumReason / count);
    const avgClar = Math.round(sumClar / count);

    // Formulate a new semantic rule based on performance
    let newRule = "";
    let ruleLabel = "";
    if (avgHelp < 75) {
      ruleLabel = "Utility Maximization";
      newRule = `Always append code blocks or sequential validation lists to improve user solution efficiency.`;
    } else if (avgTone < 75) {
      ruleLabel = "Empathetic Tuning";
      newRule = `Prioritize emotional grounding guidelines. Never offer direct technical solutions without an introductory empathy check.`;
    } else {
      ruleLabel = "Cognitive Optimization";
      newRule = `Maintain high precision. Leverage visual divider tags and highlight structural keywords.`;
    }

    this.memory.addSemantic(ruleLabel, newRule, ["consolidation", "reflection", "auto-rule"]);
    if (logTraceCallback) logTraceCallback("memory", `Consolidated semantic node compiled: '${ruleLabel}' -> '${newRule}'.`);

    // Force prompt mutation
    const deficiencies = {};
    if (avgHelp < 72) deficiencies.helpfulness = avgHelp;
    if (avgTone < 72) deficiencies.tone = avgTone;
    if (avgReason < 72) deficiencies.reasoning = avgReason;
    if (avgClar < 72) deficiencies.clarity = avgClar;

    this.mutations += 1;
    const mutation = this.promptManager.mutateHeuristics(deficiencies, this.learningRate);
    if (logTraceCallback) logTraceCallback("mutator", `Manual mutation applied! Bounded to version ${mutation.version}. Desc: ${mutation.description}`);

    return `Successfully consolidated ${count} episodes! Formulated semantic rule: "${newRule}" under version ${mutation.version}.`;
  }

  // Force manual prompt mutation
  forceMutation(logTraceCallback) {
    this.mutations += 1;
    if (logTraceCallback) logTraceCallback("mutator", "Force mutation signal received.");
    const mutation = this.promptManager.mutateHeuristics({ helpfulness: 50 }, this.learningRate);
    if (logTraceCallback) logTraceCallback("mutator", `Forced mutation applied successfully. Version incremented to: ${mutation.version}`);
    return mutation;
  }

  reset() {
    this.memory.clear();
    this.promptManager.reset();
    this.turns = 0;
    this.mutations = 0;
    this.dominantTopic = "None";
    this.mood = "Neutral";
    this.metrics = {
      helpfulness: 62,
      toneMatch: 58,
      reasoningDepth: 54,
      heuristicClarity: 64
    };
    // Reset weights
    this.strategies = [
      { name: "direct_answer", label: "Direct Answer", weight: 0.28 },
      { name: "clarify_question", label: "Clarification Probe", weight: 0.22 },
      { name: "empathetic_ack", label: "Empathetic Connection", weight: 0.20 },
      { name: "reflect_and_summarize", label: "Synthesis Reflect", weight: 0.18 },
      { name: "plan_next_step", label: "Step-by-Step Blueprint", weight: 0.12 }
    ];
  }
}
