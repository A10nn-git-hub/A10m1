/**
 * PoliceOfficerNPC - класс вооруженного офицера полиции LSPD
 */
class PoliceOfficerNPC {
    constructor(scene, world, physicsMaterials, startPos) {
        this.scene = scene;
        this.world = world;
        this.physicsMaterials = physicsMaterials;

        this.hp = 80;
        this.maxHp = 80;
        this.isDead = false;
        this.state = 'CHASE'; // 'CHASE', 'AIM_AND_SHOOT', 'KNOCKED_DOWN', 'DEAD'
        this.fireTimer = 1.0 + Math.random() * 0.8;
        this.walkCycle = 0;
        this.targetRotation = 0;
        this.knockedDownTimer = 0;

        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.limbs = {};

        this.buildCopModel(startPos);
        this.initPhysics(startPos);
    }

    buildCopModel(startPos) {
        const uniformMat = new THREE.MeshStandardMaterial({ color: 0x1a2b4c, roughness: 0.6 }); // Темно-синяя форма LSPD
        const pantsMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xdca17a, roughness: 0.7 });
        const goldBadgeMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f, metalness: 0.8, roughness: 0.2 });
        const capMat = new THREE.MeshStandardMaterial({ color: 0x111e38, roughness: 0.5 });
        const gunMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.3 });

        // Торс
        const torsoGeo = new THREE.BoxGeometry(0.55, 0.65, 0.3);
        const torso = new THREE.Mesh(torsoGeo, uniformMat);
        torso.position.y = 1.15;
        this.group.add(torso);
        this.limbs.torso = torso;

        // Полицейский значок на груди
        const badgeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.02);
        const badge = new THREE.Mesh(badgeGeo, goldBadgeMat);
        badge.position.set(0.14, 0.12, 0.16);
        torso.add(badge);

        // Голова
        const headGeo = new THREE.BoxGeometry(0.3, 0.32, 0.3);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.y = 0.5;
        torso.add(head);
        this.limbs.head = head;

        // Полицейская фуражка
        const capBase = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 12), capMat);
        capBase.position.y = 0.18;
        const capVisor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.14), new THREE.MeshBasicMaterial({ color: 0x000000 }));
        capVisor.position.set(0, 0.14, 0.18);
        capVisor.rotation.x = 0.2;
        head.add(capBase, capVisor);

        // Руки
        const createArm = (isRight) => {
            const pivot = new THREE.Group();
            pivot.position.set(isRight ? 0.36 : -0.36, 0.24, 0);
            torso.add(pivot);

            const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.35, 0.18), uniformMat);
            shoulder.position.y = -0.16;
            pivot.add(shoulder);

            const forearmPivot = new THREE.Group();
            forearmPivot.position.set(0, -0.32, 0);
            pivot.add(forearmPivot);

            const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.32, 0.15), skinMat);
            forearm.position.y = -0.14;
            forearmPivot.add(forearm);

            return { pivot, forearmPivot, forearm };
        };

        this.limbs.leftArm = createArm(false);
        this.limbs.rightArm = createArm(true);

        // Табельный пистолет в правой руке
        const copGun = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.24), gunMat);
        copGun.position.set(0, -0.28, 0.08);
        copGun.rotation.x = Math.PI / 2;
        this.limbs.rightArm.forearmPivot.add(copGun);

        // Ноги
        const createLeg = (isRight) => {
            const pivot = new THREE.Group();
            pivot.position.set(isRight ? 0.16 : -0.16, -0.35, 0);
            torso.add(pivot);

            const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.2), pantsMat);
            thigh.position.y = -0.18;
            pivot.add(thigh);

            const shinPivot = new THREE.Group();
            shinPivot.position.set(0, -0.38, 0);
            pivot.add(shinPivot);

            const shin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.4, 0.18), pantsMat);
            shin.position.y = -0.18;
            shinPivot.add(shin);

            return { pivot, shinPivot };
        };

        this.limbs.leftLeg = createLeg(false);
        this.limbs.rightLeg = createLeg(true);

        if (startPos) {
            this.group.position.set(startPos.x, startPos.y || 0.2, startPos.z);
        }
    }

    initPhysics(startPos) {
        const radius = 0.45;
        const height = 1.4;
        const shape = new CANNON.Cylinder(radius, radius, height, 8);
        const q = new CANNON.Quaternion();
        q.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);

        this.body = new CANNON.Body({
            mass: 75,
            material: (this.physicsMaterials && this.physicsMaterials.pedestrian) || this.physicsMaterials.default,
            fixedRotation: true,
            position: new CANNON.Vec3(startPos.x, (startPos.y || 0.2) + 0.85, startPos.z)
        });
        this.body.addShape(shape, new CANNON.Vec3(0, 0, 0), q);
        this.body.linearDamping = 0.85;

        if (this.world) {
            this.world.addBody(this.body);
        }
    }

    takeDamage(amount) {
        if (this.isDead) return;
        this.hp -= amount;

        if (this.hp <= 0) {
            this.die();
        } else {
            this.knockedDownTimer = 2.0;
            this.state = 'KNOCKED_DOWN';
        }
    }

    die() {
        this.isDead = true;
        this.state = 'DEAD';
        this.knockedDownTimer = 999;

        if (this.body) {
            this.body.velocity.set(0, 0, 0);
        }

        this.group.rotation.set(-Math.PI / 2, 0, this.targetRotation);
        this.group.position.y = 0.2;

        // Выпадение денег
        if (window.gameEngine && window.gameEngine.playerController) {
            window.gameEngine.playerController.addMoney(750);
            if (window.soundEngine && typeof window.soundEngine.playCashPickup === 'function') {
                window.soundEngine.playCashPickup();
            }
        }

        // Оповещение системы розыска об убийстве полицейского
        if (window.gameEngine && window.gameEngine.wantedManager) {
            window.gameEngine.wantedManager.reportCrime('KILL_COP', this.group.position);
        }
    }

    update(deltaTime, playerPos) {
        if (!this.body) return;
        const dt = Math.min(deltaTime, 0.1);

        if (this.isDead) {
            this.group.position.set(this.body.position.x, 0.2, this.body.position.z);
            return;
        }

        if (this.state === 'KNOCKED_DOWN') {
            this.knockedDownTimer -= dt;
            this.group.position.set(this.body.position.x, 0.3, this.body.position.z);
            this.group.rotation.set(-Math.PI / 2, 0, this.targetRotation);

            if (this.knockedDownTimer <= 0) {
                this.state = 'CHASE';
                this.group.rotation.set(0, this.targetRotation, 0);
            }
            return;
        }

        if (!playerPos) return;

        const wantedMgr = window.gameEngine && window.gameEngine.wantedManager;
        const isHidden = wantedMgr && wantedMgr.isPlayerHidden(this.body.position);

        // Целевая позиция движения: если игрок скрыт в листве, идем к последней известной точке
        let targetPos = playerPos;
        if (isHidden) {
            if (wantedMgr.lastKnownPosition) {
                targetPos = wantedMgr.lastKnownPosition;
            } else {
                targetPos = this.body.position;
            }
        }

        const dx = targetPos.x - this.body.position.x;
        const dz = targetPos.z - this.body.position.z;
        const distToTarget = Math.hypot(dx, dz);
        const distToActualPlayer = Math.hypot(playerPos.x - this.body.position.x, playerPos.z - this.body.position.z);

        // Если коп подошел в упор к спрятавшемуся игроку (< 2.2м), он его находит
        if (isHidden && distToActualPlayer < 2.2) {
            if (wantedMgr) wantedMgr.revealPlayer();
        }

        if (distToTarget > 0.5) {
            this.targetRotation = Math.atan2(dx, dz);
        }
        this.group.rotation.y = this.targetRotation;

        const moveSpeed = isHidden ? 3.2 : 6.2; // При поиске медленный шаг с осмотром

        if (isHidden) {
            // Режим поиска (Search / Patrol)
            if (distToTarget > 2.5) {
                const moveX = (dx / distToTarget) * moveSpeed;
                const moveZ = (dz / distToTarget) * moveSpeed;
                this.body.velocity.x = moveX;
                this.body.velocity.z = moveZ;

                this.walkCycle += dt * 7.0;
                const sinW = Math.sin(this.walkCycle);
                this.limbs.leftLeg.pivot.rotation.x = sinW * 0.5;
                this.limbs.rightLeg.pivot.rotation.x = -sinW * 0.5;
                this.limbs.leftArm.pivot.rotation.x = -sinW * 0.4;
                this.limbs.rightArm.pivot.rotation.set(-0.8, 0, 0);
            } else {
                // Осматривается по сторонам
                this.body.velocity.x *= 0.7;
                this.body.velocity.z *= 0.7;
                this.targetRotation += Math.sin(Date.now() * 0.002) * 0.03;
                this.group.rotation.y = this.targetRotation;
                this.limbs.leftLeg.pivot.rotation.x = 0;
                this.limbs.rightLeg.pivot.rotation.x = 0;
                this.limbs.rightArm.pivot.rotation.set(-0.5, 0, 0);
            }
        } else if (distToTarget > 24.0) {
            // Бежим к игроку
            this.state = 'CHASE';
            const moveX = (dx / distToTarget) * moveSpeed;
            const moveZ = (dz / distToTarget) * moveSpeed;
            this.body.velocity.x = moveX;
            this.body.velocity.z = moveZ;

            this.walkCycle += dt * 12.0;
            const sinW = Math.sin(this.walkCycle);
            this.limbs.leftLeg.pivot.rotation.x = sinW * 0.7;
            this.limbs.rightLeg.pivot.rotation.x = -sinW * 0.7;
            this.limbs.leftArm.pivot.rotation.x = -sinW * 0.7;
            this.limbs.rightArm.pivot.rotation.set(-1.2, 0, 0); // Держит пистолет наготове
        } else {
            // В радиусе поражения: прицеливаемся и стреляем
            this.state = 'AIM_AND_SHOOT';
            this.body.velocity.x *= 0.5;
            this.body.velocity.z *= 0.5;

            this.limbs.leftLeg.pivot.rotation.x = 0;
            this.limbs.rightLeg.pivot.rotation.x = 0;
            this.limbs.rightArm.pivot.rotation.set(-Math.PI / 2, 0, 0); // Рука с пистолетом вытянута
            this.limbs.leftArm.pivot.rotation.set(-Math.PI / 2, 0, 0.4);

            this.fireTimer -= dt;
            if (this.fireTimer <= 0) {
                this.fireTimer = 0.9 + Math.random() * 0.6;
                this.shootAtPlayer(playerPos);
            }
        }

        const groundY = (window.gameEngine && window.gameEngine.terrainManager)
            ? window.gameEngine.terrainManager.getTerrainHeight(this.body.position.x, this.body.position.z)
            : 0.0;
        this.body.position.y = groundY + 0.85;
        this.group.position.set(this.body.position.x, groundY, this.body.position.z);
    }

    shootAtPlayer(playerPos) {
        if (window.soundEngine && typeof window.soundEngine.playGunshot === 'function') {
            window.soundEngine.playGunshot('PISTOL');
        }

        const startPos = new THREE.Vector3(
            this.body.position.x,
            this.body.position.y + 0.4,
            this.body.position.z
        );

        const targetPos = new THREE.Vector3(
            playerPos.x + (Math.random() - 0.5) * 0.6,
            playerPos.y + 0.8 + (Math.random() - 0.5) * 0.4,
            playerPos.z + (Math.random() - 0.5) * 0.6
        );

        if (window.gameEngine && window.gameEngine.vfxManager) {
            const dir = new THREE.Vector3().subVectors(targetPos, startPos).normalize();
            window.gameEngine.vfxManager.createMuzzleFlash(startPos, dir);
            window.gameEngine.vfxManager.createBulletTracer(startPos, targetPos);
        }

        // Нанесение урона игроку при попадании
        if (Math.random() < 0.65) {
            if (window.gameEngine && window.gameEngine.playerController) {
                window.gameEngine.playerController.takeDamage(12 + Math.floor(Math.random() * 8));
            }
        }
    }

    destroy() {
        if (this.group && this.scene) {
            this.scene.remove(this.group);
        }
        if (this.body && this.world) {
            this.world.remove(this.body);
        }
    }
}
window.PoliceOfficerNPC = PoliceOfficerNPC;
