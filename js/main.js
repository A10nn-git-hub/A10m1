// Sound FX generator using Web Audio API
class SoundFX {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
    }

    hover() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(420, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(840, this.ctx.currentTime + 0.08);

            gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + 0.08);
        } catch (e) {}
    }

    click() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(220, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(580, this.ctx.currentTime + 0.15);

            gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + 0.15);
        } catch (e) {}
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

const sfx = new SoundFX();

// Particle Canvas Background
class ParticleCanvas {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.numParticles = 55;
        this.mouse = { x: null, y: null, radius: 140 };

        this.resize();
        this.initParticles();
        this.bindEvents();
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    resize() {
        this.width = this.canvas.width = window.innerWidth;
        this.height = this.canvas.height = window.innerHeight;
    }

    initParticles() {
        this.particles = [];
        for (let i = 0; i < this.numParticles; i++) {
            this.particles.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                vx: (Math.random() - 0.5) * 0.8,
                vy: (Math.random() - 0.5) * 0.8,
                size: Math.random() * 2 + 1,
                alpha: Math.random() * 0.5 + 0.2,
                color: Math.random() > 0.5 ? '#00f0ff' : '#ff0055'
            });
        }
    }

    bindEvents() {
        window.addEventListener('resize', () => {
            this.resize();
            this.initParticles();
        });

        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.x;
            this.mouse.y = e.y;
        });

        window.addEventListener('mouseleave', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });
    }

    animate() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Update & Draw particles
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];

            p.x += p.vx;
            p.y += p.vy;

            if (p.x < 0 || p.x > this.width) p.vx *= -1;
            if (p.y < 0 || p.y > this.height) p.vy *= -1;

            // Mouse interaction
            if (this.mouse.x !== null && this.mouse.y !== null) {
                const dx = this.mouse.x - p.x;
                const dy = this.mouse.y - p.y;
                const dist = Math.hypot(dx, dy);
                if (dist < this.mouse.radius) {
                    const force = (this.mouse.radius - dist) / this.mouse.radius;
                    p.x -= (dx / dist) * force * 2;
                    p.y -= (dy / dist) * force * 2;
                }
            }

            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.alpha;
            this.ctx.fill();

            // Connect nearby particles
            for (let j = i + 1; j < this.particles.length; j++) {
                const p2 = this.particles[j];
                const dx = p.x - p2.x;
                const dy = p.y - p2.y;
                const dist = Math.hypot(dx, dy);

                if (dist < 120) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(p.x, p.y);
                    this.ctx.lineTo(p2.x, p2.y);
                    this.ctx.strokeStyle = '#38bdf8';
                    this.ctx.globalAlpha = (1 - dist / 120) * 0.15;
                    this.ctx.lineWidth = 0.8;
                    this.ctx.stroke();
                }
            }
        }

        this.ctx.globalAlpha = 1;
        requestAnimationFrame(this.animate);
    }
}

// Device Mode Manager
class DeviceModeManager {
    constructor() {
        this.STORAGE_KEY = 'gamehub_device_mode';
        this.modal = document.getElementById('device-modal');
        this.btnPc = document.getElementById('btn-select-pc');
        this.btnMobile = document.getElementById('btn-select-mobile');
        this.btnToggle = document.getElementById('device-toggle');
        this.toggleIcon = document.getElementById('device-toggle-icon');
        this.toggleText = document.getElementById('device-toggle-text');
        this.hintText = document.getElementById('platform-hint-text');

        this.init();
    }

    init() {
        const savedMode = localStorage.getItem(this.STORAGE_KEY);

        if (!savedMode) {
            // Auto detect preliminary, but show modal to let user confirm
            this.showModal();
        } else {
            this.applyMode(savedMode, false);
        }

        if (this.btnPc) {
            this.btnPc.addEventListener('click', () => {
                sfx.click();
                this.setMode('pc');
                this.hideModal();
            });
        }

        if (this.btnMobile) {
            this.btnMobile.addEventListener('click', () => {
                sfx.click();
                this.setMode('mobile');
                this.hideModal();
            });
        }

        if (this.btnToggle) {
            this.btnToggle.addEventListener('click', () => {
                sfx.click();
                const current = this.getMode();
                const nextMode = current === 'mobile' ? 'pc' : 'mobile';
                this.setMode(nextMode);
            });
        }
    }

    getMode() {
        return localStorage.getItem(this.STORAGE_KEY) || 'pc';
    }

    setMode(mode) {
        localStorage.setItem(this.STORAGE_KEY, mode);
        this.applyMode(mode, true);
    }

    showModal() {
        if (this.modal) {
            this.modal.classList.add('active');
        }
    }

    hideModal() {
        if (this.modal) {
            this.modal.classList.remove('active');
        }
    }

    applyMode(mode, userAction = false) {
        if (mode === 'mobile') {
            document.body.classList.add('mode-mobile');
            if (this.toggleIcon) this.toggleIcon.textContent = '📱';
            if (this.toggleText) this.toggleText.textContent = 'Режим: Телефон';
            if (this.hintText) this.hintText.textContent = 'Нажмите на игру для запуска';
        } else {
            document.body.classList.remove('mode-mobile');
            if (this.toggleIcon) this.toggleIcon.textContent = '🖥️';
            if (this.toggleText) this.toggleText.textContent = 'Режим: ПК';
            if (this.hintText) this.hintText.textContent = 'Нажмите на карточку или используйте клавиши [1] и [2]';
        }

        // Update links to propagate device mode
        const gtaLink = document.getElementById('btn-gta');
        if (gtaLink) {
            gtaLink.href = `gta/index.html?mode=${mode}`;
        }
        const shooterLink = document.getElementById('btn-shooter');
        if (shooterLink) {
            shooterLink.href = `shooter/index.html?mode=${mode}`;
        }
    }
}

// Card spotlight & interaction setup
document.addEventListener('DOMContentLoaded', () => {
    new ParticleCanvas('bg-canvas');
    const deviceManager = new DeviceModeManager();

    const cards = document.querySelectorAll('.game-card');

    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });

        card.addEventListener('mouseenter', () => {
            sfx.hover();
        });

        card.addEventListener('click', (e) => {
            sfx.click();
        });
    });

    // Sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', () => {
            const enabled = sfx.toggle();
            soundToggle.textContent = enabled ? '🔊 Звук: Вкл' : '🔇 Звук: Выкл';
        });
    }

    // Telegram WebApp Integration
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        try {
            tg.ready();
            tg.expand();
            if (typeof tg.requestFullscreen === 'function') {
                tg.requestFullscreen();
            }
            if (tg.BackButton) {
                tg.BackButton.hide();
            }
        } catch (e) {
            console.warn('Telegram WebApp init error:', e);
        }
    }

    // Keyboard navigation (1: GTA, 2: Shooter) - only active in PC mode
    window.addEventListener('keydown', (e) => {
        if (deviceManager.getMode() === 'mobile') return;

        if (e.key === '1') {
            const gtaBtn = document.getElementById('btn-gta');
            if (gtaBtn) gtaBtn.click();
        } else if (e.key === '2') {
            const shooterBtn = document.getElementById('btn-shooter');
            if (shooterBtn) shooterBtn.click();
        }
    });
});

