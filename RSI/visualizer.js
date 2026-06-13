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

    // Define 4 metrics axes (North, East, South, West)
    this.axes = [
      { name: "Helpfulness", x: 0, y: -1 },       // Top
      { name: "Tone Match", x: 1, y: 0 },        // Right
      { name: "Reasoning", x: 0, y: 1 },         // Bottom
      { name: "Clarity", x: -1, y: 0 }           // Left
    ];

    // Current animated values
    this.currentValues = [60, 60, 60, 60];
  }

  // Draw chart frames and values
  draw(values = null) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    
    // Clear canvas
    ctx.clearRect(0, 0, this.width, this.height);

    // If new values provided, animate them smoothly towards target
    if (values) {
      const lerpSpeed = 0.08;
      for (let i = 0; i < 4; i++) {
        this.currentValues[i] += (values[i] - this.currentValues[i]) * lerpSpeed;
      }
    }

    // Draw background concentric frames
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

    // Draw axis lines
    ctx.beginPath();
    ctx.moveTo(this.centerX, this.centerY - this.radius);
    ctx.lineTo(this.centerX, this.centerY + this.radius);
    ctx.moveTo(this.centerX - this.radius, this.centerY);
    ctx.lineTo(this.centerX + this.radius, this.centerY);
    ctx.stroke();

    // Draw active data polygon shape
    const coordinates = this.currentValues.map((val, idx) => {
      const valPercent = Math.max(10, Math.min(100, val)) / 100;
      const r = this.radius * valPercent;
      return {
        x: this.centerX + this.axes[idx].x * r,
        y: this.centerY + this.axes[idx].y * r
      };
    });

    // Filled area gradient
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

    // Outline stroke
    ctx.strokeStyle = "#8b5cf6";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(139, 92, 246, 0.6)";
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0; // reset shadow

    // Draw vertices dots
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

  // Set chart rendering update schedule loop
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

    // Define Node Positions in Flow Matrix
    this.nodes = {
      perception: { label: "Perception", x: 180, y: 50, size: 28, color: "#8b5cf6", active: false, pulseScale: 1.0 },
      memory:     { label: "Memory DB",  x: 90,  y: 170, size: 28, color: "#6366f1", active: false, pulseScale: 1.0 },
      reasoner:   { label: "Reasoner",   x: 270, y: 170, size: 30, color: "#06b6d4", active: false, pulseScale: 1.0 },
      critic:     { label: "Self Critic", x: 130, y: 310, size: 28, color: "#f59e0b", active: false, pulseScale: 1.0 },
      mutator:    { label: "Mutator",    x: 250, y: 310, size: 28, color: "#10b981", active: false, pulseScale: 1.0 }
    };

    // Connections between modules
    this.connections = [
      { from: "perception", to: "memory", color: "rgba(139, 92, 246, 0.25)" },
      { from: "perception", to: "reasoner", color: "rgba(139, 92, 246, 0.25)" },
      { from: "memory", to: "reasoner", color: "rgba(99, 102, 241, 0.25)" },
      { from: "reasoner", to: "critic", color: "rgba(6, 182, 212, 0.25)" },
      { from: "critic", to: "mutator", color: "rgba(245, 158, 11, 0.25)" },
      { from: "mutator", to: "reasoner", color: "rgba(16, 185, 129, 0.25)" } // Feedback loop
    ];

    this.particles = []; // Array of moving travel energy packets
    this.animating = true;
    this.pipelineTimeout = null;
  }

  // Draw dynamic network structures
  draw() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Draw connecting link paths
    ctx.lineWidth = 2;
    this.connections.forEach(conn => {
      const fromNode = this.nodes[conn.from];
      const toNode = this.nodes[conn.to];
      
      ctx.strokeStyle = conn.color;
      ctx.beginPath();
      
      // If mutator -> reasoner feedback, draw curved path to distinguish it
      if (conn.from === "mutator" && conn.to === "reasoner") {
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.bezierCurveTo(340, 260, 340, 200, toNode.x, toNode.y);
      } else {
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(toNode.x, toNode.y);
      }
      ctx.stroke();
    });

    // 2. Update and draw particles traveling links
    this.particles.forEach((p, idx) => {
      p.progress += p.speed;
      if (p.progress >= 1.0) {
        // Trigger activation bump on destination node when particle hits
        if (this.nodes[p.to]) {
          this.nodes[p.to].pulseScale = 1.35;
          this.nodes[p.to].active = true;
        }
        this.particles.splice(idx, 1);
        return;
      }

      // Calculate particle coordinate positions
      let x, y;
      const fromNode = this.nodes[p.from];
      const toNode = this.nodes[p.to];

      if (p.from === "mutator" && p.to === "reasoner") {
        // Curve path interpolation
        const t = p.progress;
        x = (1-t)*(1-t)*fromNode.x + 2*(1-t)*t*340 + t*t*toNode.x;
        y = (1-t)*(1-t)*fromNode.y + 2*(1-t)*t*230 + t*t*toNode.y;
      } else {
        // Linear interpolation
        x = fromNode.x + (toNode.x - fromNode.x) * p.progress;
        y = fromNode.y + (toNode.y - fromNode.y) * p.progress;
      }

      // Draw particle glowing dot
      ctx.fillStyle = p.color || "#ffffff";
      ctx.shadowColor = p.color || "#ffffff";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0; // reset shadow
    });

    // 3. Draw Module Nodes
    for (const [key, node] of Object.entries(this.nodes)) {
      // Smooth pulse scale decay
      node.pulseScale += (1.0 - node.pulseScale) * 0.08;
      const currentSize = node.size * node.pulseScale;

      // Outer glow boundary
      if (node.active) {
        ctx.shadowColor = node.color;
        ctx.shadowBlur = 12 + Math.sin(Date.now() / 150) * 4;
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 3;
      } else {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 1.5;
      }

      // Filled base ring
      ctx.fillStyle = node.active ? "rgba(17, 24, 39, 0.95)" : "rgba(31, 41, 55, 0.45)";
      ctx.beginPath();
      ctx.arc(node.x, node.y, currentSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0; // reset

      // Inside Icon / Tag
      ctx.fillStyle = node.active ? "#ffffff" : varColorMuted();
      ctx.font = "bold 9px 'Outfit', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      const firstChar = node.label.charAt(0);
      ctx.fillText(node.label.toUpperCase(), node.x, node.y);
    }
  }

  // Spawn particle packet traveling between two named nodes
  spawnParticle(from, to, color) {
    this.particles.push({
      from,
      to,
      color,
      progress: 0.0,
      speed: 0.035
    });
  }

  // Animate the full agent cognitive cycle in steps
  async runPipelineTrace(mutationExpected = false, onStepCallback = null) {
    // Stop any running animations
    if (this.pipelineTimeout) clearTimeout(this.pipelineTimeout);
    this.particles = [];
    
    // Reset states to inactive
    for (const k in this.nodes) {
      this.nodes[k].active = false;
    }

    const delay = (ms) => new Promise(resolve => {
      this.pipelineTimeout = setTimeout(resolve, ms);
    });

    // Step 1: Trigger Perception activation
    this.nodes.perception.active = true;
    this.nodes.perception.pulseScale = 1.4;
    if (onStepCallback) onStepCallback("perception");
    await delay(700);

    // Step 2: Fire signals to memory
    this.spawnParticle("perception", "memory", this.nodes.perception.color);
    await delay(400); // Wait for particle arrival
    if (onStepCallback) onStepCallback("memory");
    await delay(600);

    // Step 3: Stream context from Memory + Input perception to Reasoner
    this.spawnParticle("memory", "reasoner", this.nodes.memory.color);
    this.spawnParticle("perception", "reasoner", this.nodes.perception.color);
    await delay(400);
    if (onStepCallback) onStepCallback("reasoner");
    await delay(900);

    // Step 4: Stream response draft to Self-Critic
    this.spawnParticle("reasoner", "critic", this.nodes.reasoner.color);
    await delay(400);
    if (onStepCallback) onStepCallback("critic");
    await delay(700);

    // Step 5: Check if mutation executes
    if (mutationExpected) {
      this.spawnParticle("critic", "mutator", this.nodes.critic.color);
      await delay(400);
      if (onStepCallback) onStepCallback("mutator");
      await delay(800);

      // Feedback correction loop to reasoner
      this.spawnParticle("mutator", "reasoner", this.nodes.mutator.color);
      await delay(500);
    }

    // Decay activation states back to normal after complete cycle
    setTimeout(() => {
      for (const k in this.nodes) {
        this.nodes[k].active = false;
      }
    }, 1500);
  }

  // Start visualizer animation tick loops
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

// Utility color helper
function varColorMuted() {
  return "#9ca3af";
}
