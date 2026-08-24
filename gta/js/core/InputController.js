/**
 * Контроллер ввода (с поддержкой русской/английской раскладки, стрельбы, миссий и выбора оружия)
 */
class InputController {
    constructor() {
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            sprint: false,
            jump: false,
            handbrake: false
        };

        this.bindings = this.getDefaultBindings();

        this.onToggleVehicle = null;
        this.onToggleHeadlights = null;
        this.onToggleWeather = null;
        this.onToggleMap = null;
        this.onTimeAdvance = null;
        this.onToggleHud = null;
        this.onSelectFloor = null;
        this.onToggleMenu = null;
        this.onInteract = null;
        this.onFire = null;
        this.onStopFire = null;
        this.onNextWeapon = null;
        this.onPrevWeapon = null;
        this.onSelectWeapon = null;

        this.initListeners();
    }

    getDefaultBindings() {
        return {
            foot_forward: { code: 'KeyW', display: 'W', category: 'foot' },
            foot_backward: { code: 'KeyS', display: 'S', category: 'foot' },
            foot_left: { code: 'KeyA', display: 'A', category: 'foot' },
            foot_right: { code: 'KeyD', display: 'D', category: 'foot' },
            foot_sprint: { code: 'ShiftLeft', alt: ['ShiftRight'], display: 'Shift', category: 'foot' },
            foot_jump: { code: 'Space', display: 'Space', category: 'foot' },
            foot_vehicle: { code: 'KeyF', display: 'F', category: 'foot' },
            foot_interact: { code: 'KeyE', display: 'E', category: 'foot' },

            car_forward: { code: 'KeyW', display: 'W', category: 'car' },
            car_backward: { code: 'KeyS', display: 'S', category: 'car' },
            car_left: { code: 'KeyA', display: 'A', category: 'car' },
            car_right: { code: 'KeyD', display: 'D', category: 'car' },
            car_handbrake: { code: 'Space', display: 'Space', category: 'car' },
            car_vehicle: { code: 'KeyF', display: 'F', category: 'car' },
            car_lights: { code: 'KeyL', display: 'L', category: 'car' },
            car_interact: { code: 'KeyE', display: 'E', category: 'car' },

            sys_map: { code: 'KeyM', display: 'M', category: 'sys' },
            sys_weather: { code: 'KeyU', display: 'U', category: 'sys' },
            sys_time: { code: 'KeyT', display: 'T', category: 'sys' },
            sys_hud: { code: 'Tab', display: 'Tab', category: 'sys' }
        };
    }

    resetBindings() {
        this.bindings = this.getDefaultBindings();
    }

    rebind(action, newCode, display) {
        const cat = (this.bindings[action] && this.bindings[action].category) || 'foot';
        this.bindings[action] = {
            code: newCode,
            display: display,
            category: cat
        };
    }

    matches(action, e, ignoreModals = false) {
        if (!ignoreModals && window.gameEngine && window.gameEngine.mainMenuManager) {
            if (window.gameEngine.mainMenuManager.isMenuOpen || window.gameEngine.mainMenuManager.isAnyModalOpen()) {
                return false;
            }
        }

        const isDriving = window.gameEngine && window.gameEngine.vehicleManager && window.gameEngine.vehicleManager.activeDrivenCar !== null;
        const prefix = isDriving ? 'car_' : 'foot_';
        const boundKey = this.bindings[prefix + action] || this.bindings[action] || this.bindings['sys_' + action];

        if (!boundKey) return false;
        if (e.code === boundKey.code) return true;
        if (boundKey.alt && boundKey.alt.includes(e.code)) return true;

        const k = e.key ? e.key.toLowerCase() : '';
        if (action === 'forward' && (k === 'w' || k === 'ц')) return true;
        if (action === 'backward' && (k === 's' || k === 'ы')) return true;
        if (action === 'left' && (k === 'a' || k === 'ф')) return true;
        if (action === 'right' && (k === 'd' || k === 'в')) return true;
        if (action === 'vehicle' && (k === 'f' || k === 'а')) return true;
        if (action === 'interact' && (k === 'e' || k === 'у')) return true;
        if (action === 'lights' && (k === 'l' || k === 'д')) return true;
        if (action === 'weather' && (k === 'u' || k === 'г')) return true;
        if (action === 'map' && (k === 'm' || k === 'ь')) return true;
        if (action === 'time' && (k === 't' || k === 'е')) return true;
        return false;
    }

    initListeners() {
        window.addEventListener('keydown', (e) => {
            const isTyping = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
            const mpHud = window.gameEngine && window.gameEngine.multiplayerHUD;

            if (isTyping) {
                if (e.code === 'Escape') {
                    if (mpHud) mpHud.closeChat();
                    e.target.blur();
                }
                return; // Не активируем игровые клавиши во время ввода текста в чат или настройки
            }

            const menuMgr = window.gameEngine && window.gameEngine.mainMenuManager;
            const isRebinding = menuMgr && menuMgr.activeRebindAction !== null;
            const isMainMenuOpen = menuMgr && menuMgr.isMenuOpen;
            const isSettingsOrAboutOpen = menuMgr && (
                (menuMgr.settingsModal && menuMgr.settingsModal.classList.contains('active')) ||
                (menuMgr.aboutModal && menuMgr.aboutModal.classList.contains('active')) ||
                (document.getElementById('mp-settings-modal') && document.getElementById('mp-settings-modal').classList.contains('active'))
            );

            // Горячие клавиши мультиплеера: T или Enter для чата (только в онлайн режиме), F2 для таблицы игроков
            if (!isRebinding && !isMainMenuOpen && !isSettingsOrAboutOpen) {
                const isOnline = window.gameEngine && window.gameEngine.multiplayerManager && window.gameEngine.multiplayerManager.status === 'CONNECTED';
                if (isOnline && (e.code === 'KeyT' || e.code === 'Enter')) {
                    e.preventDefault();
                    if (mpHud) mpHud.toggleChat();
                    return;
                }
                if (e.code === 'F2') {
                    e.preventDefault();
                    if (mpHud) mpHud.toggleScoreboard();
                    return;
                }
            }

            if (!isRebinding && !isMainMenuOpen && !isSettingsOrAboutOpen && this.matches('map', e, true)) {
                if (this.onToggleMap) {
                    this.onToggleMap();
                    return;
                }
            }

            if (e.code === 'Escape') {
                if (mpHud && mpHud.isChatOpen) {
                    mpHud.closeChat();
                    return;
                }
                if (mpHud && mpHud.scoreboardModal && mpHud.scoreboardModal.classList.contains('active')) {
                    mpHud.closeScoreboard();
                    return;
                }
                if (this.onToggleMenu) this.onToggleMenu();
                return;
            }

            if (menuMgr && (menuMgr.isMenuOpen || menuMgr.isAnyModalOpen())) {
                return;
            }

            if (this.matches('forward', e)) this.keys.forward = true;
            if (this.matches('backward', e)) this.keys.backward = true;
            if (this.matches('left', e)) this.keys.left = true;
            if (this.matches('right', e)) this.keys.right = true;
            if (this.matches('jump', e)) this.keys.jump = true;
            if (this.matches('handbrake', e)) this.keys.handbrake = true;
            if (this.matches('sprint', e)) this.keys.sprint = true;

            if (this.matches('vehicle', e)) if (this.onToggleVehicle) this.onToggleVehicle();
            if (this.matches('interact', e)) {
                if (this.onInteract) this.onInteract();
            }
            if (this.matches('lights', e)) if (this.onToggleHeadlights) this.onToggleHeadlights();
            if (this.matches('weather', e)) if (this.onToggleWeather) this.onToggleWeather();
            if (this.matches('map', e)) if (this.onToggleMap) this.onToggleMap();
            if (this.matches('time', e)) if (this.onTimeAdvance) this.onTimeAdvance(2.0);

            if (this.matches('hud', e) || e.code === 'Tab') {
                e.preventDefault();
                if (this.onToggleHud) this.onToggleHud();
            }

            // Проверка лифта vs оружия
            const elevatorSystem = window.gameEngine && window.gameEngine.elevatorSystem;
            const elevatorPrompt = document.getElementById('elevator-hud-prompt');
            const isElevatorActive = (elevatorSystem && elevatorSystem.isPlayerInside) ||
                                     (elevatorPrompt && (elevatorPrompt.classList.contains('active') || elevatorPrompt.style.display === 'block'));

            const c = e.code;
            const k = e.key;

            let floorSelected = -1;
            if (c === 'Digit1' || c === 'Numpad1' || k === '1') floorSelected = 1;
            else if (c === 'Digit2' || c === 'Numpad2' || k === '2') floorSelected = 2;
            else if (c === 'Digit3' || c === 'Numpad3' || k === '3') floorSelected = 3;
            else if (c === 'Digit4' || c === 'Numpad4' || k === '4') floorSelected = 4;
            else if (c === 'Digit5' || c === 'Numpad5' || k === '5') floorSelected = 5;
            else if (c === 'Digit6' || c === 'Numpad6' || k === '6') floorSelected = 6;
            else if (c === 'Digit7' || c === 'Numpad7' || k === '7') floorSelected = 7;
            else if (c === 'Digit8' || c === 'Numpad8' || k === '8') floorSelected = 8;
            else if (c === 'Digit9' || c === 'Numpad9' || k === '9') floorSelected = 9;
            else if (c === 'Digit0' || c === 'Numpad0' || k === '0') floorSelected = 10;

            if (isElevatorActive && floorSelected > 0) {
                if (this.onSelectFloor) {
                    this.onSelectFloor(floorSelected);
                }
                return;
            }

            if (!isElevatorActive && floorSelected > 0 && floorSelected <= 5) {
                if (this.onSelectWeapon) this.onSelectWeapon(floorSelected - 1);
            }
        });

        window.addEventListener('keyup', (e) => {
            if (this.matches('forward', e)) this.keys.forward = false;
            if (this.matches('backward', e)) this.keys.backward = false;
            if (this.matches('left', e)) this.keys.left = false;
            if (this.matches('right', e)) this.keys.right = false;
            if (this.matches('jump', e)) this.keys.jump = false;
            if (this.matches('handbrake', e)) this.keys.handbrake = false;
            if (this.matches('sprint', e)) this.keys.sprint = false;
        });

        // Стрельба и смена оружия мышью
        window.addEventListener('mousedown', (e) => {
            const menuMgr = window.gameEngine && window.gameEngine.mainMenuManager;
            if (menuMgr && (menuMgr.isMenuOpen || menuMgr.isAnyModalOpen())) return;
            if (e.target && (e.target.tagName === 'BUTTON' || e.target.closest('.modal') || e.target.closest('#main-menu-overlay'))) return;

            if (e.button === 0) {
                if (this.onFire) this.onFire();
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                if (this.onStopFire) this.onStopFire();
            }
        });

        window.addEventListener('wheel', (e) => {
            const menuMgr = window.gameEngine && window.gameEngine.mainMenuManager;
            if (menuMgr && (menuMgr.isMenuOpen || menuMgr.isAnyModalOpen())) return;

            if (e.deltaY > 0) {
                if (this.onNextWeapon) this.onNextWeapon();
            } else if (e.deltaY < 0) {
                if (this.onPrevWeapon) this.onPrevWeapon();
            }
        }, { passive: true });
    }
}
window.InputController = InputController;
