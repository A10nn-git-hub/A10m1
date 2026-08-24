/**
 * Контроллер игрока (с системой здоровья, брони, выносливости, денег и урона)
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
        this.maxHealth = 100.0;
        this.armor = 100.0;
        this.maxArmor = 100.0;
        this.stamina = 100.0;
        this.isExhausted = false;
        this.money = 250000;
        this.isDead = false;
        this.respawnTimer = 0.0;

        this.animSystem = new PlayerAnimationSystem(this.player.limbs);
        if (this.player && this.player.mesh) {
            this.player.mesh.rotation.y = Math.PI;
        }
        this.speedElement = document.getElementById('hud-speed');
        this.healthBarFill = document.getElementById('bar-fill-health');
        this.armorBarFill = document.getElementById('bar-fill-armor');
        this.staminaBarFill = document.getElementById('bar-fill-stamina');
        this.moneyElement = document.getElementById('hud-money-val');

        this.isClimbingTree = false;
        this.currentTree = null;

        this.updateHUD();
    }

    findNearestTree(maxDist = 3.2) {
        const veg = (window.gameEngine && window.gameEngine.vegetationManager)
            || (window.gameEngine && window.gameEngine.districtGenerator && window.gameEngine.districtGenerator.vegetationManager);
        if (!veg || !veg.treePositions || veg.treePositions.length === 0) return null;

        const px = this.player.body.position.x;
        const pz = this.player.body.position.z;
        let bestTree = null;
        let minDist = maxDist;

        for (let i = 0; i < veg.treePositions.length; i++) {
            const t = veg.treePositions[i];
            const d = Math.hypot(px - t.x, pz - t.z);
            if (d < minDist) {
                minDist = d;
                bestTree = t;
            }
        }
        return bestTree;
    }

    toggleClimbTree() {
        if (this.isClimbingTree) {
            // Спуститься с дерева на землю
            const tree = this.currentTree;
            this.isClimbingTree = false;
            this.currentTree = null;

            const exitX = tree ? tree.x + 1.2 : this.player.body.position.x;
            const exitZ = tree ? tree.z + 1.2 : this.player.body.position.z;
            const groundY = (window.gameEngine && window.gameEngine.terrainManager)
                ? window.gameEngine.terrainManager.getTerrainHeight(exitX, exitZ)
                : 0.0;

            this.player.body.position.set(exitX, groundY + 0.82, exitZ);
            this.player.body.velocity.set(0, 0, 0);

            if (window.gameEngine && window.gameEngine.multiplayerHUD) {
                window.gameEngine.multiplayerHUD.addSystemMessage('Вы спустились с дерева на землю');
            }
        } else {
            // Залезть на дерево
            const tree = this.findNearestTree(3.2);
            if (tree) {
                this.isClimbingTree = true;
                this.currentTree = tree;
                this.player.body.position.set(tree.x, tree.perchY, tree.z);
                this.player.body.velocity.set(0, 0, 0);

                if (window.gameEngine && window.gameEngine.multiplayerHUD) {
                    window.gameEngine.multiplayerHUD.addSystemMessage('🌿 Вы залезли на дерево и спрятались в густой листве! [E] Слезть | [Space] Спрыгнуть');
                }
            }
        }
    }

    takeDamage(amount) {
        if (this.isDead) return;

        let remainingDmg = amount;
        if (this.armor > 0) {
            const armorAbsorb = Math.min(this.armor, remainingDmg);
            this.armor -= armorAbsorb;
            remainingDmg -= armorAbsorb;
        }

        if (remainingDmg > 0) {
            this.health = Math.max(0, this.health - remainingDmg);
        }

        this.updateHUD();

        // Кровавая вспышка на экране
        const uiLayer = document.getElementById('ui-layer');
        if (uiLayer) {
            uiLayer.classList.add('damage-flash');
            setTimeout(() => uiLayer.classList.remove('damage-flash'), 180);
        }

        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        this.isDead = true;
        this.health = 0;
        this.respawnTimer = 3.5;

        if (this.player.body) {
            this.player.body.velocity.set(0, 0, 0);
        }

        // Показ баннера WASTED
        let wasted = document.getElementById('wasted-banner');
        if (!wasted) {
            wasted = document.createElement('div');
            wasted.id = 'wasted-banner';
            wasted.className = 'wasted-banner';
            wasted.innerText = 'WASTED';
            document.body.appendChild(wasted);
        }
        wasted.style.display = 'block';

        if (window.soundEngine && typeof window.soundEngine.playMissionJingle === 'function') {
            window.soundEngine.playMissionJingle(false);
        }
    }

    respawn() {
        this.isDead = false;
        this.health = 100.0;
        this.armor = 50.0;
        this.stamina = 100.0;

        // Госпиталь Pillbox Hill
        if (this.player.body) {
            this.player.body.position.set(0, 2.5, 25.0);
            this.player.body.velocity.set(0, 0, 0);
        }

        // Сброс розыска
        if (window.gameEngine && window.gameEngine.wantedManager) {
            window.gameEngine.wantedManager.setStars(0);
        }

        // Снятие оплаты за лечение $2,000
        this.money = Math.max(0, this.money - 2000);
        this.updateHUD();

        const wasted = document.getElementById('wasted-banner');
        if (wasted) wasted.style.display = 'none';
    }

    addMoney(amount) {
        this.money += amount;
        this.updateHUD();

        // Анимация всплывающего бонуса
        if (this.moneyElement) {
            this.moneyElement.classList.remove('cash-gain');
            void this.moneyElement.offsetWidth;
            this.moneyElement.classList.add('cash-gain');
        }
    }

    updateHUD() {
        if (this.healthBarFill) this.healthBarFill.style.width = `${Math.max(0, this.health)}%`;
        if (this.armorBarFill) this.armorBarFill.style.width = `${Math.max(0, this.armor)}%`;
        if (this.staminaBarFill) this.staminaBarFill.style.width = `${Math.max(0, this.stamina)}%`;
        if (this.moneyElement) this.moneyElement.innerText = this.money.toLocaleString();
    }

    update(deltaTime, isDriving, soccerBalls) {
        if (this.isDead) {
            this.respawnTimer -= deltaTime;
            if (this.respawnTimer <= 0) {
                this.respawn();
            }
            return;
        }

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

        // Если персонаж сидит на дереве в листве
        if (this.isClimbingTree && this.currentTree) {
            body.velocity.set(0, 0, 0);
            body.position.set(this.currentTree.x, this.currentTree.perchY, this.currentTree.z);
            body.angularVelocity.set(0, 0, 0);
            body.quaternion.set(0, 0, 0, 1);

            mesh.position.set(this.currentTree.x, this.currentTree.perchY - 0.815, this.currentTree.z);
            mesh.rotation.y = this.cameraController.yaw;

            const l = this.player.limbs;
            if (l && l.torso) {
                l.torso.position.y = 0.55;
                l.leftLeg.pivot.rotation.x = -1.45;
                l.rightLeg.pivot.rotation.x = -1.45;
                l.leftLeg.knee.rotation.x = 1.45;
                l.rightLeg.knee.rotation.x = 1.45;
                l.leftArm.pivot.rotation.set(-0.6, 0.2, 0.3);
                l.rightArm.pivot.rotation.set(-0.6, -0.2, -0.3);
            }

            const isJumpJustPressed = this.input.keys.jump && !this.prevJumpKey;
            this.prevJumpKey = !!this.input.keys.jump;

            if (isJumpJustPressed) {
                // Спрыгнуть с дерева вперед
                this.isClimbingTree = false;
                const camYaw = this.cameraController.yaw;
                const fwd = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
                body.velocity.set(fwd.x * 7.5, 4.5, fwd.z * 7.5);
                this.jumpCooldown = 0.4;
                this.currentTree = null;
                if (window.gameEngine && window.gameEngine.multiplayerHUD) {
                    window.gameEngine.multiplayerHUD.addSystemMessage('Вы спрыгнули с дерева');
                }
            }

            if (this.speedElement) this.speedElement.innerText = '0.0';
            return;
        }

        const elevator = window.gameEngine && window.gameEngine.elevatorSystem;
        const isInsideElevator = (elevator && elevator.isPlayerInside);
        const isElevatorMoving = isInsideElevator && (elevator.state === 'MOVING' || elevator.state === 'DOORS_CLOSING' || elevator.state === 'ARRIVED');
        const groundY = (window.gameEngine && window.gameEngine.terrainManager)
            ? window.gameEngine.terrainManager.getTerrainHeight(body.position.x, body.position.z)
            : 0.0;

        if (this.jumpCooldown > 0) this.jumpCooldown -= deltaTime;
        if (this.coyoteTimer > 0) this.coyoteTimer -= deltaTime;

        // 1. Точная проверка физического контакта под ногами через контактный манифольд
        let hasSolidContact = false;
        if (this.world && this.world.contacts) {
            for (let i = 0; i < this.world.contacts.length; i++) {
                const c = this.world.contacts[i];
                if (c.bi === body || c.bj === body) {
                    const normalY = (c.bi === body) ? -c.ni.y : c.ni.y;
                    if (normalY > 0.35) {
                        hasSolidContact = true;
                        break;
                    }
                }
            }
        }

        // 2. Лучевая проверка под ногами (Raycast Down) для всех этажей зданий, мостов и крыш
        if (!hasSolidContact && this.world && typeof this.world.raycastClosest === 'function') {
            const rayOffsets = [
                [0, 0],
                [0.18, 0.18],
                [-0.18, 0.18],
                [0.18, -0.18],
                [-0.18, -0.18]
            ];
            const rayResult = new CANNON.RaycastResult();
            const rayOptions = { skipBackfaces: true };

            for (let i = 0; i < rayOffsets.length; i++) {
                const [ox, oz] = rayOffsets[i];
                const from = new CANNON.Vec3(body.position.x + ox, body.position.y, body.position.z + oz);
                const to = new CANNON.Vec3(body.position.x + ox, body.position.y - 1.05, body.position.z + oz);
                rayResult.reset();
                this.world.raycastClosest(from, to, rayOptions, rayResult);
                if (rayResult.hasHit && rayResult.body && rayResult.body !== body) {
                    hasSolidContact = true;
                    break;
                }
            }
        }

        // 3. Проверка нахождения на крыше вертолета (позволяет летать сверху вертолета)
        const heli = window.gameEngine && window.gameEngine.helicopter;
        let isStandingOnHeliRoof = false;
        if (heli && heli.body && !heli.isPiloted && !heli.isPassenger) {
            const hPos = heli.body.position;
            const dx = Math.abs(body.position.x - hPos.x);
            const dz = Math.abs(body.position.z - hPos.z);
            const dy = body.position.y - hPos.y;
            if (dx < 1.15 && dz < 1.85 && dy >= 0.85 && dy <= 2.4) {
                isStandingOnHeliRoof = true;
                hasSolidContact = true;
                body.position.x += heli.body.velocity.x * deltaTime;
                body.position.y += heli.body.velocity.y * deltaTime;
                body.position.z += heli.body.velocity.z * deltaTime;
            }
        }

        const onGroundTerrain = (!isInsideElevator && !isStandingOnHeliRoof && body.position.y <= groundY + 0.83);
        if (onGroundTerrain) {
            body.position.y = groundY + 0.815;
            if (body.velocity.y < 0) body.velocity.y = 0;
        }

        const physicallyGrounded = (onGroundTerrain || hasSolidContact || isInsideElevator || isStandingOnHeliRoof);
        if (physicallyGrounded && Math.abs(body.velocity.y) < 0.6) {
            this.coyoteTimer = 0.15; // Буфер Coyote-Time для мгновенного прыжка на любых этажах
        }

        this.isGrounded = (this.jumpCooldown <= 0) && (physicallyGrounded || this.coyoteTimer > 0);

        let moveX = 0; let moveZ = 0;
        if (!isElevatorMoving) {
            if (this.input.keys.forward) moveZ -= 1;
            if (this.input.keys.backward) moveZ += 1;
            if (this.input.keys.left) moveX -= 1;
            if (this.input.keys.right) moveX += 1;
        }

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

        const isJumpJustPressed = this.input.keys.jump && !this.prevJumpKey;
        this.prevJumpKey = !!this.input.keys.jump;

        if (isJumpJustPressed && (this.isGrounded || this.coyoteTimer > 0) && this.jumpCooldown <= 0 && !isElevatorMoving) {
            body.velocity.y = 6.6;
            this.isGrounded = false;
            this.coyoteTimer = 0.0;
            this.jumpCooldown = 0.32;
        } else if (this.isGrounded && !isInsideElevator && body.position.y <= groundY + 0.85) {
            body.position.y = groundY + 0.815;
            if (body.velocity.y < 0) body.velocity.y = 0;
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

        // Воспроизведение звука шагов
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
window.PlayerController = PlayerController;
