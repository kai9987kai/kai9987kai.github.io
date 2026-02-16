export default class BotanyModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;
        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = 0.4;
        this.masterGain.connect(this.output);

        this.plants = [];
        this.selectedSeed = 'fern'; // fern, flower, reed, luminescent, shadow, fungi, mycelium, tree
        this.growthPotency = 1.0;

        // Pentatonic Scale (C Major)
        this.scale = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
    }

    addPlant(x, y) {
        const plant = {
            x: x,
            y: y,
            type: this.selectedSeed,
            age: 0,
            growthRate: (0.005 + Math.random() * 0.005) * this.growthPotency,
            seed: Math.random(), // For procedural shape
            height: 0,
            maxHeight: 50 + Math.random() * 100, // px
            swayOffset: Math.random() * Math.PI * 2,
            lastPlayed: 0,
            color: this.getPlantColor(this.selectedSeed),
            hasSpread: false
        };

        if (this.selectedSeed === 'tree') {
            plant.maxHeight = 150 + Math.random() * 150;
            plant.branches = [];
            plant.fruit = [];
            plant.growthRate *= 0.5; // Trees grow slower
        }

        this.plants.push(plant);
    }

    getPlantColor(type) {
        if (type === 'luminescent') return `hsl(${180 + Math.random() * 40}, 80%, 70%)`;
        if (type === 'shadow') return `hsl(${260 + Math.random() * 40}, 30%, 20%)`;
        if (type === 'flower') return `hsl(${Math.random() * 360}, 60%, 50%)`;
        if (type === 'reed') return `hsl(40, 40%, 40%)`;
        if (type === 'fungi') return `hsl(${20 + Math.random() * 20}, 70%, 60%)`;
        if (type === 'mycelium') return `rgba(255, 255, 255, 0.4)`;
        if (type === 'tree') return `hsl(${20 + Math.random() * 10}, 40%, 30%)`; // Brownish trunk
        return `hsl(120, 50%, 30%)`; // fern
    }

    clear() {
        this.plants = [];
    }

    update(params) {
        if (params.growth !== undefined) this.growthPotency = params.growth;

        // Grow plants
        const sunlight = (params.time > 0.2 && params.time < 0.8) ? 1.0 : 0.1;
        const water = params.rain;

        const newPlants = [];

        this.plants.forEach(p => {
            let growthFactor = (0.1 + sunlight * 0.5 + water * 0.4) * this.growthPotency;

            // Type-specific growth logic
            if (p.type === 'luminescent' && sunlight < 0.5) growthFactor *= 2;
            if (p.type === 'shadow' && water > 0.5) growthFactor *= 2;
            if ((p.type === 'fungi' || p.type === 'mycelium') && water > 0.3) growthFactor *= 1.5;
            if (p.type === 'tree') growthFactor *= (0.5 + water * 0.5); // Trees love rain

            // Pollination Synergy
            p.pollinated = false;
            if (params.bees && params.bees.length > 0) {
                for (const bee of params.bees) {
                    const dx = bee.x - p.x;
                    const dy = bee.y - (p.y - p.height);
                    if (Math.sqrt(dx * dx + dy * dy) < 30) {
                        growthFactor *= 2.5;
                        p.pollinated = true;
                        break;
                    }
                }
            }

            if (p.age < 1.0) {
                p.age += p.growthRate * growthFactor;
                if (p.age > 1.0) p.age = 1.0;
            }
            p.height = p.maxHeight * p.age;

            // Mycelium Spreading Logic
            if (p.type === 'mycelium' && p.age > 0.8 && !p.hasSpread && Math.random() < 0.005) {
                p.hasSpread = true;
                const spreadX = p.x + (Math.random() - 0.5) * 60;
                const spreadY = p.y + (Math.random() - 0.5) * 15;
                newPlants.push({ x: spreadX, y: spreadY });
            }

            // Tree Logic: Branching and Fruit
            if (p.type === 'tree') {
                // Branching logic based on age
                if (p.age > 0.4 && p.branches.length < 3 && Math.random() < 0.01) {
                    p.branches.push({
                        y: p.height * 0.5 + Math.random() * p.height * 0.3,
                        side: Math.random() > 0.5 ? 1 : -1,
                        length: 20 + Math.random() * 30,
                        age: 0
                    });
                }

                p.branches.forEach(b => {
                    if (b.age < 1.0) b.age += 0.01 * this.growthPotency;

                    // Generate fruit on mature branches
                    if (b.age > 0.8 && Math.random() < 0.002) {
                        p.fruit.push({
                            x: p.x + (b.length * b.side * b.age),
                            y: p.y - b.y,
                            size: 0,
                            maxSize: 6 + Math.random() * 4,
                            isFalling: false,
                            vy: 0,
                            groundY: p.y
                        });
                    }
                });

                p.fruit.forEach(f => {
                    if (!f.isFalling) {
                        if (f.size < f.maxSize) f.size += 0.05 * this.growthPotency;
                        else if (Math.random() < 0.005) {
                            f.isFalling = true;
                        }
                    } else {
                        f.vy += 0.2; // Gravity
                        f.y += f.vy;
                        if (f.y >= f.groundY) {
                            f.y = f.groundY;
                            f.isFalling = false;
                            f.vy = 0;
                            this.playPlop(f);
                            f.size = 0; // "Regenerate" or remove? For now, reset size
                            f.isEaten = true; // Mark for removal
                        }
                    }
                });

                // Remove "eaten" fruit
                p.fruit = p.fruit.filter(f => !f.isEaten);
            }
        });

        // Add spreading mycelium
        newPlants.forEach(np => {
            const oldSeed = this.selectedSeed;
            this.selectedSeed = 'mycelium';
            this.addPlant(np.x, np.y);
            this.selectedSeed = oldSeed;
        });
    }

    playNote(plant) {
        const now = this.ctx.currentTime;
        if (now - plant.lastPlayed < 0.2) return;

        plant.lastPlayed = now;

        let baseIndex = Math.floor(plant.seed * this.scale.length);
        if (plant.type === 'flower') baseIndex += 2;
        if (plant.type === 'reed' || plant.type === 'shadow') baseIndex -= 1;
        if (plant.type === 'luminescent') baseIndex += 4;
        if (plant.type === 'fungi') baseIndex -= 3;
        if (plant.type === 'tree') baseIndex -= 5;

        const freq = this.scale[Math.abs(baseIndex) % this.scale.length];

        const osc = this.ctx.createOscillator();
        osc.type = plant.type === 'luminescent' ? 'sine' : 'triangle';

        if (plant.type === 'fungi' || plant.type === 'mycelium') {
            osc.type = 'square';
            const mod = this.ctx.createOscillator();
            mod.frequency.value = 50 + Math.random() * 200;
            const modGain = this.ctx.createGain();
            modGain.gain.value = 100;
            mod.connect(modGain);
            modGain.connect(osc.frequency);
            mod.start(now);
            mod.stop(now + 0.1);
        } else if (plant.type === 'tree') {
            osc.type = 'sine'; // D Wood
        }

        osc.frequency.value = freq;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = plant.type === 'shadow' ? 400 : 2000;
        if (plant.type === 'fungi') filter.frequency.value = 600;
        if (plant.type === 'tree') {
            filter.frequency.value = 300;
            filter.Q.value = 15; // High resonance for "woody" feel
        } else {
            filter.Q.value = 5;
        }

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, now);

        if (plant.type === 'fungi' || plant.type === 'mycelium') {
            gain.gain.setTargetAtTime(0.3, now, 0.005);
            gain.gain.setTargetAtTime(0, now + 0.05, 0.05);
        } else if (plant.type === 'tree') {
            gain.gain.setTargetAtTime(0.5, now, 0.01);
            gain.gain.setTargetAtTime(0, now + 0.1, 0.2);
        } else {
            gain.gain.setTargetAtTime(0.4, now, 0.02);
            gain.gain.setTargetAtTime(0, now + 0.1, 0.4);
        }

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.setTargetAtTime(0, now + 1.5, 0.05); // Smooth decay to stop
        osc.stop(now + 1.8);
    }

    playPlop(fruit) {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.frequency.setValueAtTime(150 + Math.random() * 50, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.2);
    }

    getPlants() {
        return this.plants;
    }

    setPlants(data) {
        this.plants = data || [];
    }

    setSelectedSeed(type) {
        this.selectedSeed = type;
    }
}
