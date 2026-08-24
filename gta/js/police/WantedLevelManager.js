/**
 * WantedLevelManager - система розыска (1–5 звезд), фиксации преступлений и ухода от погони
 */
class WantedLevelManager {
    constructor(scene, world, policeVehicleManager) {
        this.scene = scene;
        this.world = world;
        this.policeMgr = policeVehicleManager;

        this.stars = 0;
        this.maxStars = 5;
        this.evadeTimer = 0.0;
        this.evadeDuration = 14.0;
        this.isFlashing = false;
        this.flashBlinkTimer = 0;
        this.flashVisible = true;

        this.initHUD();
        this.updateHUD();
    }

    initHUD() {
        let container = document.getElementById('wanted-stars');
        if (!container) {
            container = document.createElement('div');
            container.id = 'wanted-stars';
            container.className = 'wanted-stars';
            let html = '';
            for (let i = 1; i <= 5; i++) {
                html += `<span class="wanted-star" id="wanted-star-${i}">★</span>`;
            }
            container.innerHTML = html;
            const uiLayer = document.getElementById('ui-layer') || document.body;
            uiLayer.appendChild(container);
        }
    }

    reportCrime(type) {
        let starsToAdd = 0;
        if (type === 'PUNCH' && this.stars === 0) starsToAdd = 1;
        else if (type === 'GUNFIRE') starsToAdd = (this.stars === 0 ? 1 : 0);
        else if (type === 'KILL_CIVILIAN') starsToAdd = 1;
        else if (type === 'STEAL_CAR') starsToAdd = (this.stars < 2 ? 1 : 0);
        else if (type === 'CAR_EXPLOSION') starsToAdd = 2;
        else if (type === 'KILL_COP') starsToAdd = 2;

        if (starsToAdd > 0) {
            this.setStars(Math.min(this.maxStars, this.stars + starsToAdd));
        }

        // Сброс таймера ухода от погони при новом преступлении
        this.evadeTimer = 0;
        this.isFlashing = false;
    }

    setStars(count) {
        const old = this.stars;
        this.stars = Math.max(0, Math.min(this.maxStars, count));
        this.updateHUD();

        if (this.stars > 0 && old === 0) {
            // Включение сирены полиции
            if (window.soundEngine && typeof window.soundEngine.setPoliceSirenState === 'function') {
                window.soundEngine.setPoliceSirenState(true);
            }
        } else if (this.stars === 0 && old > 0) {
            // Отключение сирены и очистка копов
            if (window.soundEngine && typeof window.soundEngine.setPoliceSirenState === 'function') {
                window.soundEngine.setPoliceSirenState(false);
            }
            if (this.policeMgr) {
                this.policeMgr.clearAllPolice();
            }
        }
    }

    updateHUD() {
        for (let i = 1; i <= 5; i++) {
            const el = document.getElementById(`wanted-star-${i}`);
            if (el) {
                if (i <= this.stars) {
                    el.classList.add('active');
                    el.style.opacity = (this.isFlashing && !this.flashVisible) ? '0.2' : '1.0';
                } else {
                    el.classList.remove('active');
                    el.style.opacity = '0.2';
                }
            }
        }
    }

    update(deltaTime, playerPos) {
        if (this.stars <= 0) return;
        const dt = Math.min(deltaTime, 0.1);

        // Проверяем, есть ли рядом полицейские машины или офицеры
        let isSpotted = false;
        if (this.policeMgr && playerPos) {
            for (let i = 0; i < this.policeMgr.policeCars.length; i++) {
                const pc = this.policeMgr.policeCars[i];
                if (pc.chassisBody) {
                    const dist = Math.hypot(playerPos.x - pc.chassisBody.position.x, playerPos.z - pc.chassisBody.position.z);
                    if (dist < 48.0) {
                        isSpotted = true;
                        break;
                    }
                }
            }
            if (!isSpotted) {
                for (let i = 0; i < this.policeMgr.officers.length; i++) {
                    const off = this.policeMgr.officers[i];
                    if (off.body && !off.isDead) {
                        const dist = Math.hypot(playerPos.x - off.body.position.x, playerPos.z - off.body.position.z);
                        if (dist < 40.0) {
                            isSpotted = true;
                            break;
                        }
                    }
                }
            }
        }

        if (isSpotted) {
            // Игрок в поле зрения копов: погоня продолжается
            this.evadeTimer = 0;
            this.isFlashing = false;
        } else {
            // Игрок скрылся: запуск таймера сброса и мигание звезд
            this.isFlashing = true;
            this.evadeTimer += dt;

            // Анимация пульсации звезд
            this.flashBlinkTimer += dt;
            if (this.flashBlinkTimer >= 0.25) {
                this.flashBlinkTimer = 0;
                this.flashVisible = !this.flashVisible;
            }

            if (this.evadeTimer >= this.evadeDuration) {
                // Успешный уход от погони!
                this.setStars(0);
            }
        }

        this.updateHUD();
    }
}
window.WantedLevelManager = WantedLevelManager;
