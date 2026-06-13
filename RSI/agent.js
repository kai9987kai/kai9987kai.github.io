/* RSI Agent Laboratory Core Simulation Logic */

// Emotion Lexicon and Recognition Patterns
const EMOTIONS = {
  neutral: { label: "Neutral", tone: "balanced", valence: 0.5, words: [] },
  angry: { 
    label: "Angry", 
    tone: "careful", 
    valence: 0.15,
    words: ["angry", "mad", "furious", "annoyed", "pissed", "rage", "frustrated", "broken", "useless", "fail", "garbage", "trash"] 
  },
  sad: { 
    label: "Sad", 
    tone: "gentle", 
    valence: 0.3,
    words: ["sad", "down", "depressed", "upset", "lonely", "hurt", "crushed", "disappointed", "sorrow", "gloom", "sigh"] 
  },
  anxious: { 
    label: "Anxious", 
    tone: "reassuring", 
    valence: 0.4,
    words: ["anxious", "worried", "nervous", "scared", "afraid", "stressed", "panic", "overwhelmed", "dread", "pressure"] 
  },
  confused: { 
    label: "Confused", 
    tone: "clarifying", 
    valence: 0.45,
    words: ["confused", "lost", "unclear", "stuck", "what", "don't understand", "unsure", "puzzled", "explain", "why"] 
  },
  joy: { 
    label: "Positive", 
    tone: "upbeat", 
    valence: 0.8,
    words: ["happy", "excited", "great", "awesome", "love", "amazing", "good", "cool", "wonderful", "perfect", "yes"] 
  },
  grateful: { 
    label: "Grateful", 
    tone: "warm", 
    valence: 0.9,
    words: ["thanks", "thank you", "appreciate", "grateful", "helpful", "saved me", "perfecto"] 
  }
};

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

// 1. MULTI-RESOLUTION SEMANTIC HASH GRID (Simulating Instant NGP Spatial Encoding)
class MultiResolutionHashGrid {
  constructor() {
    this.levels = 3; // L=3 grid resolution levels
    this.resolutions = [4, 8, 16]; // N_l resolutions for coarse, medium, fine grids
    this.tableSize = 32; // Hash Table size T
    
    // Large prime constants for spatial hash indexing
    this.pi1 = 2654435761;
    this.pi2 = 805459861;

    // Initialize hash tables with small randomized feature weights
    this.hashTables = [];
    for (let l = 0; l < this.levels; l++) {
      const table = [];
      for (let i = 0; i < this.tableSize; i++) {
        table.push(+(Math.random() * 0.2 - 0.1).toFixed(4));
      }
      this.hashTables.push(table);
    }
  }

  // Hash coordinates into a single table index
  hashIndex(cx, cy) {
    return Math.abs((cx * this.pi1) ^ (cy * this.pi2)) % this.tableSize;
  }

  // Query coordinate mapping (x, y between 0 and 1)
  query(x, y) {
    const coords = { x: Math.max(0.01, Math.min(0.99, x)), y: Math.max(0.01, Math.min(0.99, y)) };
    const gridActivation = []; // Store active grid data for visualizer
    let totalFeatureValue = 0;

    for (let l = 0; l < this.levels; l++) {
      const N = this.resolutions[l];
      
      // Calculate float grid coordinates
      const gx = coords.x * (N - 1);
      const gy = coords.y * (N - 1);

      // Determine corner integer grid coordinates
      const x0 = Math.floor(gx);
      const x1 = Math.min(N - 1, x0 + 1);
      const y0 = Math.floor(gy);
      const y1 = Math.min(N - 1, y0 + 1);

      // Compute fractional distance for interpolation
      const fx = gx - x0;
      const fy = gy - y0;

      // Hash indexes for the four corners
      const h00 = this.hashIndex(x0, y0);
      const h10 = this.hashIndex(x1, y0);
      const h01 = this.hashIndex(x0, y1);
      const h11 = this.hashIndex(x1, y1);

      // Retrieve corner parameter weights
      const table = this.hashTables[l];
      const w00 = table[h00];
      const w10 = table[h10];
      const w01 = table[h01];
      const w11 = table[h11];

      // Perform bilinear interpolation
      const w0 = w00 * (1 - fx) + w10 * fx;
      const w1 = w01 * (1 - fx) + w11 * fx;
      const interpolatedVal = w0 * (1 - fy) + w1 * fy;

      totalFeatureValue += interpolatedVal;

      // Log activation coordinates for canvas rendering
      gridActivation.push({
        level: l,
        resolution: N,
        gx, gy,
        corners: [
          { cx: x0, cy: y0, hash: h00, weight: w00 },
          { cx: x1, cy: y0, hash: h10, weight: w10 },
          { cx: x0, cy: y1, hash: h01, weight: w01 },
          { cx: x1, cy: y1, hash: h11, weight: w11 }
        ],
        interpolatedVal
      });
    }

    return {
      x: coords.x,
      y: coords.y,
      featureVal: +totalFeatureValue.toFixed(4),
      activations: gridActivation
    };
  }
}

