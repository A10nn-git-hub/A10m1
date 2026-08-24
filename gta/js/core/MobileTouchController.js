/**
 * Сенсорный контроллер для мобильных устройств (GTA 5 Web Engine)
 * Реализует виртуальный аналоговый джойстик, сенсорное вращение камеры,
 * педали газа/тормоза для авто, кнопки вертолета (Высадка, Наверх, Вниз), прыжка, спринта, лифта и переключения HUD по тапу.
 */
class MobileTouchController {
    constructor(engine) {
        this.engine = engine;
        this.input = engine.inputController;
        this.cameraController = engine.thirdPersonCamera;
        this.isMobile = this.detectMobileMode();

        this.joystick = {
            active: false,
            touchId: null,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            deltaX: 0,
            deltaY: 0,
            maxRadius: 45
        };

        this.cameraTouch = {
            active: false,
            touchId: null,
            lastX: 0,
            lastY: 0,
            sensitivity: 0.0042
        };

        this.sprintLocked = false;

        this.init();
    }

    detectMobileMode() {
        const urlParams = new URLSearchParams(window.location.search);
        const modeParam = urlParams.get('mode');
        if (modeParam === 'mobile') return true;
        if (modeParam === 'pc') return false;

        const stored = localStorage.getItem('gamehub_device_mode');
        if (stored === 'mobile') return true;
        if (stored === 'pc') return false;

        return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.innerWidth <= 820);
    }

    init() {
        if (!this.isMobile) {
            document.body.classList.add('pc-mode');
        } else {
            document.body.classList.add('mobile-mode');
            this.createTouchUI();
            this.bindTouchEvents();
        }

        this.setupHudTapInteractions();
    }

    setupHudTapInteractions() {
        const hudElements = [
            document.querySelector('.debug-panel'),
            document.querySelector('.status-bars-container'),
            document.querySelector('.money-hud'),
            document.querySelector('.minimap-radar-wrapper')
        ].filter(Boolean);

        hudElements.forEach((el) => {
            el.style.cursor = 'pointer';
            el.title = 'Нажмите, чтобы скрыть интерфейс';

            const onHudTap = (e) => {
                if (el.classList.contains('minimap-radar-wrapper') && !this.isMobile) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                if (this.input && this.input.onToggleHud && this.engine && this.engine.isHudVisible) {
                    this.input.onToggleHud();
                }
            };

            el.addEventListener('click', onHudTap);
            el.addEventListener('touchend', onHudTap);
        });

        let touchStartInfo = null;

        window.addEventListener('pointerdown', (e) => {
            touchStartInfo = {
                x: e.clientX,
                y: e.clientY,
                time: Date.now(),
                target: e.target
            };
        }, { passive: true });

        window.addEventListener('pointerup', (e) => {
            if (!touchStartInfo) return;
            const dt = Date.now() - touchStartInfo.time;
            const dist = Math.hypot(e.clientX - touchStartInfo.x, e.clientY - touchStartInfo.y);

            if (dt < 300 && dist < 15) {
                if (this.engine && !this.engine.isHudVisible) {
                    const isInsideControls = e.target.closest('#touch-joystick-zone, #mobile-foot-buttons, #mobile-car-buttons, #mobile-heli-buttons, .mobile-top-bar, #mobile-elevator-panel, #main-menu-overlay, .game-modal');
                    if (!isInsideControls) {
                        e.preventDefault();
                        if (this.input && this.input.onToggleHud) {
                            this.input.onToggleHud();
                        }
                    }
                }
            }
            touchStartInfo = null;
        }, { passive: false });
    }

    createTouchUI() {
        const existing = document.getElementById('mobile-controls-layer');
        if (existing) existing.remove();

        const layer = document.createElement('div');
        layer.id = 'mobile-controls-layer';
        layer.className = 'mobile-controls-layer';

        layer.innerHTML = `
            <!-- Левая зона: Виртуальный джойстик -->
            <div id="touch-joystick-zone" class="touch-joystick-zone">
                <div id="touch-joystick-base" class="touch-joystick-base">
                    <div id="touch-joystick-stick" class="touch-joystick-stick"></div>
                </div>
            </div>

            <!-- Правая зона: Сенсорный обзор камеры -->
            <div id="touch-camera-zone" class="touch-camera-zone"></div>

            <!-- Верхняя панель быстрых кнопок -->
            <div class="mobile-top-bar">
                <button id="btn-touch-pause" class="mobile-icon-btn" title="Меню / Пауза">⏸</button>
                <button id="btn-touch-map" class="mobile-icon-btn" title="Карта">🗺️</button>
                <button id="btn-touch-weather" class="mobile-icon-btn" title="Погода">🌤️</button>
                <button id="btn-touch-time" class="mobile-icon-btn" title="Время (+2ч)">⏰</button>
                <button id="btn-touch-quality" class="mobile-icon-btn" title="Качество / 60 FPS">⚡</button>
            </div>

            <!-- Кнопки управления пешком (справа внизу) -->
            <div id="mobile-foot-buttons" class="mobile-action-group foot-group">
                <button id="btn-touch-vehicle" class="mobile-action-btn vehicle-enter-btn">
                    <span class="btn-icon">🚗</span>
                    <span class="btn-label">СЕСТЬ</span>
                </button>
                <div class="mobile-btn-cluster">
                    <button id="btn-touch-sprint" class="mobile-action-btn sprint-btn">
                        <span class="btn-icon">⚡</span>
                        <span class="btn-label">БЕГ</span>
                    </button>
                    <button id="btn-touch-jump" class="mobile-action-btn jump-btn">
                        <span class="btn-icon">🦘</span>
                        <span class="btn-label">ПРЫЖОК</span>
                    </button>
                </div>
            </div>

            <!-- Кнопки управления автомобилем (справа внизу) -->
            <div id="mobile-car-buttons" class="mobile-action-group car-group" style="display:none;">
                <button id="btn-touch-car-exit" class="mobile-action-btn vehicle-exit-btn">
                    <span class="btn-icon">🚪</span>
                    <span class="btn-label">ВЫЙТИ</span>
                </button>
                <button id="btn-touch-lights" class="mobile-action-btn lights-btn">
                    <span class="btn-icon">💡</span>
                    <span class="btn-label">ФАРЫ</span>
                </button>
                <div class="mobile-pedals-cluster">
                    <button id="btn-touch-brake" class="mobile-pedal-btn brake-pedal">
                        <span class="btn-icon">🛑</span>
                        <span class="btn-label">ТОРМОЗ</span>
                    </button>
                    <button id="btn-touch-handbrake" class="mobile-action-btn handbrake-btn">
                        <span class="btn-icon">⚠️</span>
                        <span class="btn-label">РУЧНИК</span>
                    </button>
                    <button id="btn-touch-gas" class="mobile-pedal-btn gas-pedal">
                        <span class="btn-icon">🔥</span>
                        <span class="btn-label">ГАЗ</span>
                    </button>
                </div>
            </div>

            <!-- Кнопки управления вертолетом (справа внизу) -->
            <div id="mobile-heli-buttons" class="mobile-action-group heli-group" style="display:none;">
                <button id="btn-touch-heli-exit" class="mobile-action-btn vehicle-exit-btn">
                    <span class="btn-icon">🚪</span>
                    <span class="btn-label">ВЫСАДКА</span>
                </button>
                <div class="mobile-pedals-cluster">
                    <button id="btn-touch-heli-down" class="mobile-pedal-btn brake-pedal">
                        <span class="btn-icon">▼</span>
                        <span class="btn-label">ВНИЗ</span>
                    </button>
                    <button id="btn-touch-heli-up" class="mobile-pedal-btn gas-pedal">
                        <span class="btn-icon">▲</span>
                        <span class="btn-label">НАВЕРХ</span>
                    </button>
                </div>
            </div>

            <!-- Мобильная панель выбора этажей лифта Maze Bank -->
            <div id="mobile-elevator-panel" class="mobile-elevator-panel" style="display:none;">
                <div class="elevator-mobile-title">ВЫБЕРИТЕ ЭТАЖ MAZE BANK</div>
                <div class="elevator-floors-grid">
                    <button class="floor-btn" data-floor="1">1</button>
                    <button class="floor-btn" data-floor="2">2</button>
                    <button class="floor-btn" data-floor="3">3</button>
                    <button class="floor-btn" data-floor="4">4</button>
                    <button class="floor-btn" data-floor="5">5</button>
                    <button class="floor-btn" data-floor="6">6</button>
                    <button class="floor-btn" data-floor="7">7</button>
                    <button class="floor-btn" data-floor="8">8</button>
                    <button class="floor-btn" data-floor="9">9</button>
                    <button class="floor-btn heli-floor-btn" data-floor="10">10 🚁</button>
                </div>
            </div>
        `;

        document.body.appendChild(layer);
    }

    bindTouchEvents() {
        const joystickZone = document.getElementById('touch-joystick-zone');
        const joystickBase = document.getElementById('touch-joystick-base');
        const joystickStick = document.getElementById('touch-joystick-stick');
        const cameraZone = document.getElementById('touch-camera-zone');

        // 1. Джойстик перемещения
        if (joystickZone && joystickBase && joystickStick) {
            const onJoystickStart = (e) => {
                e.preventDefault();
                const touch = e.changedTouches[0];
                if (this.joystick.touchId !== null) return;

                this.joystick.active = true;
                this.joystick.touchId = touch.identifier;

                const rect = joystickBase.getBoundingClientRect();
                this.joystick.startX = rect.left + rect.width / 2;
                this.joystick.startY = rect.top + rect.height / 2;
                this.updateJoystick(touch.clientX, touch.clientY);
            };

            const onJoystickMove = (e) => {
                e.preventDefault();
                for (let i = 0; i < e.changedTouches.length; i++) {
                    const touch = e.changedTouches[i];
                    if (touch.identifier === this.joystick.touchId) {
                        this.updateJoystick(touch.clientX, touch.clientY);
                        break;
                    }
                }
            };

            const onJoystickEnd = (e) => {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    const touch = e.changedTouches[i];
                    if (touch.identifier === this.joystick.touchId) {
                        this.resetJoystick();
                        break;
                    }
                }
            };

            joystickZone.addEventListener('touchstart', onJoystickStart, { passive: false });
            window.addEventListener('touchmove', onJoystickMove, { passive: false });
            window.addEventListener('touchend', onJoystickEnd, { passive: false });
            window.addEventListener('touchcancel', onJoystickEnd, { passive: false });
        }

        // 2. Зона вращения камеры (свайпы по экрану)
        if (cameraZone) {
            cameraZone.addEventListener('touchstart', (e) => {
                if (this.cameraTouch.touchId !== null) return;
                const touch = e.changedTouches[0];
                this.cameraTouch.active = true;
                this.cameraTouch.touchId = touch.identifier;
                this.cameraTouch.lastX = touch.clientX;
                this.cameraTouch.lastY = touch.clientY;
            }, { passive: true });

            window.addEventListener('touchmove', (e) => {
                if (!this.cameraTouch.active) return;
                for (let i = 0; i < e.changedTouches.length; i++) {
                    const touch = e.changedTouches[i];
                    if (touch.identifier === this.cameraTouch.touchId) {
                        const dx = touch.clientX - this.cameraTouch.lastX;
                        const dy = touch.clientY - this.cameraTouch.lastY;

                        if (this.cameraController) {
                            this.cameraController.yaw -= dx * this.cameraTouch.sensitivity;
                            this.cameraController.pitch = Math.max(
                                -1.3,
                                Math.min(1.4, this.cameraController.pitch + dy * this.cameraTouch.sensitivity)
                            );
                        }

                        this.cameraTouch.lastX = touch.clientX;
                        this.cameraTouch.lastY = touch.clientY;
                        break;
                    }
                }
            }, { passive: true });

            const endCameraTouch = (e) => {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    const touch = e.changedTouches[i];
                    if (touch.identifier === this.cameraTouch.touchId) {
                        this.cameraTouch.active = false;
                        this.cameraTouch.touchId = null;
                        break;
                    }
                }
            };

            window.addEventListener('touchend', endCameraTouch, { passive: true });
            window.addEventListener('touchcancel', endCameraTouch, { passive: true });
        }

        // 3. Обработка кнопок действий
        this.bindButton('btn-touch-jump', 'jump', false);
        this.bindButton('btn-touch-handbrake', 'handbrake', false);
        this.bindButton('btn-touch-gas', 'forward', false);
        this.bindButton('btn-touch-brake', 'backward', false);
        this.bindButton('btn-touch-heli-up', 'jump', false);
        this.bindButton('btn-touch-heli-down', 'sprint', false);

        // Кнопка спринта (Toggle или Hold)
        const btnSprint = document.getElementById('btn-touch-sprint');
        if (btnSprint) {
            btnSprint.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.sprintLocked = !this.sprintLocked;
                if (this.input) this.input.keys.sprint = this.sprintLocked;
                btnSprint.classList.toggle('active', this.sprintLocked);
            }, { passive: false });
        }

        // Кнопка посадки/высадки из авто и вертолета
        const bindTrigger = (id, callback) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    callback();
                }, { passive: false });
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    callback();
                });
            }
        };

        bindTrigger('btn-touch-vehicle', () => {
            if (this.input && this.input.onToggleVehicle) this.input.onToggleVehicle();
        });

        bindTrigger('btn-touch-car-exit', () => {
            if (this.input && this.input.onToggleVehicle) this.input.onToggleVehicle();
        });

        bindTrigger('btn-touch-heli-exit', () => {
            if (this.input && this.input.onToggleVehicle) this.input.onToggleVehicle();
        });

        bindTrigger('btn-touch-lights', () => {
            if (this.input && this.input.onToggleHeadlights) this.input.onToggleHeadlights();
        });

        bindTrigger('btn-touch-weather', () => {
            if (this.input && this.input.onToggleWeather) this.input.onToggleWeather();
        });

        bindTrigger('btn-touch-time', () => {
            if (this.input && this.input.onTimeAdvance) this.input.onTimeAdvance(2.0);
        });

        bindTrigger('btn-touch-map', () => {
            if (this.input && this.input.onToggleMap) this.input.onToggleMap();
        });

        bindTrigger('btn-touch-pause', () => {
            if (this.input && this.input.onToggleMenu) this.input.onToggleMenu();
        });

        // Кнопки этажей лифта
        const floorBtns = document.querySelectorAll('.floor-btn');
        floorBtns.forEach(btn => {
            const handleFloorSelect = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const floor = parseInt(btn.getAttribute('data-floor'), 10);
                if (this.input && this.input.onSelectFloor && !isNaN(floor)) {
                    this.input.onSelectFloor(floor);
                }
            };
            btn.addEventListener('touchstart', handleFloorSelect, { passive: false });
            btn.addEventListener('click', handleFloorSelect);
        });
    }

    bindButton(elementId, keyName, isToggle = false) {
        const btn = document.getElementById(elementId);
        if (!btn) return;

        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.input) this.input.keys[keyName] = true;
            btn.classList.add('pressed');
        }, { passive: false });

        const endTouch = (e) => {
            e.preventDefault();
            if (this.input) this.input.keys[keyName] = false;
            btn.classList.remove('pressed');
        };

        btn.addEventListener('touchend', endTouch, { passive: false });
        btn.addEventListener('touchcancel', endTouch, { passive: false });
    }

    updateJoystick(touchX, touchY) {
        const stick = document.getElementById('touch-joystick-stick');
        let dx = touchX - this.joystick.startX;
        let dy = touchY - this.joystick.startY;
        const dist = Math.hypot(dx, dy);

        if (dist > this.joystick.maxRadius) {
            const angle = Math.atan2(dy, dx);
            dx = Math.cos(angle) * this.joystick.maxRadius;
            dy = Math.sin(angle) * this.joystick.maxRadius;
        }

        if (stick) {
            stick.style.transform = `translate(${dx}px, ${dy}px)`;
        }

        // Нормализованные значения (-1 до 1)
        const normX = dx / this.joystick.maxRadius;
        const normY = dy / this.joystick.maxRadius;
        const deadzone = 0.22;

        if (this.input) {
            const isDriving = this.engine && this.engine.vehicleManager && this.engine.vehicleManager.activeDrivenCar !== null;
            const isFlyingHeli = !!(this.engine && this.engine.helicopter && (this.engine.helicopter.isPiloted || this.engine.helicopter.isPassenger));

            if (isDriving || isFlyingHeli) {
                // В автомобиле / вертолете джойстик управляет поворотом курса (влево/вправо)
                this.input.keys.left = normX < -deadzone;
                this.input.keys.right = normX > deadzone;
                // Вперед / Назад
                if (!document.getElementById('btn-touch-gas')?.classList.contains('pressed')) {
                    this.input.keys.forward = normY < -0.45;
                }
                if (!document.getElementById('btn-touch-brake')?.classList.contains('pressed')) {
                    this.input.keys.backward = normY > 0.45;
                }
            } else {
                // Пешком: классическое перемещение по всем 4 направлениям
                this.input.keys.forward = normY < -deadzone;
                this.input.keys.backward = normY > deadzone;
                this.input.keys.left = normX < -deadzone;
                this.input.keys.right = normX > deadzone;
            }
        }
    }

    resetJoystick() {
        this.joystick.active = false;
        this.joystick.touchId = null;
        const stick = document.getElementById('touch-joystick-stick');
        if (stick) {
            stick.style.transform = 'translate(0px, 0px)';
        }

        if (this.input) {
            this.input.keys.left = false;
            this.input.keys.right = false;

            // Сбрасываем forward/backward только если не зажаты педали
            const isGasPressed = document.getElementById('btn-touch-gas')?.classList.contains('pressed');
            const isBrakePressed = document.getElementById('btn-touch-brake')?.classList.contains('pressed');
            if (!isGasPressed) this.input.keys.forward = false;
            if (!isBrakePressed) this.input.keys.backward = false;
        }
    }

    update(deltaTime) {
        if (!this.isMobile) return;

        const isDriving = this.engine && this.engine.vehicleManager && this.engine.vehicleManager.activeDrivenCar !== null;
        const isFlyingHeli = !!(this.engine && this.engine.helicopter && (this.engine.helicopter.isPiloted || this.engine.helicopter.isPassenger));
        const footButtons = document.getElementById('mobile-foot-buttons');
        const carButtons = document.getElementById('mobile-car-buttons');
        const heliButtons = document.getElementById('mobile-heli-buttons');
        const elevatorPanel = document.getElementById('mobile-elevator-panel');

        // Переключение наборов кнопок (Пешком vs В машине vs В вертолете)
        if (isFlyingHeli) {
            if (footButtons) footButtons.style.display = 'none';
            if (carButtons) carButtons.style.display = 'none';
            if (heliButtons) heliButtons.style.display = 'flex';
        } else if (isDriving) {
            if (footButtons) footButtons.style.display = 'none';
            if (carButtons) carButtons.style.display = 'flex';
            if (heliButtons) heliButtons.style.display = 'none';
        } else {
            if (footButtons) footButtons.style.display = 'flex';
            if (carButtons) carButtons.style.display = 'none';
            if (heliButtons) heliButtons.style.display = 'none';
        }

        // Показ кнопки посадки около машины / вертолета
        const vehicleEnterBtn = document.getElementById('btn-touch-vehicle');
        const vehiclePrompt = document.getElementById('vehicle-prompt');
        if (vehicleEnterBtn) {
            const canEnter = vehiclePrompt && vehiclePrompt.style.display === 'block';
            vehicleEnterBtn.style.display = canEnter ? 'flex' : 'none';
        }

        // Показ мобильной панели лифта
        const elevatorPrompt = document.getElementById('elevator-hud-prompt');
        if (elevatorPanel) {
            const isNearElevator = elevatorPrompt && elevatorPrompt.style.display === 'block';
            elevatorPanel.style.display = isNearElevator ? 'flex' : 'none';
        }
    }
}

window.MobileTouchController = MobileTouchController;
