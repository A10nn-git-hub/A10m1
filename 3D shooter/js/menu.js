/**
 * =========================================================================================
 * 3D SHOOTER MENU SYSTEM - GTA 5 HTML STYLE MAIN MENU & AURORA RENDERER
 * =========================================================================================
 */

class MenuAuroraRenderer {
    constructor() {
        this.canvas = document.getElementById('menu-aurora-canvas');
        this.ctx = (this.canvas && typeof this.canvas.getContext === 'function') ? this.canvas.getContext('2d') : null;
        this.isRunning = false;
        this.time = 0;
        this.particles = [];

        if (this.canvas) {
            this.resize();
            window.addEventListener('resize', () => this.resize());
            this.initParticles();
        }
    }

    resize() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    initParticles() {
        this.particles = [];
        const count = 65;
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * (this.canvas ? this.canvas.width : 1000),
                y: Math.random() * (this.canvas ? this.canvas.height : 800),
                radius: 1.5 + Math.random() * 2.5,
                speedY: 0.2 + Math.random() * 0.5,
                speedX: (Math.random() - 0.5) * 0.4,
                opacity: 0.2 + Math.random() * 0.7,
                hue: Math.random() > 0.5 ? 185 : (Math.random() > 0.5 ? 275 : 150)
            });
        }
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    stop() {
        this.isRunning = false;
    }

    animate() {
        if (!this.isRunning) return;
        requestAnimationFrame(this.animate);
        this.time += 0.012;
        this.render();
    }

    render() {
        if (!this.ctx || !this.canvas) return;
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // 1. Глубокий темный базовый фон
        ctx.fillStyle = '#030712';
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        // 2. Анимированные светящиеся переливающиеся сферы света (Aurora Blobs)
        const blobs = [
            { x: w * 0.25 + Math.cos(this.time * 0.8) * (w * 0.15), y: h * 0.25 + Math.sin(this.time * 0.9) * (h * 0.15), r: w * 0.38, color: 'rgba(0, 229, 255, 0.55)' },
            { x: w * 0.75 + Math.sin(this.time * 0.7) * (w * 0.18), y: h * 0.75 + Math.cos(this.time * 0.8) * (h * 0.18), r: w * 0.42, color: 'rgba(147, 51, 234, 0.50)' },
            { x: w * 0.5 + Math.cos(this.time * 1.1) * (w * 0.2), y: h * 0.5 + Math.sin(this.time * 0.7) * (h * 0.2), r: w * 0.35, color: 'rgba(6, 182, 212, 0.45)' },
            { x: w * 0.8 + Math.sin(this.time * 0.6) * (w * 0.12), y: h * 0.2 + Math.cos(this.time * 1.0) * (h * 0.15), r: w * 0.32, color: 'rgba(236, 72, 153, 0.40)' },
            { x: w * 0.15 + Math.cos(this.time * 0.9) * (w * 0.12), y: h * 0.8 + Math.sin(this.time * 0.6) * (h * 0.15), r: w * 0.34, color: 'rgba(16, 185, 129, 0.45)' }
        ];

        for (const b of blobs) {
            const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
            grad.addColorStop(0, b.color);
            grad.addColorStop(0.5, b.color.replace(/[\d\.]+\)$/, '0.22)'));
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.fill();
        }

        // 3. Плавные волновые ленты переливающегося света (Aurora Waves)
        const waveCount = 3;
        for (let i = 0; i < waveCount; i++) {
            ctx.beginPath();
            const phase = this.time + i * 1.8;
            const baseGrad = ctx.createLinearGradient(0, 0, w, h);
            if (i === 0) {
                baseGrad.addColorStop(0, 'rgba(0, 242, 254, 0.35)');
                baseGrad.addColorStop(1, 'rgba(79, 172, 254, 0.1)');
            } else if (i === 1) {
                baseGrad.addColorStop(0, 'rgba(138, 35, 135, 0.30)');
                baseGrad.addColorStop(1, 'rgba(233, 64, 87, 0.15)');
            } else {
                baseGrad.addColorStop(0, 'rgba(0, 176, 155, 0.25)');
                baseGrad.addColorStop(1, 'rgba(150, 201, 61, 0.1)');
            }
            ctx.fillStyle = baseGrad;

            ctx.moveTo(0, h);
            for (let x = 0; x <= w; x += 25) {
                const y = (h * 0.45 + i * 90) + Math.sin(x * 0.003 + phase) * 75 + Math.cos(x * 0.006 - phase * 0.8) * 45;
                ctx.lineTo(x, y);
            }
            ctx.lineTo(w, h);
            ctx.closePath();
            ctx.fill();
        }

        // 4. Парящие мерцающие частицы света
        for (const p of this.particles) {
            p.y -= p.speedY;
            p.x += p.speedX + Math.sin(this.time + p.y * 0.01) * 0.3;
            if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
            if (p.x < -10) p.x = w + 10;
            if (p.x > w + 10) p.x = -10;

            const pulse = 0.5 + Math.sin(this.time * 2.0 + p.x) * 0.5;
            ctx.fillStyle = `hsla(${p.hue}, 90%, 65%, ${p.opacity * (0.6 + pulse * 0.4)})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}
window.MenuAuroraRenderer = MenuAuroraRenderer;

class MainMenuManager {
    constructor() {
        this.mainMenu = document.getElementById('main-menu-overlay');
        this.settingsModal = document.getElementById('settings-modal');
        this.aboutModal = document.getElementById('about-modal');
        this.auroraRenderer = new MenuAuroraRenderer();

        this.menuBadge = document.getElementById('menu-badge');
        this.menuTitle = document.getElementById('menu-title');
        this.menuSub = document.getElementById('menu-sub');
        this.btnPlay = document.getElementById('btn-menu-play');
        this.btnPlayText = document.getElementById('btn-play-text');
        this.btnSettings = document.getElementById('btn-menu-settings');
        this.btnAbout = document.getElementById('btn-menu-about');
        this.btnExit = document.getElementById('btn-menu-exit');

        this.btnCloseSettings = document.getElementById('btn-close-settings');
        this.btnSaveSettings = document.getElementById('btn-save-settings');
        this.sensRange = document.getElementById('menu-sens-range');
        this.sensVal = document.getElementById('menu-sens-val');

        this.btnCloseAbout = document.getElementById('btn-close-about');
        this.btnCloseAboutFooter = document.getElementById('btn-close-about-footer');

        this.isMenuOpen = true;
        this.isGameStarted = false;

        this.initUI();
        this.initModeDisplay();

        // Handle Escape Key for Menu / Pause toggle
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') {
                e.preventDefault();
                this.toggleMenuFromGame();
            }
        });

        // If launched with game parameters from Game Hub, bypass menu and start game directly
        const urlParams = new URLSearchParams(window.location.search);
        const hasLaunchParams = urlParams.has('lobby') || urlParams.has('mode') || urlParams.has('device');
        if (hasLaunchParams) {
            this.startGame();
        } else if (this.auroraRenderer) {
            this.auroraRenderer.start();
        }
    }

    initModeDisplay() {
        const urlParams = new URLSearchParams(window.location.search);
        const urlMode = urlParams.get('mode') || (typeof currentMode !== 'undefined' ? currentMode : 'tdm_5v5');
        const modeMap = {
            'tdm_5v5': 'КОМАНДНЫЙ БОЙ 5х5',
            'duel_1v1': 'ТАКТИЧЕСКАЯ ДУЭЛЬ 1х1',
            'duel_2v2': 'КОМАНДНАЯ ДУЭЛЬ 2х2',
            'br_tdm_5v5': 'КОМАНДНЫЙ БОЙ 5х5',
            'br_duel_1v1': 'ТАКТИЧЕСКАЯ ДУЭЛЬ 1х1',
            'br_duel_2v2': 'КОМАНДНАЯ ДУЭЛЬ 2х2'
        };
        const label = modeMap[urlMode] || 'ТАКТИЧЕСКИЙ БОЙ';
        if (this.menuBadge) {
            this.menuBadge.innerHTML = `<span class="badge-dot"></span> РЕЖИМ: ${label}`;
        }
    }

    setMenuMode(mode) {
        if (mode === 'PAUSE') {
            if (this.menuBadge) this.menuBadge.innerHTML = '<span class="badge-dot" style="background:#f59e0b;box-shadow:0 0 10px #f59e0b;"></span> ИГРА ПРИОСТАНОВЛЕНА';
            if (this.menuTitle) this.menuTitle.innerHTML = 'ПАУЗА';
            if (this.menuSub) this.menuSub.innerText = 'STANDOFF TACTICAL 3D';
            if (this.btnPlayText) this.btnPlayText.innerText = 'ПРОДОЛЖИТЬ';
        } else {
            this.initModeDisplay();
            if (this.menuTitle) this.menuTitle.innerHTML = '3D SHOOTER <span>TACTICAL</span>';
            if (this.menuSub) this.menuSub.innerText = 'WEBGL 3D TACTICAL ENGINE';
            if (this.btnPlayText) this.btnPlayText.innerText = 'НАЧАТЬ ИГРУ';
        }
    }

    initUI() {
        const addBtnAction = (btn, action) => {
            if (!btn) return;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                action();
            });
            btn.addEventListener('touchend', (e) => {
                e.stopPropagation();
                e.preventDefault();
                action();
            }, { passive: false });
        };

        addBtnAction(this.btnPlay, () => this.startGame());
        addBtnAction(this.btnSettings, () => this.openSettings());
        addBtnAction(this.btnCloseSettings, () => this.closeSettings());
        addBtnAction(this.btnSaveSettings, () => this.closeSettings());
        addBtnAction(this.btnAbout, () => this.openAbout());
        addBtnAction(this.btnCloseAbout, () => this.closeAbout());
        addBtnAction(this.btnCloseAboutFooter, () => this.closeAbout());
        addBtnAction(this.btnExit, () => {
            if (typeof returnToHub === 'function') returnToHub();
            else window.location.href = '../index.html';
        });

        if (this.sensRange) {
            const curSens = parseFloat(localStorage.getItem('br3d_sens_mult') || '5.0');
            this.sensRange.value = curSens;
            if (this.sensVal) this.sensVal.innerText = curSens.toFixed(1);
            this.sensRange.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value) || 5.0;
                if (this.sensVal) this.sensVal.innerText = val.toFixed(1);
                localStorage.setItem('br3d_sens_mult', val.toString());
                if (typeof br3D !== 'undefined') {
                    br3D.sensitivity = 0.00048 * val;
                    localStorage.setItem('br3d_sens', String(br3D.sensitivity));
                }
            });
        }
    }

    startGame() {
        this.isMenuOpen = false;
        this.isGameStarted = true;
        if (this.mainMenu) {
            this.mainMenu.classList.add('menu-hidden');
            this.mainMenu.style.display = 'none';
        }
        if (this.auroraRenderer) {
            this.auroraRenderer.stop();
        }

        // If team hasn't been chosen yet, show team select overlay; otherwise resume match
        if (typeof initBR === 'function') {
            initBR();
        }
    }

    toggleMenuFromGame() {
        if (this.isAnyModalOpen()) {
            this.closeSettings();
            this.closeAbout();
            return;
        }

        if (this.isMenuOpen) {
            this.startGame();
        } else {
            this.isMenuOpen = true;
            this.setMenuMode('PAUSE');
            if (this.mainMenu) {
                this.mainMenu.classList.remove('menu-hidden');
            }
            if (this.auroraRenderer) {
                this.auroraRenderer.start();
            }
            if (typeof exit3DPointerLock === 'function') {
                exit3DPointerLock();
            }
        }
    }

    isAnyModalOpen() {
        const isSettings = this.settingsModal && this.settingsModal.classList.contains('active');
        const isAbout = this.aboutModal && this.aboutModal.classList.contains('active');
        return isSettings || isAbout;
    }

    openSettings() {
        if (this.settingsModal) {
            this.settingsModal.classList.add('active');
        }
    }

    closeSettings() {
        if (this.settingsModal) {
            this.settingsModal.classList.remove('active');
        }
    }

    openAbout() {
        if (this.aboutModal) {
            this.aboutModal.classList.add('active');
        }
    }

    closeAbout() {
        if (this.aboutModal) {
            this.aboutModal.classList.remove('active');
        }
    }
}
window.MainMenuManager = MainMenuManager;