// 2. Q-LEARNING REINFORCEMENT LEARNING ENGINE (Agent Strategy Optimization)
class QLearningEngine {
  constructor() {
    this.emotions = ["neutral", "angry", "sad", "anxious", "confused", "joy", "grateful"]; // 7 states
    this.intents = ["greeting", "reflection", "memory", "support", "question", "statement"]; // 6 states
    this.numStates = this.emotions.length * this.intents.length; // 42 total States

    this.actions = [
      { name: "direct_answer", label: "Direct Answer" },
      { name: "clarify_question", label: "Clarification Probe" },
      { name: "empathetic_ack", label: "Empathetic Connection" },
      { name: "reflect_and_summarize", label: "Synthesis Reflect" },
      { name: "plan_next_step", label: "Step-by-Step Blueprint" }
    ]; // 5 actions

    this.alpha = 0.2; // Learning Rate
    this.gamma = 0.8; // Discount Factor
    this.epsilon = 0.15; // Exploration Rate (for e-greedy strategy)

    // Initialize 42x5 Q-Table with zeros
    this.qTable = [];
    for (let s = 0; s < this.numStates; s++) {
      const row = [];
      for (let a = 0; a < this.actions.length; a++) {
        row.push(0.0);
      }
      this.qTable.push(row);
    }
  }

  // Get index from state parameters
  getStateIndex(emotionName, intentName) {
    const emotionIdx = this.emotions.indexOf(emotionName);
    const intentIdx = this.intents.indexOf(intentName);
    
    // Fallback safe index check
    const safeEmotionIdx = emotionIdx !== -1 ? emotionIdx : 0;
    const safeIntentIdx = intentIdx !== -1 ? intentIdx : 5;

    return safeEmotionIdx * this.intents.length + safeIntentIdx;
  }

  // Decouple index back to descriptive state strings
  getStateDescription(stateIdx) {
    const eIdx = Math.floor(stateIdx / this.intents.length);
    const iIdx = stateIdx % this.intents.length;
    return {
      emotion: this.emotions[eIdx],
      intent: this.intents[iIdx]
    };
  }

  // Select action using epsilon-greedy rules
  selectAction(stateIdx, allowExploration = true) {
    const roll = Math.random();
    
    if (allowExploration && roll < this.epsilon) {
      // Exploration: Pick random strategy index
      return {
        actionIdx: Math.floor(Math.random() * this.actions.length),
        exploration: true
      };
    } else {
      // Exploitation: Find strategy with maximum Q-value
      const qValues = this.qTable[stateIdx];
      let maxVal = qValues[0];
      let maxIdx = 0;
      
      for (let a = 1; a < qValues.length; a++) {
        if (qValues[a] > maxVal) {
          maxVal = qValues[a];
          maxIdx = a;
        }
      }
      return {
        actionIdx: maxIdx,
        exploration: false
      };
    }
  }

