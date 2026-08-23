/**
         * Контроллер игрока (с системой здоровья, брони и выносливости)
         */
        class PlayerController {
            constructor(player, cameraController, inputController, world) {
                this.player = player;
                this.cameraController = cameraController;
                this.input = inputController;
                this.world = world;

                this.walkSpeed = 7.8;
                this.sprintSpeed = 15.5;
                this.isGrounded = false;
                this.jumpCooldown = 0.0;
                this.targetRotation = Math.PI;

                this.health = 100.0;
                this.armor = 100.0;
                this.stamina = 100.0;
                this.isExhausted = false;
                this.money = 250000;

                this.animSystem = new PlayerAnimationSystem(this.player.limbs);
                if (this.player && this.player.mesh) {
                    this.player.mesh.rotation.y = Math.PI;
                }
                this.speedElement = document.getElementById('hud-speed');
                this.healthBarFill = document.getElementById('bar-fill-health');
                this.armorBarFill = document.getElementById('bar-fill-armor');
                this.staminaBarFill = document.getElementById('bar-fill-stamina');
                this.moneyElement = document.getElementById('hud-money-val');
            }

            update(deltaTime, isDriving, soccerBalls) {
                if (isDriving) {
                    this.stamina = Math.min(100.0, this.stamina + 25.0 * deltaTime);
                    if (this.staminaBarFill) {
                        this.staminaBarFill.style.width = `${this.stamina}%`;
                        this.staminaBarFill.classList.remove('exhausted');
                    }
                    return;
                }

                const body = this.player.body;
                const mesh = this.player.mesh;
                if (!body || !mesh) return;

                const groundY = (window.gameEngine && window.gameEngine.terrainManager)
                    ? window.gameEngine.terrainManager.getTerrainHeight(body.position.x, body.position.z)
                    : 0.0;

                if (this.jumpCooldown > 0) this.jumpCooldown -= deltaTime;

                if (body.position.y <= groundY + 0.83) {
                    body.position.y = groundY + 0.815;
                    body.velocity.y = 0;
                    if (this.jumpCooldown <= 0) this.isGrounded = true;
                } else {
                    // Игрок находится в воздухе: проверка посадки на пол
                    const isAtFloorSurface = body.position.y <= groundY + 0.85;
                    const isNotAscending = body.velocity.y <= 0.05;
                    this.isGrounded = (this.jumpCooldown <= 0) && isAtFloorSurface && isNotAscending;
                }

                let moveX = 0; let moveZ = 0;
                if (this.input.keys.forward) moveZ -= 1;
                if (this.input.keys.backward) moveZ += 1;
                if (this.input.keys.left) moveX -= 1;
                if (this.input.keys.right) moveX += 1;

                const isMoving = (moveX !== 0 || moveZ !== 0);
                const cameraYaw = this.cameraController.yaw;
                const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
                const right = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));

                const moveDir = new THREE.Vector3();
                if (isMoving) {
                    moveDir.addScaledVector(forward, -moveZ);
                    moveDir.addScaledVector(right, moveX);
                    moveDir.normalize();
                }

                const isSprinting = this.input.keys.sprint && isMoving && !this.isExhausted;

                if (isSprinting) {
                    this.stamina = Math.max(0.0, this.stamina - 20.0 * deltaTime);
                    if (this.stamina <= 0.0) {
                        this.isExhausted = true;
                    }
                } else {
                    if (isMoving) {
                        this.stamina = Math.min(100.0, this.stamina + 16.0 * deltaTime);
                    } else {
                        this.stamina = Math.min(100.0, this.stamina + 30.0 * deltaTime);
                    }
                    if (this.stamina >= 18.0) {
                        this.isExhausted = false;
                    }
                }

                if (this.staminaBarFill) {
                    this.staminaBarFill.style.width = `${this.stamina}%`;
                    if (this.isExhausted) {
                        this.staminaBarFill.classList.add('exhausted');
                    } else {
                        this.staminaBarFill.classList.remove('exhausted');
                    }
                }

                const speed = isSprinting ? this.sprintSpeed : this.walkSpeed;

                if (isMoving) {
                    const accelRate = 1.0 - Math.exp(-18.0 * deltaTime);
                    body.velocity.x += (moveDir.x * speed - body.velocity.x) * accelRate;
                    body.velocity.z += (moveDir.z * speed - body.velocity.z) * accelRate;
                    this.targetRotation = Math.atan2(moveDir.x, moveDir.z);
                } else {
                    const decelRate = 1.0 - Math.exp(-22.0 * deltaTime);
                    body.velocity.x += (0 - body.velocity.x) * decelRate;
                    body.velocity.z += (0 - body.velocity.z) * decelRate;
                }

                if (this.input.keys.jump && this.isGrounded && this.jumpCooldown <= 0) {
                    body.velocity.y = 6.6;
                    this.isGrounded = false;
                    this.jumpCooldown = 0.4;
                } else if (this.isGrounded) {
                    body.position.y = groundY + 0.815;
                    body.velocity.y = 0;
                }

                body.angularVelocity.set(0, 0, 0);
                body.quaternion.set(0, 0, 0, 1);
                mesh.position.set(body.position.x, body.position.y - 0.815, body.position.z);
                mesh.scale.set(1, 1, 1);

                let angleDiff = this.targetRotation - mesh.rotation.y;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                const rotLerp = 1.0 - Math.exp(-18.0 * deltaTime);
                const newRotY = mesh.rotation.y + angleDiff * rotLerp;
                mesh.rotation.set(0, newRotY, 0);

                const horizontalSpeed = Math.hypot(body.velocity.x, body.velocity.z);
                if (this.speedElement) this.speedElement.innerText = (horizontalSpeed * 3.6 * 0.5).toFixed(1);

                this.animSystem.update(deltaTime, horizontalSpeed);

                // STEP 29: Воспроизведение звука шагов протагониста (синхронизировано с walkCycle и поверхностью)
                if (window.soundEngine && horizontalSpeed > 0.35 && this.isGrounded) {
                    const phase = Math.sin(this.animSystem.walkCycle) > 0;
                    if (this.lastStepPhase === undefined) this.lastStepPhase = phase;
                    if (phase !== this.lastStepPhase) {
                        this.lastStepPhase = phase;
                        const isIndoor = this.checkIfIndoor(body.position.x, body.position.y, body.position.z);
                        const isOnDirt = (window.gameEngine && window.gameEngine.roadNetwork)
                            ? window.gameEngine.roadNetwork.isPositionOnDirt(body.position.x, body.position.z)
                            : (Math.hypot(body.position.x, body.position.z) > 150.0);
                        const surfaceType = isIndoor ? 'indoor' : (isOnDirt ? 'grass' : 'default');
                        const vol = isSprinting ? 1.20 : 0.85;
                        window.soundEngine.playFootstep(body.position.x, body.position.y, body.position.z, isIndoor, vol, surfaceType);
                    }
                }

                if (soccerBalls && soccerBalls.length > 0) {
                    for (let i = 0; i < soccerBalls.length; i++) {
                        const ball = soccerBalls[i];
                        const bPos = ball.body.position;
                        const distToBall = Math.hypot(body.position.x - bPos.x, body.position.z - bPos.z);
                        if (distToBall < 0.72 && Math.abs(body.position.y - bPos.y) < 1.0) {
                            const kickDirX = (bPos.x - body.position.x) + (body.velocity.x * 0.4);
                            const kickDirZ = (bPos.z - body.position.z) + (body.velocity.z * 0.4);
                            const kickPower = Math.max(6.0, horizontalSpeed * 1.8 + 5.0);
                            ball.kick(kickDirX, 2.5 + (this.input.keys.sprint ? 2.0 : 0.5), kickDirZ, kickPower);

                            // Action rewards paused
                        }
                    }
                }
            }

            checkIfIndoor(x, y, z) {
                if (y > 4.0) return true;
                if (Math.abs(x - 0) < 12.0 && Math.abs(z - 60.0) < 12.0) return true;
                if (Math.abs(x - (-60.0)) < 14.0 && Math.abs(z - 60.0) < 12.0) return true;
                if (Math.abs(x - 60.0) < 12.0 && Math.abs(z - 60.0) < 11.0) return true;
                return false;
            }
        }
