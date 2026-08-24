/**
 * Физический контроллер геймпада / джойстика (Gamepad API) для ПК и браузера
 * Поддерживает контроллеры Xbox Series/One/360, PlayStation DualSense/DualShock 4/3,
 * Nintendo Switch Pro Controller и стандартные USB/Bluetooth геймпады (W3C Standard Mapping).
 */
class GamepadController {
    constructor(inputController, cameraController) {
        this.input = inputController;
        this.camera = cameraController;

        this.gamepadIndex = null;
        this.gamepadName = '';
        this.isConnected = false;

        this.deadzone = 0.16;
        this.cameraSensitivity = 3.2; // Чувствительность правого стика (рад/сек)

        // Предыдущие состояния кнопок для разовых триггеров (Edge Detection)
        this.prevButtons = new Array(20).fill(false);

        // Индикатор геймпада на экране
        this.hudBadge = null;

        this.initEvents();
    }

    initEvents() {
        window.addEventListener('gamepadconnected', (e) => {
            this.gamepadIndex = e.gamepad.index;
            this.gamepadName = e.gamepad.id || 'Геймпад';
            this.isConnected = true;
            this.showToast(`🎮 Подключен контроллер: ${this.cleanGamepadName(this.gamepadName)}`);
            this.updateHudBadge(true);
        });

        window.addEventListener('gamepaddisconnected', (e) => {
            if (this.gamepadIndex === e.gamepad.index) {
                this.isConnected = false;
                this.gamepadIndex = null;
                this.showToast('🎮 Контроллер отключен');
                this.updateHudBadge(false);
            }
        });
    }

    cleanGamepadName(rawName) {
        if (!rawName) return 'Контроллер';
        if (/xbox/i.test(rawName)) return 'Xbox Controller';
        if (/dualshock|dualsense|wireless controller/i.test(rawName)) return 'PlayStation Controller';
        if (/switch|nintendo/i.test(rawName)) return 'Nintendo Switch Pro Controller';
        return rawName.split('(')[0].trim() || 'USB Gamepad';
    }