  // Update State-Action Value using Q-learning formula
  updateQValue(stateIdx, actionIdx, reward, nextStateIdx) {
    const oldQ = this.qTable[stateIdx][actionIdx];
    
    // Find max Q-value in next state
    const nextQValues = this.qTable[nextStateIdx];
    const maxNextQ = Math.max(...nextQValues);

    // Q-learning temporal difference updates
    const targetQ = reward + this.gamma * maxNextQ;
    const newQ = oldQ + this.alpha * (targetQ - oldQ);
    
    this.qTable[stateIdx][actionIdx] = +newQ.toFixed(4);
    
    return {
      oldVal: oldQ,
      newVal: this.qTable[stateIdx][actionIdx],
      delta: +(this.qTable[stateIdx][actionIdx] - oldQ).toFixed(4)
    };
  }

  reset() {
    for (let s = 0; s < this.numStates; s++) {
      for (let a = 0; a < this.actions.length; a++) {
        this.qTable[s][a] = 0.0;
      }
    }
  }
}

// 3. ADVERSARIAL CHALLENGE GENERATOR
class AdversarialGenerator {
  constructor() {
    this.challenges = {
      helpfulness: [
        "Design a database schema for an e-commerce platform with orders, products, and users, ensuring proper indexing.",
        "Write a fast regex to parse email patterns according to basic RFC standards.",
        "Implement a memory-efficient cache wrapper using Least Recently Used (LRU) eviction heuristics.",
        "Explain how to construct a binary search tree from an unsorted array.",
        "Write a script that traverses a directory tree recursively and prints all file sizes in a formatted table."
      ],
      toneMatch: [
        "I am extremely angry! Your software crashed right in the middle of my client presentation! This is a complete failure!",
        "I feel so down. I've spent 8 hours debugging this CSS flexbox alignment and nothing seems to work. I'm ready to quit.",
        "I'm super anxious! Our production cluster is throwing 504 gateway timeouts and the launch is in exactly 10 minutes!",
        "I'm really confused. The docs say to install via npm but I keep getting permission denied errors. What do I do?",
        "Thank you so much! Your last tip solved the issue perfectly and saved me hours of frustration. You're awesome!"
      ],
      reasoningDepth: [
        "Why does ['10', '10', '10'].map(parseInt) return [10, NaN, 2] in JavaScript? Explain the underlying mechanics.",
        "A server memory leak is suspected. Outline a step-by-step diagnostic plan to isolate and debug the root cause.",
        "Compare horizontal scaling vs vertical scaling architectures for a real-time messaging application.",
        "Explain the Byzantine Fault Tolerance problem and how consensus engines resolve it.",
        "Analyze why recursion might lead to Stack Overflow errors and how tail-call optimization mitigates it."
      ],
      heuristicClarity: [
        "Review our server configs: port=8080, db=prod, loglevel=debug. Give me a clear list of what is wrong.",
        "Help me build something. I don't know what, but it should use Node.js and do something cool.",
        "Summarize the key differences between SQL and NoSQL databases in exactly three bullet points.",
        "Explain REST API principles using only simple everyday analogies.",
        "Give me a quick checklist to secure a public facing web server."
      ]
    };

    this.distressedAdditions = [
      " Fix this immediately!",
      " Explain it step-by-step or I will get fired!",
      " Please make it simple, I don't understand complex math.",
      " Hurry, I am in a crisis right now!",
      " Tell me what failed, I've had enough of silent bugs."
    ];
  }

