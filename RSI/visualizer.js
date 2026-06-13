/* RSI Agent Laboratory Canvas Visualizers */

// 1. RADAR CRITIQUE CHART
class CritiqueRadarChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.centerX = this.width / 2;
    this.centerY = this.height / 2;
    this.radius = Math.min(this.width, this.height) / 2 - 12;

    this.axes = [
      { name: "Helpfulness", x: 0, y: -1 },       // Top
      { name: "Tone Match", x: 1, y: 0 },        // Right
      { name: "Reasoning", x: 0, y: 1 },         // Bottom
      { name: "Clarity", x: -1, y: 0 }           // Left
    ];

    this.currentValues = [60, 60, 60, 60];
  }

  draw(values = null) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    if (values) {
      const lerpSpeed = 0.08;
      for (let i = 0; i < 4; i++) {
        this.currentValues[i] += (values[i] - this.currentValues[i]) * lerpSpeed;
      }
    }

    const levels = 4;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let l = 1; l <= levels; l++) {
      const r = this.radius * (l / levels);
      ctx.beginPath();
      ctx.moveTo(this.centerX + this.axes[0].x * r, this.centerY + this.axes[0].y * r);
      for (let i = 1; i < 4; i++) {
        ctx.lineTo(this.centerX + this.axes[i].x * r, this.centerY + this.axes[i].y * r);
      }
      ctx.closePath();
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(this.centerX, this.centerY - this.radius);
    ctx.lineTo(this.centerX, this.centerY + this.radius);
    ctx.moveTo(this.centerX - this.radius, this.centerY);
    ctx.lineTo(this.centerX + this.radius, this.centerY);
    ctx.stroke();

    const coordinates = this.currentValues.map((val, idx) => {
      const valPercent = Math.max(10, Math.min(100, val)) / 100;
      const r = this.radius * valPercent;
      return {
        x: this.centerX + this.axes[idx].x * r,
        y: this.centerY + this.axes[idx].y * r
      };
    });

    const gradient = ctx.createRadialGradient(this.centerX, this.centerY, 10, this.centerX, this.centerY, this.radius);
    gradient.addColorStop(0, "rgba(99, 102, 241, 0.15)");
    gradient.addColorStop(1, "rgba(139, 92, 246, 0.55)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(coordinates[0].x, coordinates[0].y);
    for (let i = 1; i < 4; i++) {
      ctx.lineTo(coordinates[i].x, coordinates[i].y);
    }
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#8b5cf6";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(139, 92, 246, 0.6)";
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    coordinates.forEach((coord, i) => {
      ctx.fillStyle = i % 2 === 0 ? "#818cf8" : "#34d399";
      ctx.beginPath();
      ctx.arc(coord.x, coord.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }

  startAnimateLoop() {
    const tick = () => {
      this.draw();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}


// 2. NEURAL NETWORK PIPELINE VISUALIZER
class NeuralFlowVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");
    this.width = this.canvas.width;
    this.height = this.canvas.height;

    this.nodes = {
      perception: { label: "Perception", x: 180, y: 50, size: 28, color: "#8b5cf6", active: false, pulseScale: 1.0 },
      memory:     { label: "Memory DB",  x: 90,  y: 170, size: 28, color: "#6366f1", active: false, pulseScale: 1.0 },
      reasoner:   { label: "Reasoner",   x: 270, y: 170, size: 30, color: "#06b6d4", active: false, pulseScale: 1.0 },
      critic:     { label: "Self Critic", x: 130, y: 310, size: 28, color: "#f59e0b", active: false, pulseScale: 1.0 },
      mutator:    { label: "Mutator",    x: 250, y: 310, size: 28, color: "#10b981", active: false, pulseScale: 1.0 }
    };

    this.connections = [
      { from: "perception", to: "memory", color: "rgba(139, 92, 246, 0.25)" },
      { from: "perception", to: "reasoner", color: "rgba(139, 92, 246, 0.25)" },
      { from: "memory", to: "reasoner", color: "rgba(99, 102, 241, 0.25)" },
      { from: "reasoner", to: "critic", color: "rgba(6, 182, 212, 0.25)" },
      { from: "critic", to: "mutator", color: "rgba(245, 158, 11, 0.25)" },
      { from: "mutator", to: "reasoner", color: "rgba(16, 185, 129, 0.25)" }
    ];

    this.particles = [];
    this.animating = true;
    this.pipelineTimeout = null;
  }

  draw() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.lineWidth = 2;
    this.connections.forEach(conn => {
      const fromNode = this.nodes[conn.from];
      const toNode = this.nodes[conn.to];
      ctx.strokeStyle = conn.color;
      ctx.beginPath();
      
      if (conn.from === "mutator" && conn.to === "reasoner") {
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.bezierCurveTo(340, 260, 340, 200, toNode.x, toNode.y);
      } else {
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(toNode.x, toNode.y);
      }
      ctx.stroke();
    });

    this.particles.forEach((p, idx) => {
      p.progress += p.speed;
      if (p.progress >= 1.0) {
        if (this.nodes[p.to]) {
          this.nodes[p.to].pulseScale = 1.35;
          this.nodes[p.to].active = true;
        }
        this.particles.splice(idx, 1);
        return;
      }

      let x, y;
      const fromNode = this.nodes[p.from];
      const toNode = this.nodes[p.to];

      if (p.from === "mutator" && p.to === "reasoner") {
        const t = p.progress;
        x = (1-t)*(1-t)*fromNode.x + 2*(1-t)*t*340 + t*t*toNode.x;
        y = (1-t)*(1-t)*fromNode.y + 2*(1-t)*t*230 + t*t*toNode.y;
      } else {
        x = fromNode.x + (toNode.x - fromNode.x) * p.progress;
        y = fromNode.y + (toNode.y - fromNode.y) * p.progress;
      }

      ctx.fillStyle = p.color || "#ffffff";
      ctx.shadowColor = p.color || "#ffffff";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    for (const [key, node] of Object.entries(this.nodes)) {
      node.pulseScale += (1.0 - node.pulseScale) * 0.08;
      const currentSize = node.size * node.pulseScale;

      if (node.active) {
        ctx.shadowColor = node.color;
        ctx.shadowBlur = 12 + Math.sin(Date.now() / 150) * 4;
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 3;
      } else {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 1.5;
      }

      ctx.fillStyle = node.active ? "rgba(17, 24, 39, 0.95)" : "rgba(31, 41, 55, 0.45)";
      ctx.beginPath();
      ctx.arc(node.x, node.y, currentSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = node.active ? "#ffffff" : "#9ca3af";
      ctx.font = "bold 9px 'Outfit', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.label.toUpperCase(), node.x, node.y);
    }
  }

  spawnParticle(from, to, color) {
    this.particles.push({
      from,
      to,
      color,
      progress: 0.0,
      speed: 0.035
    });
  }

  async runPipelineTrace(mutationExpected = false, onStepCallback = null) {
    if (this.pipelineTimeout) clearTimeout(this.pipelineTimeout);
    this.particles = [];
    for (const k in this.nodes) {
      this.nodes[k].active = false;
    }

    const delay = (ms) => new Promise(resolve => {
      this.pipelineTimeout = setTimeout(resolve, ms);
    });

    this.nodes.perception.active = true;
    this.nodes.perception.pulseScale = 1.4;
    if (onStepCallback) onStepCallback("perception");
    await delay(700);

    this.spawnParticle("perception", "memory", this.nodes.perception.color);
    await delay(400);
    if (onStepCallback) onStepCallback("memory");
    await delay(600);

    this.spawnParticle("memory", "reasoner", this.nodes.memory.color);
    this.spawnParticle("perception", "reasoner", this.nodes.perception.color);
    await delay(400);
    if (onStepCallback) onStepCallback("reasoner");
    await delay(900);

    this.spawnParticle("reasoner", "critic", this.nodes.reasoner.color);
    await delay(400);
    if (onStepCallback) onStepCallback("critic");
    await delay(700);

    if (mutationExpected) {
      this.spawnParticle("critic", "mutator", this.nodes.critic.color);
      await delay(400);
      if (onStepCallback) onStepCallback("mutator");
      await delay(800);

      this.spawnParticle("mutator", "reasoner", this.nodes.mutator.color);
      await delay(500);
    }

    setTimeout(() => {
      for (const k in this.nodes) {
        this.nodes[k].active = false;
      }
    }, 1500);
  }

  startAnimateLoop() {
    const tick = () => {
      if (this.animating) {
        this.draw();
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}


// 3. HISTORICAL PERFORMANCE TREND LINE CHART
class TrendLineChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    
    // Internal margins
    this.margin = { top: 15, right: 15, bottom: 20, left: 32 };
    this.chartWidth = this.width - this.margin.left - this.margin.right;
    this.chartHeight = this.height - this.margin.top - this.margin.bottom;
  }

  // Draw lines comparing averages
  draw(history = []) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Draw Grid Frame & Boundaries
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    
    // Y-Axis grid lines
    const yLevels = 4;
    for (let i = 0; i <= yLevels; i++) {
      const y = this.margin.top + (this.chartHeight * (i / yLevels));
      ctx.beginPath();
      ctx.moveTo(this.margin.left, y);
      ctx.lineTo(this.width - this.margin.right, y);
      ctx.stroke();

      // Labels (100, 75, 50, 25, 0)
      ctx.fillStyle = "#6b7280";
      ctx.font = "8px 'Outfit', sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(`${100 - Math.round(i * (100 / yLevels))}%`, this.margin.left - 6, y);
    }

    if (history.length === 0) {
      // Empty state prompt
      ctx.fillStyle = "#9ca3af";
      ctx.font = "10px 'Outfit', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Awaiting Autopilot generations...", this.width / 2, this.height / 2);
      return;
    }

    // Graph plotting logic
    const count = history.length;
    const maxEntries = 50; // Rolling viewport window
    const dataWindow = history.slice(-maxEntries);
    const visibleCount = dataWindow.length;

    // Helper: Map data point (0-100) and index to coordinate
    const getCoords = (index, val) => {
      const x = this.margin.left + (this.chartWidth * (index / Math.max(1, visibleCount - 1)));
      const y = this.margin.top + this.chartHeight * (1 - (val / 100));
      return { x, y };
    };

    // Metrics keys to draw
    const lines = [
      { key: "helpfulness", color: "#8b5cf6" }, // purple
      { key: "toneMatch", color: "#10b981" },   // emerald
      { key: "reasoningDepth", color: "#06b6d4" } // cyan
    ];

    // 2. Draw line trajectories
    lines.forEach(lineConfig => {
      ctx.beginPath();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = lineConfig.color;
      
      dataWindow.forEach((entry, idx) => {
        const val = entry.metrics[lineConfig.key];
        const pt = getCoords(idx, val);
        if (idx === 0) {
          ctx.moveTo(pt.x, pt.y);
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
      });
      ctx.stroke();
    });

    // 3. Draw vertical orange indicators for mutation triggers
    dataWindow.forEach((entry, idx) => {
      if (entry.mutated) {
        const pt = getCoords(idx, 50); // Center point reference
        
        ctx.strokeStyle = "rgba(245, 158, 11, 0.45)"; // amber
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(pt.x, this.margin.top);
        ctx.lineTo(pt.x, this.height - this.margin.bottom);
        ctx.stroke();
        ctx.setLineDash([]); // reset

        // Mutation mark circle
        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.arc(pt.x, this.margin.top, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw bottom X labels (Generations count)
    ctx.fillStyle = "#6b7280";
    ctx.font = "8px 'Outfit', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    
    // Render start/end generation index labels
    const startGen = dataWindow[0].turn;
    const endGen = dataWindow[visibleCount - 1].turn;
    ctx.fillText(`Gen #${startGen}`, this.margin.left, this.height - this.margin.bottom + 4);
    
    ctx.textAlign = "right";
    ctx.fillText(`Gen #${endGen}`, this.width - this.margin.right, this.height - this.margin.bottom + 4);
  }
}


// 4. PROMPT MUTATION LINEAGE TREE VISUALIZER
class MutationLineageTree {
  constructor(canvasId, onNodeClickCallback) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    
    this.nodesList = []; // coordinates cache for mouse clicks
    this.onNodeClick = onNodeClickCallback;

    // Listen to mouse click overrides
    this.canvas.addEventListener("click", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Check if a node was clicked
      this.nodesList.forEach(n => {
        const dist = Math.hypot(n.x - x, n.y - y);
        if (dist <= 8) {
          if (this.onNodeClick) this.onNodeClick(n.id);
        }
      });
    });
  }

  // Draw hierarchical nodes list
  draw(lineage = [], activeVersion = "v1.0.0") {
    if (!this.ctx) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    this.nodesList = [];

    if (lineage.length === 0) return;

    // 1. Build tree depth arrays
    const nodes = {};
    lineage.forEach(node => {
      nodes[node.id] = {
        id: node.id,
        parent: node.parent,
        desc: node.desc,
        children: [],
        depth: 0,
        x: 0,
        y: 0
      };
    });

    // Populate children & calculate depth
    lineage.forEach(node => {
      if (node.parent && nodes[node.parent]) {
        nodes[node.parent].children.push(node.id);
      }
    });

    // Recursive depth assignment
    const assignDepth = (id, currentDepth) => {
      const node = nodes[id];
      if (!node) return;
      node.depth = currentDepth;
      node.children.forEach(childId => assignDepth(childId, currentDepth + 1));
    };
    
    // Root node is always v1.0.0
    assignDepth("v1.0.0", 0);

    // Group nodes by depth levels to calculate positions
    const depthGroups = {};
    let maxDepth = 0;
    for (const [id, node] of Object.entries(nodes)) {
      if (!depthGroups[node.depth]) depthGroups[node.depth] = [];
      depthGroups[node.depth].push(node);
      maxDepth = Math.max(maxDepth, node.depth);
    }

    // Set layout parameters
    const startX = 40;
    const endX = this.width - 40;
    const stepX = maxDepth > 0 ? (endX - startX) / maxDepth : 0;
    const centerY = this.height / 2;

    // 2. Assign coordinates
    for (let d = 0; d <= maxDepth; d++) {
      const group = depthGroups[d] || [];
      const len = group.length;
      
      group.forEach((node, idx) => {
        node.x = startX + d * Math.min(65, stepX || 50);
        
        // Vertical offsets centered on centerY
        if (len === 1) {
          node.y = centerY;
        } else {
          const spacing = 35;
          node.y = centerY + (idx - (len - 1) / 2) * spacing;
        }

        // Cache coordinates for click detection
        this.nodesList.push(node);
      });
    }

    // 3. Draw connection paths
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    for (const [id, node] of Object.entries(nodes)) {
      if (node.parent && nodes[node.parent]) {
        const parent = nodes[node.parent];
        ctx.beginPath();
        ctx.moveTo(parent.x, parent.y);
        ctx.bezierCurveTo(parent.x + 20, parent.y, node.x - 20, node.y, node.x, node.y);
        ctx.stroke();
      }
    }

    // 4. Draw node dots
    for (const [id, node] of Object.entries(nodes)) {
      const isActive = node.id === activeVersion;

      if (isActive) {
        ctx.shadowColor = "#8b5cf6";
        ctx.shadowBlur = 8;
        ctx.fillStyle = "#8b5cf6";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
      } else {
        ctx.fillStyle = "#374151";
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 1.2;
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Label text
      ctx.fillStyle = isActive ? "#ffffff" : "#9ca3af";
      ctx.font = isActive ? "bold 8px 'Outfit', sans-serif" : "8px 'Outfit', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(node.id, node.x, node.y - 8);
    }
  }
}
