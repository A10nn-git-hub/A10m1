class ThirdPersonCameraController {
    constructor(camera, targetMesh, domElement) {
        this.camera = camera;
        this.targetMesh = targetMesh;
        this.domElement = domElement;

        this.yaw = 0.0;
        this.pitch = 0.22;
        this.userDistance = 4.5;
        this.currentDistance = 4.5;
        this.distance = 4.5;
        this.targetOffset = new THREE.Vector3(0, 1.45, 0);
        this.sensitivity = 0.0024;

        this.currentFocusPoint = new THREE.Vector3();
        this.hasInitializedFocus = false;
        this.baseFov = 65.0;

        this.isPointerLocked = false;
        this.isMouseDown = false;
        this.previousMousePosition = { x: 0, y: 0 };

        this._targetFocus = new THREE.Vector3();
        this._targetCamPos = new THREE.Vector3();

        this.initListeners();
    }

    safeRequestPointerLock() {
        const container = this.domElement || document.getElementById('game-container') || document.body;
        if (!container || typeof container.requestPointerLock !== 'function') return;

        // Do not request pointer lock if full map, main menu, pause menu or any modal dialog is active
        if (window.gameEngine) {
            if (window.gameEngine.mainMenuManager && window.gameEngine.mainMenuManager.isMenuOpen) return;
            if (window.gameEngine.mainMenuManager && window.gameEngine.mainMenuManager.fullMapRenderer && window.gameEngine.mainMenuManager.fullMapRenderer.isOpen) return;
        }
        if (document.querySelector('.modal.active, #full-map-modal.active, .chrome-error-dialog.active, #settings-modal.active, #about-modal.active')) return;

        try {
            const p = container.requestPointerLock();
            if (p && typeof p.catch === 'function') {
                p.catch(() => {});
            }
        } catch (err) {}
    }

    initListeners() {
        const container = this.domElement || document.getElementById('game-container') || document.body;

        window.addEventListener('click', (e) => {
            if (this.isPointerLocked) return;

            // Ignore interactive UI elements
            const ignoredTags = ['BUTTON', 'INPUT', 'A', 'SELECT', 'TEXTAREA', 'LABEL'];
            if (ignoredTags.includes(e.target.tagName)) return;
            if (e.target.closest('#full-map-modal, #main-menu, #pause-menu, .modal, .chrome-error-dialog, .hub-back-btn, #heli-nav-hud, #elevator-hud-prompt, .heli-hud-controls, #vehicle-prompt')) return;

            this.safeRequestPointerLock();
        });

        window.addEventListener('mousedown', (e) => {
            this.isMouseDown = true;
            this.previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = (document.pointerLockElement === container || document.pointerLockElement === document.body);
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isPointerLocked) {
                this.yaw -= e.movementX * this.sensitivity;
                this.pitch = THREE.MathUtils.clamp(this.pitch + e.movementY * this.sensitivity, -1.3, 1.4);
            } else if (this.isMouseDown) {
                const dx = e.clientX - this.previousMousePosition.x;
                const dy = e.clientY - this.previousMousePosition.y;
                this.yaw -= dx * this.sensitivity;
                this.pitch = THREE.MathUtils.clamp(this.pitch + dy * this.sensitivity, -1.3, 1.4);
                this.previousMousePosition = { x: e.clientX, y: e.clientY };
            }
        });

        window.addEventListener('mouseup', () => { this.isMouseDown = false; });

        // Зум вида от 3 лица колесиком мыши
        window.addEventListener('wheel', (e) => {
            const zoomDelta = e.deltaY > 0 ? 0.65 : -0.65;
            this.userDistance = Math.max(1.8, Math.min(18.0, this.userDistance + zoomDelta));
        }, { passive: true });
    }

    update(deltaTime, drivenCar, helicopter) {
        const dt = Math.min(deltaTime, 0.05);
        const targetFocus = this._targetFocus;
        targetFocus.set(0, 0, 0);
        let isSprinting = false;
        let rawSpeedKmh = 0;

        const elevSys = window.gameEngine && window.gameEngine.elevatorSystem;
        const isInsideElevator = !!(elevSys && ((elevSys.activeElevator && elevSys.activeElevator.isPlayerInside) || elevSys.isPlayerInside));
        
        const pMesh = this.targetMesh || (window.gameEngine && window.gameEngine.player && window.gameEngine.player.mesh);
        const isIndoorLobby = pMesh && (pMesh.position.y < 8.5 && Math.abs(pMesh.position.x) < 14.5 && Math.abs(pMesh.position.z - 60.0) < 14.5);

        let targetBaseDistance = this.userDistance;
        if (isInsideElevator) {
            targetBaseDistance = 1.85;
            this.pitch = THREE.MathUtils.clamp(this.pitch, -0.25, 0.45);
        } else if (isIndoorLobby) {
            targetBaseDistance = Math.min(this.userDistance, 3.2);
            this.pitch = THREE.MathUtils.clamp(this.pitch, -0.5, 0.65);
        }

        this.currentDistance = THREE.MathUtils.lerp(this.currentDistance, targetBaseDistance, 1.0 - Math.exp(-8.0 * dt));
        this.distance = this.currentDistance;

        let desiredDistance = this.distance;

        if (helicopter && (helicopter.isPiloted || helicopter.isPassenger)) {
            const heliScale = (helicopter.scaleMultiplier) || (helicopter.group ? helicopter.group.scale.x : 1.0) || 1.0;
            const heliPos = (helicopter.group && helicopter.group.position) ? helicopter.group.position : helicopter.body.position;
            
            // Плавный фокус с учетом масштаба вертолета (уровни 1, 2, 3, 4, 5)
            const focusYOffset = 1.35 * Math.min(heliScale, 3.5);
            targetFocus.set(heliPos.x, heliPos.y + focusYOffset, heliPos.z);
            if (helicopter.body && helicopter.body.velocity) {
                rawSpeedKmh = Math.hypot(helicopter.body.velocity.x, helicopter.body.velocity.y, helicopter.body.velocity.z) * 3.6;
            }
            
            if (this.smoothSpeedKmh === undefined) this.smoothSpeedKmh = 0;
            this.smoothSpeedKmh += (rawSpeedKmh - this.smoothSpeedKmh) * (1.0 - Math.exp(-3.5 * dt));

            const speedMultiplier = helicopter.speedMultiplier || 1.0;
            const dynamicScaleDist = Math.max(1.0, Math.pow(heliScale, 0.85));
            desiredDistance = THREE.MathUtils.lerp(
                this.distance * 1.65 * dynamicScaleDist,
                this.distance * 2.25 * dynamicScaleDist,
                Math.min(this.smoothSpeedKmh / (180.0 * Math.sqrt(speedMultiplier)), 1.0)
            );
        } else if (drivenCar) {
            const carPos = (drivenCar.carGroup && drivenCar.carGroup.position) ? drivenCar.carGroup.position : drivenCar.chassisBody.position;
            targetFocus.set(carPos.x, carPos.y + 1.15, carPos.z);
            rawSpeedKmh = drivenCar.getSpeedKmh();

            if (this.smoothSpeedKmh === undefined) this.smoothSpeedKmh = 0;
            this.smoothSpeedKmh += (rawSpeedKmh - this.smoothSpeedKmh) * (1.0 - Math.exp(-4.5 * dt));

            desiredDistance = THREE.MathUtils.lerp(this.distance * 1.05, this.distance * 1.35, Math.min(this.smoothSpeedKmh / 160.0, 1.0));
        } else if (this.targetMesh) {
            targetFocus.copy(this.targetMesh.position).add(this.targetOffset);
            desiredDistance = this.distance;
            if (this.smoothSpeedKmh !== undefined) this.smoothSpeedKmh *= Math.exp(-4.0 * dt);

            if (window.gameEngine && window.gameEngine.playerController) {
                const pc = window.gameEngine.playerController;
                if (pc.input && pc.input.keys && pc.input.keys.sprint && !pc.isExhausted && pc.player && pc.player.body) {
                    const hSpeed = Math.hypot(pc.player.body.velocity.x, pc.player.body.velocity.z);
                    if (hSpeed > 8.0) isSprinting = true;
                }
            }
        } else {
            return;
        }

        // Высококачественное кинематографическое сглаживание фокуса камеры (полное устранение тряски подвески и микроколебаний)
        if (!this.hasInitializedFocus) {
            this.currentFocusPoint.copy(targetFocus);
            this.hasInitializedFocus = true;
        } else if (isInsideElevator) {
            // В лифте вертикальный фокус синхронизируется строго синхронно с движением кабины без задержек
            this.currentFocusPoint.y = targetFocus.y;
            const horizFactor = 1.0 - Math.exp(-22.0 * dt);
            this.currentFocusPoint.x += (targetFocus.x - this.currentFocusPoint.x) * horizFactor;
            this.currentFocusPoint.z += (targetFocus.z - this.currentFocusPoint.z) * horizFactor;
        } else if (drivenCar) {
            // Двухконтурное сглаживание для автомобиля: глубокий фильтр вибраций подвески и неровностей дороги
            const carSmoothH = 1.0 - Math.exp(-15.0 * dt);
            const carSmoothV = 1.0 - Math.exp(-7.5 * dt);
            this.currentFocusPoint.x += (targetFocus.x - this.currentFocusPoint.x) * carSmoothH;
            this.currentFocusPoint.y += (targetFocus.y - this.currentFocusPoint.y) * carSmoothV;
            this.currentFocusPoint.z += (targetFocus.z - this.currentFocusPoint.z) * carSmoothH;
        } else if (helicopter && (helicopter.isPiloted || helicopter.isPassenger)) {
            // Гладкое отслеживание полета вертолета без микроколебаний от физических сил
            const heliSmoothH = 1.0 - Math.exp(-14.0 * dt);
            const heliSmoothV = 1.0 - Math.exp(-9.0 * dt);
            this.currentFocusPoint.x += (targetFocus.x - this.currentFocusPoint.x) * heliSmoothH;
            this.currentFocusPoint.y += (targetFocus.y - this.currentFocusPoint.y) * heliSmoothV;
            this.currentFocusPoint.z += (targetFocus.z - this.currentFocusPoint.z) * heliSmoothH;
        } else {
            const horizFactor = 1.0 - Math.exp(-18.0 * dt);
            const vertFactor = 1.0 - Math.exp(-16.0 * dt);
            this.currentFocusPoint.x += (targetFocus.x - this.currentFocusPoint.x) * horizFactor;
            this.currentFocusPoint.y += (targetFocus.y - this.currentFocusPoint.y) * vertFactor;
            this.currentFocusPoint.z += (targetFocus.z - this.currentFocusPoint.z) * horizFactor;
        }

        // Плавный динамический угол обзора (FOV) без пульсаций экрана
        let targetFov = this.baseFov;
        const currentSmoothSpeed = (this.smoothSpeedKmh !== undefined) ? this.smoothSpeedKmh : rawSpeedKmh;
        if (drivenCar || helicopter) {
            targetFov = THREE.MathUtils.lerp(65.0, 74.0, Math.min(currentSmoothSpeed / 200.0, 1.0));
        } else if (isSprinting) {
            targetFov = 71.0;
        }
        if (Math.abs(this.camera.fov - targetFov) > 0.01) {
            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 1.0 - Math.exp(-3.5 * dt));
            this.camera.updateProjectionMatrix();
        }

        const hDist = desiredDistance * Math.cos(this.pitch);
        const vDist = desiredDistance * Math.sin(this.pitch);

        const targetCamPos = this._targetCamPos;
        targetCamPos.set(
            this.currentFocusPoint.x + hDist * Math.sin(this.yaw),
            Math.max(0.45, this.currentFocusPoint.y + vDist),
            this.currentFocusPoint.z + hDist * Math.cos(this.yaw)
        );

        if (!this.hasInitializedCamPos) {
            this.camera.position.copy(targetCamPos);
            this.hasInitializedCamPos = true;
        } else if (isInsideElevator) {
            // Мгновенное вертикальное следование за кабиной лифта без проваливаний и отставаний
            this.camera.position.y = targetCamPos.y;
            const camSmoothingH = 1.0 - Math.exp(-24.0 * dt);
            this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetCamPos.x, camSmoothingH);
            this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetCamPos.z, camSmoothingH);
        } else if (drivenCar) {
            // Плавное следование камеры за автомобилем с раздельной фильтрацией
            const camSmoothingH = 1.0 - Math.exp(-16.0 * dt);
            const camSmoothingV = 1.0 - Math.exp(-9.0 * dt);
            this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetCamPos.x, camSmoothingH);
            this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetCamPos.y, camSmoothingV);
            this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetCamPos.z, camSmoothingH);
        } else if (helicopter && (helicopter.isPiloted || helicopter.isPassenger)) {
            // Плавное следование камеры за вертолетом
            const camSmoothingH = 1.0 - Math.exp(-15.0 * dt);
            const camSmoothingV = 1.0 - Math.exp(-10.0 * dt);
            this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetCamPos.x, camSmoothingH);
            this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetCamPos.y, camSmoothingV);
            this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetCamPos.z, camSmoothingH);
        } else {
            const camSmoothing = 1.0 - Math.exp(-20.0 * dt);
            this.camera.position.lerp(targetCamPos, camSmoothing);
        }

        this.camera.lookAt(this.currentFocusPoint);
    }
}

window.ThirdPersonCameraController = ThirdPersonCameraController;