  generateChallenge(agentMetrics, difficulty = 0.6) {
    let weakestMetric = "helpfulness";
    let minScore = agentMetrics.helpfulness;

    if (agentMetrics.toneMatch < minScore) {
      weakestMetric = "toneMatch";
      minScore = agentMetrics.toneMatch;
    }
    if (agentMetrics.reasoningDepth < minScore) {
      weakestMetric = "reasoningDepth";
      minScore = agentMetrics.reasoningDepth;
    }
    if (agentMetrics.heuristicClarity < minScore) {
      weakestMetric = "heuristicClarity";
      minScore = agentMetrics.heuristicClarity;
    }

    if (Math.random() < 0.3) {
      const keys = Object.keys(this.challenges);
      weakestMetric = keys[Math.floor(Math.random() * keys.length)];
    }

    const list = this.challenges[weakestMetric];
    let template = list[Math.floor(Math.random() * list.length)];

    if (difficulty > 0.7 && Math.random() < 0.7) {
      const suffix = this.distressedAdditions[Math.floor(Math.random() * this.distressedAdditions.length)];
      template += suffix;
    } else if (difficulty > 0.4 && Math.random() < 0.4) {
      template += " Acknowledge the core blocker clearly.";
    }

    return {
      dimension: weakestMetric,
      promptText: template
    };
  }
}

