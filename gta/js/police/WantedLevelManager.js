/**
 * WantedLevelManager - система полиции, розыска (1–5 звезд) и стелс-укрытия в деревьях/кустах
 * 
 * Механика укрытия в растительности:
 * - Если игрок заходит в куст или находится под кроной/на дереве:
 *   - Если полиция ВИДЕЛА игрока в момент захода (была прямая видимость), полиция знает укрытие и идет туда.
 *   - Если полиция НЕ ВИДЕЛА момент захода (игрок оторвался/зашел вне зоны видимости), игрок СКРЫТ!
 *   - Пока игрок скрыт, полиция не может его обнаружить (если только не подойдет вплотную < 2м).
 *   - Таймер ухода от погони тикает, звезды мигают, и через 14 сек розыск полностью спадает.
 *   - Стрельба или нападение из куста раскрывают укрытие.
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

        // Стелс и укрытие в растительности
        this.isHidingInFoliage = false;
        this.wasInFoliage = false;
        this.seenEnteringFoliage = false;
        this.currentFoliage = null;
        this.lastKnownPosition = null;
        this.stealthToastTimer = 0;

        this.initHUD();
        this.updateHUD();
    }

    initHUD() {
        // Контейнер звезд розыска
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

        // Индикатор стелс-укрытия (Foliage Stealth Badge)
        let stealthBadge = document.getElementById('stealth-hud-badge');
        if (!stealthBadge) {
            stealthBadge = document.createElement('div');
            stealthBadge.id = 'stealth-hud-badge';
            stealthBadge.className = 'stealth-hud-badge';
            stealthBadge.innerHTML = '<span class="stealth-icon">🌿</span> <span id="stealth-hud-text">В УКРЫТИИ (НЕ ЗАМЕЧЕН)</span>';
            const uiLayer = document.getElementById('ui-layer') || document.body;
            uiLayer.appendChild(stealthBadge);
        }
    }

    reportCrime(type, pos) {
        if (window.gameEngine && window.gameEngine.isPoliceEnabled === false) return;

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

        // Любое преступление раскрывает позицию игрока
        if (pos) {
            this.lastKnownPosition = new THREE.Vector3(pos.x, pos.y, pos.z);
        }
        this.seenEnteringFoliage = true;
        this.evadeTimer = 0;
        this.isFlashing = false;
    }

    setStars(count) {
        if (window.gameEngine && window.gameEngine.isPoliceEnabled === false && count > 0) {
            count = 0;
        }
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
            this.seenEnteringFoliage = false;
        }
    }

    /**
     * Проверка прямой видимости между полицией и игроком
     */
    hasPoliceLineOfSight(playerPos) {
        if (!this.policeMgr || !playerPos) return false;

        // 1. Проверка полицейских машин
        for (let i = 0; i < this.policeMgr.policeCars.length; i++) {
            const pc = this.policeMgr.policeCars[i];
            if (pc && pc.chassisBody) {
                const dist = Math.hypot(playerPos.x - pc.chassisBody.position.x, playerPos.z - pc.chassisBody.position.z);
                if (dist < 52.0) {
                    return true;
                }
            }
        }

        // 2. Проверка офицеров полиции
        for (let i = 0; i < this.policeMgr.officers.length; i++) {
            const off = this.policeMgr.officers[i];
            if (off && off.body && !off.isDead) {
                const dist = Math.hypot(playerPos.x - off.body.position.x, playerPos.z - off.body.position.z);
                if (dist < 42.0) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Проверяет, скрыт ли игрок от конкретного наблюдателя (копа/машины)
     */
    isPlayerHidden(observerPos = null) {
        if (!this.isHidingInFoliage) return false;

        // Если полиция видела, как игрок заходил в листву — игрок не скрыт
        if (this.seenEnteringFoliage) return false;

        // Если коп подошел вплотную к укрытию (< 2.2м для пешего, < 3.8м для авто), игрок обнаружен
        if (observerPos && window.gameEngine && window.gameEngine.player && window.gameEngine.player.body) {
            const pPos = window.gameEngine.player.body.position;
            const dist = Math.hypot(pPos.x - observerPos.x, pPos.z - observerPos.z);
            if (dist < 2.2) {
                this.revealPlayer();
                return false;
            }
        }

        return true;
    }

    /**
     * Раскрыть укрытие игрока (например, подошли в упор или игрок выстрелил)
     */
    revealPlayer() {
        if (!this.seenEnteringFoliage) {
            this.seenEnteringFoliage = true;
            this.evadeTimer = 0;
            this.isFlashing = false;
            if (window.gameEngine && window.gameEngine.multiplayerHUD) {
                window.gameEngine.multiplayerHUD.addSystemMessage('⚠️ Полиция обнаружила ваше укрытие!');
            }
        }
    }

    checkFoliage(playerPos) {
        const isClimbing = (window.gameEngine && window.gameEngine.playerController && window.gameEngine.playerController.isClimbingTree);
        const vegMgr = (window.gameEngine && window.gameEngine.vegetationManager);

        if (vegMgr && typeof vegMgr.checkFoliageAt === 'function') {
            return vegMgr.checkFoliageAt(playerPos, isClimbing);
        }
        if (isClimbing) {
            return { inFoliage: true, type: 'tree_climb' };
        }
        return null;
    }

    updateHUD() {
        // Обновление звезд
        for (let i = 1; i <= 5; i++) {
            const el = document.getElementById(`wanted-star-${i}`);
            if (el) {
                if (i <= this.stars) {
                    el.classList.add('active');
                    el.style.opacity = (this.isFlashing && !this.flashVisible) ? '0.15' : '1.0';
                } else {
                    el.classList.remove('active');
                    el.style.opacity = '0.15';
                }
            }
        }

        // Обновление стелс-виджета
        const stealthBadge = document.getElementById('stealth-hud-badge');
        const stealthText = document.getElementById('stealth-hud-text');
        if (stealthBadge && stealthText) {
            if (this.isHidingInFoliage) {
                stealthBadge.style.display = 'flex';
                if (!this.seenEnteringFoliage) {
                    stealthBadge.className = 'stealth-hud-badge hidden-safe';
                    stealthText.innerText = (this.currentFoliage && this.currentFoliage.type === 'tree_climb')
                        ? 'НА ДЕРЕВЕ (СКРЫТ В КРОНЕ)'
                        : 'В ЛИСТВЕ (СКРЫТ ОТ ПОЛИЦИИ)';
                } else {
                    stealthBadge.className = 'stealth-hud-badge spotted-danger';
                    stealthText.innerText = 'ПОЛИЦИЯ ВИДИТ ВАШЕ УКРЫТИЕ!';
                }
            } else {
                stealthBadge.style.display = 'none';
            }
        }
    }

    update(deltaTime, playerPos) {
        const dt = Math.min(deltaTime, 0.1);

        // 1. Проверка нахождения игрока в деревьях/кустах
        const foliageInfo = this.checkFoliage(playerPos);
        const inFoliage = foliageInfo !== null;
        this.currentFoliage = foliageInfo;

        if (inFoliage && !this.wasInFoliage) {
            // Игрок только что забежал в куст / залез на дерево
            this.isHidingInFoliage = true;
            const policeSaw = this.hasPoliceLineOfSight(playerPos);
            this.seenEnteringFoliage = policeSaw;

            if (!policeSaw) {
                if (this.stars > 0 && window.gameEngine && window.gameEngine.multiplayerHUD) {
                    window.gameEngine.multiplayerHUD.addSystemMessage('🌿 Вы скрылись в листве! Полиция потеряла ваш след.');
                }
            } else {
                if (this.stars > 0 && window.gameEngine && window.gameEngine.multiplayerHUD) {
                    window.gameEngine.multiplayerHUD.addSystemMessage('⚠️ Полиция видела, куда вы побежали!');
                }
            }
        } else if (!inFoliage && this.wasInFoliage) {
            // Игрок вышел из кустов
            this.isHidingInFoliage = false;
            if (this.hasPoliceLineOfSight(playerPos)) {
                this.seenEnteringFoliage = true;
            }
        }
        this.wasInFoliage = inFoliage;

        if (this.stars <= 0) {
            this.updateHUD();
            return;
        }

        // 2. Определение, видит ли полиция игрока сейчас
        let isSpotted = false;
        if (this.isHidingInFoliage && !this.seenEnteringFoliage) {
            // Игрок скрыт в листве, и полиция не видела как он туда вошел
            isSpotted = false;
        } else {
            // Обычная проверка видимости
            isSpotted = this.hasPoliceLineOfSight(playerPos);
            if (isSpotted) {
                this.lastKnownPosition = playerPos ? new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z) : null;
            }
        }

        if (isSpotted) {
            // Игрок на виду: погоня в активной фазе
            this.evadeTimer = 0;
            this.isFlashing = false;
        } else {
            // Игрок скрылся (в листве или ушел от копов): запуск таймера сброса и мигание звезд
            this.isFlashing = true;
            this.evadeTimer += dt;

            // Анимация пульсации звезд
            this.flashBlinkTimer += dt;
            if (this.flashBlinkTimer >= 0.22) {
                this.flashBlinkTimer = 0;
                this.flashVisible = !this.flashVisible;
            }

            if (this.evadeTimer >= this.evadeDuration) {
                // Успешный уход от погони!
                if (window.gameEngine && window.gameEngine.multiplayerHUD) {
                    window.gameEngine.multiplayerHUD.addSystemMessage('✅ Вы успешно оторвались от полиции!');
                }
                this.setStars(0);
            }
        }

        this.updateHUD();
    }
}
window.WantedLevelManager = WantedLevelManager;