    showToast(message) {
        let toast = document.getElementById('gamepad-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'gamepad-toast';
            toast.className = 'opt-toast gamepad-toast';
            document.body.appendChild(toast);
        }
        toast.innerHTML = `<span style="font-size:15px; margin-right:6px;">🎮</span> <b>${message}</b>`;
        toast.style.display = 'block';
        toast.style.animation = 'toastSlideUp 0.3s ease-out';

        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            if (toast) toast.style.display = 'none';
        }, 3500);
    }

    updateHudBadge(connected) {
        let badge = document.getElementById('gamepad-hud-indicator');
        if (connected) {
            if (!badge) {
                badge = document.createElement('div');
                badge.id = 'gamepad-hud-indicator';
                badge.className = 'gamepad-hud-badge';
                badge.title = 'Физический геймпад активен';
                badge.innerHTML = `<span class="gp-icon">🎮</span> <span class="gp-text">${this.cleanGamepadName(this.gamepadName)}</span>`;
                const uiLayer = document.getElementById('ui-layer');
                if (uiLayer) uiLayer.appendChild(badge);
            }
            badge.style.display = 'flex';
        } else {
            if (badge) badge.style.display = 'none';
        }
    }

    /**
     * Тактильная вибрация контроллера (Haptic Feedback)
     */
    vibrate(duration = 200, strong = 0.6, weak = 0.6) {
        if (!this.isConnected || this.gamepadIndex === null) return;
        const gp = this.getGamepad();
        if (!gp || !gp.vibrationActuator) return;

        try {
            gp.vibrationActuator.playEffect('dual-rumble', {
                startDelay: 0,
                duration: duration,
                weakMagnitude: Math.min(1.0, weak),
                strongMagnitude: Math.min(1.0, strong)
            }).catch(() => {});
        } catch (e) {}
    }

    getGamepad() {
        if (!navigator.getGamepads) return null;
        const gamepads = navigator.getGamepads();
        if (this.gamepadIndex !== null && gamepads[this.gamepadIndex]) {
            return gamepads[this.gamepadIndex];
        }
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i] && gamepads[i].connected) {
                this.gamepadIndex = i;
                this.gamepadName = gamepads[i].id;
                this.isConnected = true;
                return gamepads[i];
            }
        }
        return null;
    }

    applyDeadzone(val) {
        if (Math.abs(val) < this.deadzone) return 0;
        return val;
    }

    /**
     * Опрос состояния геймпада каждый кадр (вызывается из Engine.animate)
     */
    update(deltaTime) {
        const gp = this.getGamepad();
        if (!gp) {
            this.isConnected = false;
            return;
        }
        this.isConnected = true;

        const dt = Math.min(deltaTime, 0.1);
        const axes = gp.axes || [];
        const btns = gp.buttons || [];

        const isDriving = window.gameEngine && window.gameEngine.vehicleManager && window.gameEngine.vehicleManager.activeDrivenCar !== null;

        // 1. ЛЕВЫЙ СТИК (Аналоговое управление движением)
        const rawLx = axes[0] !== undefined ? axes[0] : 0;
        const rawLy = axes[1] !== undefined ? axes[1] : 0;
        const lx = this.applyDeadzone(rawLx);
        const ly = this.applyDeadzone(rawLy);

        if (this.input) {
            if (lx !== 0 || ly !== 0) {
                this.input.keys.left = lx < -0.22;
                this.input.keys.right = lx > 0.22;
                this.input.keys.forward = ly < -0.22;
                this.input.keys.backward = ly > 0.22;
            }

            // 2. КУРКИ L2 / R2 (RT: Газ/Стрельба, LT: Тормоз/Задний ход/Прицел)
            const ltValue = (btns[6] ? (btns[6].value !== undefined ? btns[6].value : (btns[6].pressed ? 1 : 0)) : 0);
            const rtValue = (btns[7] ? (btns[7].value !== undefined ? btns[7].value : (btns[7].pressed ? 1 : 0)) : 0);

            if (isDriving) {
                // В автомобиле: RT = Газ, LT = Тормоз/Задний ход
                if (rtValue > 0.15) this.input.keys.forward = true;
                if (ltValue > 0.15) this.input.keys.backward = true;
            } else {
                // Пешком: RT = Стрельба / Удар
                const isFiringNow = rtValue > 0.35 || (btns[5] && btns[5].pressed); // RT или RB
                if (isFiringNow) {
                    if (this.input.onFire) this.input.onFire();
                } else {
                    if (this.input.onStopFire) this.input.onStopFire();
                }
            }

            // 3. КНОПКИ (W3C Standard Mapping)
            // Button 0 (A / Cross): Прыжок пешком / Ручник в машине
            if (btns[0]) {
                if (isDriving) {
                    this.input.keys.handbrake = btns[0].pressed;
                } else {
                    this.input.keys.jump = btns[0].pressed;
                }
            }

            // Button 1 (B / Circle): Ручной тормоз / Выход из лифта
            if (btns[1] && btns[1].pressed) {
                this.input.keys.handbrake = true;
            }

            // Button 2 (X / Square): Перезарядка / Тормоз
            if (btns[2] && btns[2].pressed) {
                if (isDriving) this.input.keys.backward = true;
            }

            // Button 3 (Y / Triangle): Сесть / Выйти из машины (Триггер по переднему фронту)
            if (btns[3] && btns[3].pressed && !this.prevButtons[3]) {
                if (this.input.onToggleVehicle) this.input.onToggleVehicle();
            }

            // Button 4 (LB / L1): Предыдущее оружие
            if (btns[4] && btns[4].pressed && !this.prevButtons[4]) {
                if (this.input.onPrevWeapon) this.input.onPrevWeapon();
            }

            // Button 5 (RB / R1): Следующее оружие
            if (btns[5] && btns[5].pressed && !this.prevButtons[5] && isDriving) {
                // В машине переключает радио/фары
                if (this.input.onToggleHeadlights) this.input.onToggleHeadlights();
            } else if (btns[5] && btns[5].pressed && !this.prevButtons[5] && !isDriving) {
                if (this.input.onNextWeapon) this.input.onNextWeapon();
            }

            // Button 8 (Select / Back / Share): Карта города (M)
            if (btns[8] && btns[8].pressed && !this.prevButtons[8]) {
                if (this.input.onToggleMap) this.input.onToggleMap();
            }

            // Button 9 (Start / Options): Меню / Пауза (Esc)
            if (btns[9] && btns[9].pressed && !this.prevButtons[9]) {
                if (this.input.onToggleMenu) this.input.onToggleMenu();
            }

            // Button 10 (L3 / Нажатие левого стика): Спринт (Бег) / Клаксон
            if (btns[10]) {
                this.input.keys.sprint = btns[10].pressed;
            }

            // D-Pad Up (Button 12): Фары / Время суток
            if (btns[12] && btns[12].pressed && !this.prevButtons[12]) {
                if (isDriving && this.input.onToggleHeadlights) {
                    this.input.onToggleHeadlights();
                } else if (this.input.onTimeAdvance) {
                    this.input.onTimeAdvance(2.0);
                }
            }

            // D-Pad Down (Button 13): Смена погоды (U)
            if (btns[13] && btns[13].pressed && !this.prevButtons[13]) {
                if (this.input.onToggleWeather) this.input.onToggleWeather();
            }

            // D-Pad Left / Right (Button 14 & 15): Выбор этажа в лифте или оружия
            const elevator = window.gameEngine && window.gameEngine.elevatorSystem;
            if (elevator && elevator.isPlayerInside) {
                if (btns[14] && btns[14].pressed && !this.prevButtons[14]) {
                    const nextFloor = Math.max(1, elevator.currentFloorIndex);
                    elevator.selectFloor(nextFloor);
                }
                if (btns[15] && btns[15].pressed && !this.prevButtons[15]) {
                    const nextFloor = Math.min(10, elevator.currentFloorIndex + 2);
                    elevator.selectFloor(nextFloor);
                }
            }
        }

        // 4. ПРАВЫЙ СТИК (Аналоговое плавное вращение камеры обзора)
        if (this.camera) {
            const rawRx = axes[2] !== undefined ? axes[2] : 0;
            const rawRy = axes[3] !== undefined ? axes[3] : 0;
            const rx = this.applyDeadzone(rawRx);
            const ry = this.applyDeadzone(rawRy);

            if (rx !== 0 || ry !== 0) {
                this.camera.yaw -= rx * this.cameraSensitivity * dt;
                this.camera.pitch = THREE.MathUtils.clamp(
                    this.camera.pitch + ry * this.cameraSensitivity * dt,
                    -1.3,
                    1.4
                );
            }

            // Button 11 (R3 / Нажатие правого стика): Сброс камеры назад
            if (btns[11] && btns[11].pressed && !this.prevButtons[11]) {
                if (this.camera.targetMesh) {
                    this.camera.yaw = this.camera.targetMesh.rotation.y + Math.PI;
                    this.camera.pitch = 0.22;
                }
            }
        }

        // Сохраняем состояние кнопок для следующего кадра
        for (let i = 0; i < btns.length && i < this.prevButtons.length; i++) {
            this.prevButtons[i] = !!(btns[i] && btns[i].pressed);
        }
    }
}

window.GamepadController = GamepadController;
