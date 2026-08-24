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

                this.initListeners();
            }

            initListeners() {
                const container = this.domElement || document.body;

                window.addEventListener('click', (e) => {
                    if (!this.isPointerLocked && e.target.tagName !== 'BUTTON') {
                        try { container.requestPointerLock(); } catch (err) {}
                    }
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
                let targetFocus;
                let isSprinting = false;
                let currentSpeedKmh = 0;

                const isInsideElevator = (window.gameEngine && window.gameEngine.elevatorSystem && window.gameEngine.elevatorSystem.isPlayerInside);
                const targetBaseDistance = (isInsideElevator && !drivenCar && (!helicopter || (!helicopter.isPiloted && !helicopter.isPassenger))) ? 2.3 : this.userDistance;

                this.currentDistance = THREE.MathUtils.lerp(this.currentDistance, targetBaseDistance, 1.0 - Math.exp(-8.0 * deltaTime));
                this.distance = this.currentDistance;

                let desiredDistance = this.distance;

                if (helicopter && (helicopter.isPiloted || helicopter.isPassenger)) {
                    targetFocus = helicopter.group.position.clone().add(new THREE.Vector3(0, 1.4, 0));
                    const heliSpeed = Math.hypot(helicopter.body.velocity.x, helicopter.body.velocity.y, helicopter.body.velocity.z) * 3.6;
                    desiredDistance = THREE.MathUtils.lerp(this.distance * 1.8, this.distance * 2.4, Math.min(heliSpeed / 120.0, 1.0));

                    // Плавное следование камеры за носом/хвостом вертолета (GTA-Style Heli Cam)
                    if (helicopter.headingAngle !== undefined) {
                        const targetCamYaw = helicopter.headingAngle + Math.PI;
                        let diffYaw = targetCamYaw - this.yaw;
                        while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
                        while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
                        this.yaw += diffYaw * Math.min(1.0, deltaTime * 3.4);
                    }
                } else if (drivenCar) {
                    targetFocus = drivenCar.carGroup.position.clone().add(new THREE.Vector3(0, 1.2, 0));
                    currentSpeedKmh = drivenCar.getSpeedKmh();
                    desiredDistance = THREE.MathUtils.lerp(this.distance, this.distance * 1.35, Math.min(currentSpeedKmh / 160.0, 1.0));
                } else if (this.targetMesh) {
                    targetFocus = this.targetMesh.position.clone().add(this.targetOffset);
                    desiredDistance = this.distance;

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

                // Инициализация или высокочастотное экспоненциальное сглаживание фокуса
                if (!this.hasInitializedFocus) {
                    this.currentFocusPoint.copy(targetFocus);
                    this.hasInitializedFocus = true;
                } else {
                    const focusSmoothingFactor = 1.0 - Math.exp(-28.0 * deltaTime);
                    this.currentFocusPoint.lerp(targetFocus, focusSmoothingFactor);
                }

                // Плавный динамический угол обзора (FOV) для чувства скорости без вибрации экрана
                let targetFov = this.baseFov;
                if (drivenCar) {
                    targetFov = THREE.MathUtils.lerp(65.0, 76.0, Math.min(currentSpeedKmh / 180.0, 1.0));
                } else if (isSprinting) {
                    targetFov = 71.0;
                }
                if (Math.abs(this.camera.fov - targetFov) > 0.05) {
                    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 1.0 - Math.exp(-6.0 * deltaTime));
                    this.camera.updateProjectionMatrix();
                }

                const hDist = desiredDistance * Math.cos(this.pitch);
                const vDist = desiredDistance * Math.sin(this.pitch);

                const camPos = new THREE.Vector3(
                    this.currentFocusPoint.x + hDist * Math.sin(this.yaw),
                    Math.max(0.4, this.currentFocusPoint.y + vDist),
                    this.currentFocusPoint.z + hDist * Math.cos(this.yaw)
                );

                this.camera.position.lerp(camPos, 1.0 - Math.exp(-18.0 * deltaTime));
                this.camera.lookAt(this.currentFocusPoint);
            }
        }
