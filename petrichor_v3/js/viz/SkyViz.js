export default class SkyViz {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.stars = [];
        this.meteors = [];
        this.auroraActive = false;
        this.auroraOffset = 0;
        this.width = 0;
        this.height = 0;

        this.time = 12;
        this.wind = 0;
        this.rain = 0;

        this.initStars();
    }

    initStars() {
        this.stars = [];
        for (let i = 0; i < 200; i++) {
            this.stars.push({
                x: Math.random(),
                y: Math.random() * 0.6,
                size: Math.random() * 1.5 + 0.5,
                twinkle: Math.random() * Math.PI * 2,
                speed: 0.02 + Math.random() * 0.05
            });
        }
    }

    triggerMeteor() {
        this.meteors.push({
            x: Math.random() * this.width,
            y: 0,
            vx: (Math.random() - 0.5) * 10 + 5,
            vy: Math.random() * 5 + 5,
            len: 0,
            life: 1.0
        });
    }

    resize() {
        this.width = this.canvas.width;
        this.height = this.canvas.height;
    }

    update(params) {
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.time = params.time !== undefined ? params.time : this.time;
        this.rain = params.rain !== undefined ? params.rain : this.rain;
        this.wind = params.wind !== undefined ? params.wind : this.wind;
    }

    draw() {
        // Calculate Sky Color based on time
        let bg = '#05070a';
        let grad1 = 'rgba(20, 50, 60, 0.0)';
        let grad2 = 'rgba(30, 40, 60, 0.0)';

        if (this.time >= 5 && this.time < 8) { // Dawn
            bg = '#1a1025';
            grad1 = 'rgba(100, 60, 80, 0.6)';
            grad2 = 'rgba(60, 40, 80, 0.4)';
        } else if (this.time >= 8 && this.time < 17) { // Day
            bg = '#4a6b7c'; // Lighter Slate Blue for Day
            grad1 = 'rgba(100, 200, 255, 0.4)'; // Cyan Glow
            grad2 = 'rgba(50, 150, 200, 0.3)';
        } else if (this.time >= 17 && this.time < 20) { // Dusk
            bg = '#2a1510';
            grad1 = 'rgba(120, 60, 40, 0.6)';
            grad2 = 'rgba(80, 40, 60, 0.4)';
        }

        // Clear and Fill Background
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw Sky Background
        this.ctx.fillStyle = bg;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Draw Gradients
        const g = this.ctx.createRadialGradient(this.width / 2, this.height, 0, this.width / 2, this.height, this.width);
        g.addColorStop(0, grad1);
        g.addColorStop(1, 'transparent');
        this.ctx.fillStyle = g;
        this.ctx.fillRect(0, 0, this.width, this.height);

        const cx = this.width / 2;
        const cy = this.height * 0.8;
        const radius = this.width * 0.6;

        // Day/Night Progress: Sun
        let dayProgress = (this.time - 6) / 12;
        if (dayProgress >= 0 && dayProgress <= 1) {
            const angle = Math.PI + (dayProgress * Math.PI);
            const sunX = cx + Math.cos(angle) * radius * 0.8;
            const sunY = cy + Math.sin(angle) * (radius * 0.4);

            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.arc(sunX, sunY, 30, 0, Math.PI * 2);
            this.ctx.fillStyle = '#ffaa00';
            this.ctx.shadowBlur = 40;
            this.ctx.shadowColor = '#ffaa00';
            this.ctx.fill();
            this.ctx.restore();
        }

        // Moon: 18:00 -> 06:00
        let moonTime = this.time - 18;
        if (moonTime < 0) moonTime += 24;

        if (moonTime >= 0 && moonTime <= 12) {
            const moonProgress = moonTime / 12;
            const angle = Math.PI + (moonProgress * Math.PI);
            const moonX = cx + Math.cos(angle) * radius * 0.8;
            const moonY = cy + Math.sin(angle) * (radius * 0.4);

            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.arc(moonX, moonY, 25, 0, Math.PI * 2);
            this.ctx.fillStyle = '#eeffff';
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = '#ffffff';
            this.ctx.fill();
            this.ctx.restore();
        }

        this.drawStars();
        this.drawMeteors();
    }

    drawStars() {
        this.stars.forEach(s => {
            s.twinkle += s.speed;
            const opacity = 0.2 + Math.abs(Math.sin(s.twinkle)) * 0.8;
            this.ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            this.ctx.beginPath();
            this.ctx.arc(s.x * this.width, s.y * this.height, s.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    drawMeteors() {
        for (let i = this.meteors.length - 1; i >= 0; i--) {
            const m = this.meteors[i];
            m.x += m.vx;
            m.y += m.vy;
            m.len += 5;
            m.life -= 0.02;

            if (m.life <= 0) {
                this.meteors.splice(i, 1);
                continue;
            }

            this.ctx.strokeStyle = `rgba(255, 255, 255, ${m.life})`;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(m.x, m.y);
            this.ctx.lineTo(m.x - m.vx * m.len * 0.1, m.y - m.vy * m.len * 0.1);
            this.ctx.stroke();
        }
    }
}