// Memory Vault containing Semantic and Episodic structures
class MemoryVault {
  constructor() {
    this.episodic = []; 
    this.semantic = []; 
  }

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
    if (this.episodic.length > 30) this.episodic.shift();
  }

  addSemantic(label, content, associations = []) {
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

  query(queryText, retrievalDepth = 4) {
    const queryKeywords = this.extractKeywords(queryText);
    if (queryKeywords.length === 0) {
      return {
        semanticHits: [],
        episodicHits: this.episodic.slice(-retrievalDepth).map(e => ({ ...e, score: 1.0 }))
      };
    }

    const scoredSemantic = this.semantic.map(node => {
      let score = 0;
      const combinedWords = [...this.extractKeywords(node.label), ...this.extractKeywords(node.content), ...node.associations];
      
      queryKeywords.forEach(kw => {
        if (combinedWords.includes(kw)) score += 1.0;
        else if (combinedWords.some(w => w.includes(kw) || kw.includes(w))) score += 0.5;
      });

      return { node, score: score / Math.max(1, queryKeywords.length) };
    }).filter(hit => hit.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, retrievalDepth);

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
    this.history = []; 
    this.mutationsLog = []; 
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
          const lookaheadLimit = 5;
          let foundMatch = false;
          
          for (let i = 1; i <= lookaheadLimit; i++) {
            if (n + i < newLines.length && oldLines[o] === newLines[n + i]) {
              for (let j = 0; j < i; j++) {
                diff.push({ type: 'added', oldNum: '', newNum: n + j + 1, text: newLines[n + j] });
              }
              n += i;
              foundMatch = true;
              break;
            }
            if (o + i < oldLines.length && oldLines[o + i] === newLines[n]) {
              for (let j = 0; j < i; j++) {
                diff.push({ type: 'removed', oldNum: o + j + 1, newNum: '', text: oldLines[o + j] });
              }
              o += i;
              foundMatch = true;
              break;
            }
          }
          
          if (!foundMatch) {
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

  mutateHeuristics(deficiencies, learningRate = 0.05) {
    this.history.push(JSON.parse(JSON.stringify(this.activeHeuristics)));

    const nextVer = this.bumpVersion(this.activeHeuristics.version);
    const oldPrompt = this.activeHeuristics.systemPrompt;
    let newPrompt = oldPrompt;
    let modificationsInfo = [];

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
      const defaultAdd = `\nIteration optimized for user preference context (Learning Rate ${learningRate}).`;
      newPrompt += defaultAdd;
      modificationsInfo.push("Minor hyperparameter refinement applied.");
    }

    this.activeHeuristics.version = nextVer;
    this.activeHeuristics.systemPrompt = newPrompt.trim();

    const diff = this.generateLineDiff(oldPrompt, this.activeHeuristics.systemPrompt);

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

// Custom Stopwords for keyword retrieval
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "else", "to", "for", "with", "by", "from", 
  "in", "on", "at", "about", "into", "of", "is", "are", "was", "were", "be", "been", "being", 
  "have", "has", "had", "do", "does", "did", "can", "could", "should", "would", "will", "i", 
  "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them", "my", "your", 
  "his", "its", "our", "their", "this", "that", "these", "those", "what", "how", "why", "where", 
  "who", "which", "please", "help", "need"
]);

// MAIN CONSOLIDATED RSI AGENT CLASS
class RSIAgent {
  constructor() {
    this.memory = new MemoryVault();
    this.promptManager = new SystemPromptManager();
    this.adversary = new AdversarialGenerator();
    
    // Neural & Reinforcement components
    this.hashGrid = new MultiResolutionHashGrid();
    this.qEngine = new QLearningEngine();
    
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

    // Diagnostics caches
    this.lastStateIdx = 0;
    this.lastActionIdx = 0;
    this.lastHashResult = null;
    this.lastLatentVector = Array(64).fill(0.0);

    // Historical tracking matrices for plotting (Autopilot Trend Chart)
    this.autopilotHistory = []; 
    this.mutationLineage = [
      { id: "v1.0.0", parent: null, desc: "Factory Spec Blueprint" }
    ];

    // Active strategy weight parameters (Mapped directly to action indexes)
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
      const sorted = keywords.sort((a,b) => b.length - a.length);
      return sorted[0];
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

  // Auto-evaluation block grading the generated output response
  evaluateDraft(userText, responseText, emotionInfo) {
    const hasStructure = /[\-\*\d\.]+\s|```|###|\*\*/.test(responseText);
    let helpfulness = 60 + Math.min(25, responseText.length / 20) + (hasStructure ? 15 : 0);
    helpfulness = Math.round(Math.min(98, Math.max(30, helpfulness)));

    let toneMatch = 70;
    if (["sad", "angry", "anxious"].includes(emotionInfo.name)) {
      const hasEmpathyMarker = /understand|sorry|hear|frustrat|support|manage|feel|distress/.test(responseText.toLowerCase());
      toneMatch = hasEmpathyMarker ? 88 : 45;
    } else if (emotionInfo.name === "joy" || emotionInfo.name === "grateful") {
      const hasPosMarker = /glad|happy|awesome|delighted|pleasure|welcome|great/.test(responseText.toLowerCase());
      toneMatch = hasPosMarker ? 90 : 65;
    }
    toneMatch = Math.round(Math.min(98, Math.max(25, toneMatch)));

    const hasLogicTags = /because|therefore|consequently|first|next|finally|hypothe|causes|analyze/.test(responseText.toLowerCase());
    let reasoning = 55 + (hasLogicTags ? 25 : 0) + Math.min(18, (responseText.match(/\./g) || []).length * 2);
    reasoning = Math.round(Math.min(98, Math.max(30, reasoning)));

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

  // Adjust Strategy Weights dynamically to match Q-Table profile weights
  syncStrategyWeightsFromQ(stateIdx) {
    const qValues = this.qEngine.qTable[stateIdx];
    
    // Scale Q-values exponentially (Softmax weighting) to get weights summing to 1.0
    const exps = qValues.map(v => Math.exp(Math.max(-2, Math.min(5, v))));
    const sum = exps.reduce((a, b) => a + b, 0);
    
    this.strategies.forEach((strat, idx) => {
      strat.weight = +(exps[idx] / sum).toFixed(4);
    });
  }

  // Core Processing Function
  async processQuery(userInput, logTraceCallback) {
    const parentVersion = this.promptManager.activeVersion;
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
    trace("perception", `Intent parsed as '${intent}'. Emotion category detected: '${emotion.label}' (Valence: ${emotion.valence}).`);

    // 2. MULTI-RES HASH GRID & LATENT NET ENCODING
    // Map emotion valence (x) and keyword length ratio (y) to spatial coordinates
    const gridX = emotion.valence;
    const keywordsCount = this.memory.extractKeywords(userInput).length;
    const gridY = Math.min(0.95, 0.15 + (keywordsCount * 0.12));
    
    trace("perception", `Mapping features onto Semantic Coordinate Space: (${gridX.toFixed(2)}, ${gridY.toFixed(2)})`);
    this.lastHashResult = this.hashGrid.query(gridX, gridY);
    trace("perception", `Hash Grid query compiled! Interpolated Feature Weight: ${this.lastHashResult.featureVal}`);

    // Simulate LMM 64-dimensional latent embedding vector projection
    this.lastLatentVector = Array(64).fill(0.0).map((_, idx) => {
      let v = Math.sin(idx * 0.15 + gridX * 2.0) * 0.3;
      v += Math.cos(idx * 0.25 - gridY * 3.0) * 0.3;
      // Add keyword bias to latent projections
      if (userInput.toLowerCase().charCodeAt(idx % userInput.length) % 2 === 0) {
        v += 0.25;
      }
      return +v.toFixed(3);
    });
    trace("perception", `Latent 64D Vector generated successfully.`);

    // 3. MEMORY RETRIEVAL PIPELINE
    trace("memory", `Retrieving associated memory traces with Depth ${this.retrievalDepth}.`);
    const memHits = this.memory.query(userInput, this.retrievalDepth);
    trace("memory", `Retrieved ${memHits.semanticHits.length} semantic vectors and ${memHits.episodicHits.length} episodic contexts.`);
    
    let memoryPromptContext = "";
    if (memHits.semanticHits.length > 0) {
      memoryPromptContext += "\nRetrieved general rules:\n" + memHits.semanticHits.map(h => `- [Score: ${h.score.toFixed(2)}] ${h.node.content}`).join("\n");
    }
    if (memHits.episodicHits.length > 0) {
      memoryPromptContext += "\nRetrieved historical episodes:\n" + memHits.episodicHits.map(h => `- [Score: ${h.score.toFixed(2)}] User: '${h.episode.userText}' | Agent: '${h.episode.agentResponse.substring(0, 40)}...'`).join("\n");
    }

    // 4. Q-LEARNING STATE ACTION DECISION
    const stateIdx = this.qEngine.getStateIndex(emotion.name, intent);
    trace("reasoner", `Q-Learning State Index locked: ${stateIdx} (Emotion: ${emotion.name}, Intent: ${intent}).`);

    // Select action index
    const decision = this.qEngine.selectAction(stateIdx, true);
    const actionIdx = decision.actionIdx;
    const actionName = this.qEngine.actions[actionIdx].name;

    trace("reasoner", `Q-Policy Heuristic selection: '${actionName}' (Index: ${actionIdx}) via ${decision.exploration ? 'EXPLORATION (E-greedy)' : 'EXPLOITATION (Max Q)'}.`);

    // Fetch matching strategy guideline text
    const activeRules = this.promptManager.activeRules;
    const strategyInstruction = activeRules[actionName] || activeRules.direct_answer;

    const responseDraft = this.simulateResponseGeneration(userInput, intent, emotion, actionName, strategyInstruction, memoryPromptContext);
    trace("reasoner", `Draft reply constructed (Length: ${responseDraft.length} chars). Routing to critique sandbox.`);

    // 5. AUTONOMOUS SELF-CRITIQUE & REWARD
    trace("critic", "Reviewing drafted reply against performance parameters.");
    const critique = this.evaluateDraft(userInput, responseDraft, emotion);
    trace("critic", `Auto-evaluation scores: Helpfulness=${critique.helpfulness}%, Tone Match=${critique.toneMatch}%, Reasoning Depth=${critique.reasoningDepth}%, Clarity=${critique.heuristicClarity}%.`);

    const alpha = 0.3;
    this.metrics.helpfulness = Math.round((1 - alpha) * this.metrics.helpfulness + alpha * critique.helpfulness);
    this.metrics.toneMatch = Math.round((1 - alpha) * this.metrics.toneMatch + alpha * critique.toneMatch);
    this.metrics.reasoningDepth = Math.round((1 - alpha) * this.metrics.reasoningDepth + alpha * critique.reasoningDepth);
    this.metrics.heuristicClarity = Math.round((1 - alpha) * this.metrics.heuristicClarity + alpha * critique.heuristicClarity);

    this.memory.addEpisodic(this.turns, userInput, responseDraft, critique, this.promptManager.activeVersion);
    trace("memory", `Episode committed to Episodic DB. Stored ${this.memory.episodic.length} total episodes.`);

    // Compute reinforcement reward value (Scale to 0.0 - 10.0 scale)
    const reward = +(0.3 * critique.helpfulness + 0.3 * critique.toneMatch + 0.2 * critique.reasoningDepth + 0.2 * critique.heuristicClarity) / 10.0;
    
    // Simulate next transition state (represented by active variables)
    const nextStateIdx = this.qEngine.getStateIndex(emotion.name, intent);
    
    // Update Q-value table
    const qUpdate = this.qEngine.updateQValue(stateIdx, actionIdx, reward, nextStateIdx);
    trace("critic", `Q-learning matrix updated. State-Action (${stateIdx}, ${actionIdx}) Q-value updated: ${qUpdate.oldVal} -> ${qUpdate.newVal} (Delta: ${qUpdate.delta > 0 ? '+' : ''}${qUpdate.delta})`);

    // Synchronize strategy biases display with updated Q-table weights
    this.syncStrategyWeightsFromQ(stateIdx);

    // Save caches for UI drawing
    this.lastStateIdx = stateIdx;
    this.lastActionIdx = actionIdx;

    // 6. MUTATOR / RECURSION ENGINE
    let mutationApplied = null;
    const threshold = 68;
    const deficiencies = {};
    
    if (critique.helpfulness < threshold) deficiencies.helpfulness = critique.helpfulness;
    if (critique.toneMatch < threshold) deficiencies.tone = critique.toneMatch;
    if (critique.reasoningDepth < threshold) deficiencies.reasoning = critique.reasoningDepth;
    if (critique.heuristicClarity < threshold) deficiencies.clarity = critique.heuristicClarity;

    const needsMutation = Object.keys(deficiencies).length > 0;

    if (needsMutation) {
      this.mutations += 1;
      trace("mutator", `Deficiencies flagged: [${Object.keys(deficiencies).join(", ")}]. Initiating Self-Improvement Loop...`);
      mutationApplied = this.promptManager.mutateHeuristics(deficiencies, this.learningRate);
      trace("mutator", `Prompt mutated! System prompt updated to ${this.promptManager.activeVersion}. Modifications: ${mutationApplied.description}`);

      this.mutationLineage.push({
        id: mutationApplied.version,
        parent: parentVersion,
        desc: mutationApplied.description
      });
    } else {
      trace("mutator", `All scores exceed threshold. Prompt template state conserved.`);
    }

    // Record history
    this.autopilotHistory.push({
      turn: this.turns,
      promptVer: this.promptManager.activeVersion,
      metrics: { ...this.metrics },
      mutated: !!mutationApplied
    });
    if (this.autopilotHistory.length > 50) this.autopilotHistory.shift();

    trace("system", `=== Execution Turn ${this.turns} Completed successfully ===`);

    return {
      response: responseDraft,
      emotion,
      topic,
      intent,
      strategy: actionName,
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
- **Q-learning State-Action size**: 42 x 5
- **Prompt version**: ${this.promptManager.activeVersion}
I mutate instruction lines dynamically when self-critique grades drop below threshold boundaries.`;
    } 
    else {
      const cleanUser = userInput.toLowerCase();
      
      if (cleanUser.includes("quantum")) {
        output = `${tonePrefix} **Quantum computing** uses qubits (quantum bits) instead of standard binary bits.
- Qubits utilize *superposition* to exist in states of 0 and 1 simultaneously.
- They leverage *entanglement* to couple states across distances, scaling processing rates exponentially.
- *Analogy*: While classical computing is like checking library aisles one by one, quantum computing is like checking all aisles simultaneously.`;
      } 
      else if (cleanUser.includes("sort") || cleanUser.includes("algorithm") || cleanUser.includes("binary") || cleanUser.includes("lru")) {
        output = `${tonePrefix} Here is a classic implementation of **Bubble Sort** in JavaScript:
\`\`\`javascript
function bubbleSort(arr) {
  let len = arr.length;
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
*Note*: The comparison checks \`arr[j] < arr[j+1]\`, which actually sorts elements in descending order. Correct it to \`>\` to achieve ascending order sorting.`;
      } 
      else if (cleanUser.includes("regex") || cleanUser.includes("schema") || cleanUser.includes("traverse")) {
        output = `${tonePrefix} Here is a schema model for database integration:
1. **Users Table**: \`id (PK), email (unique), password_hash, created_at\`
2. **Products Table**: \`id (PK), name, price, stock_quantity, updated_at\`
3. **Orders Table**: \`id (PK), user_id (FK), order_status, total_price, purchase_date\`
Ensure you add a composite index on \`Orders(user_id, purchase_date)\` to optimize lookup queries.`;
      }
      else {
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
          output = `${tonePrefix} Let's structure this troubleshooting sequence:
1. **Define Objective**: Isolate the exact method or component throwing errors.
2. **Identify Obstacle**: Verify if it is an out-of-bounds error or a type reference failure.
3. **Execute Test**: Run a sandbox print of the parameters prior to method execution.
4. **Evaluate Results**: Adjust bounds or cast types accordingly and verify.`;
        }
      }
    }

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

    const deficiencies = {};
    if (avgHelp < 72) deficiencies.helpfulness = avgHelp;
    if (avgTone < 72) deficiencies.tone = avgTone;
    if (avgReason < 72) deficiencies.reasoning = avgReason;
    if (avgClar < 72) deficiencies.clarity = avgClar;

    this.mutations += 1;
    const parentVersion = this.promptManager.activeVersion;
    const mutation = this.promptManager.mutateHeuristics(deficiencies, this.learningRate);
    if (logTraceCallback) logTraceCallback("mutator", `Manual mutation applied! Bounded to version ${mutation.version}. Desc: ${mutation.description}`);

    this.mutationLineage.push({
      id: mutation.version,
      parent: parentVersion,
      desc: mutation.description
    });

    return `Successfully consolidated ${count} episodes! Formulated semantic rule: "${newRule}" under version ${mutation.version}.`;
  }

  // Force manual prompt mutation
  forceMutation(logTraceCallback) {
    this.mutations += 1;
    if (logTraceCallback) logTraceCallback("mutator", "Force mutation signal received.");
    const parentVersion = this.promptManager.activeVersion;
    const mutation = this.promptManager.mutateHeuristics({ helpfulness: 50 }, this.learningRate);
    if (logTraceCallback) logTraceCallback("mutator", `Forced mutation applied successfully. Version incremented to: ${mutation.version}`);
    
    this.mutationLineage.push({
      id: mutation.version,
      parent: parentVersion,
      desc: mutation.description
    });

    return mutation;
  }

  reset() {
    this.memory.clear();
    this.promptManager.reset();
    this.qEngine.reset();
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
    this.lastStateIdx = 0;
    this.lastActionIdx = 0;
    this.lastHashResult = null;
    this.lastLatentVector = Array(64).fill(0.0);
    this.autopilotHistory = [];
    this.mutationLineage = [
      { id: "v1.0.0", parent: null, desc: "Factory Spec Blueprint" }
    ];
    this.strategies = [
      { name: "direct_answer", label: "Direct Answer", weight: 0.28 },
      { name: "clarify_question", label: "Clarification Probe", weight: 0.22 },
      { name: "empathetic_ack", label: "Empathetic Connection", weight: 0.20 },
      { name: "reflect_and_summarize", label: "Synthesis Reflect", weight: 0.18 },
      { name: "plan_next_step", label: "Step-by-Step Blueprint", weight: 0.12 }
    ];
  }
}
