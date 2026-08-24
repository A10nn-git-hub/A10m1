/**
 * PoliceVehicle - класс полицейского патрульного автомобиля LSPD с мигалками, сиреной и ИИ преследования
 */
class PoliceVehicle {
    constructor(scene, world, physicsMaterials, startX, startZ, startRot = 0) {
        this.scene = scene;
        this.world = world;
        this.physicsMaterials = physicsMaterials;

        this.topSpeed = 160.0;
        this.isChasing = true;
        this.disembarked = false;
        this.strobeTimer = 0;
        this.isRedStrobe = true;

        this.carGroup = new THREE.Group();
        this.scene.add(this.carGroup);

        this.buildPoliceCarModel();
        this.initPhysics(startX, startZ, startRot);
    }

    buildPoliceCarModel() {
        const blackMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.35, metalness: 0.8 });
        const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf0f4f8, roughness: 0.4, metalness: 0.3 });
        const glassMat = new THREE.MeshStandardMaterial({ color: 0x081b29, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.65 });
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
        const bumperMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.6, metalness: 0.7 });

        // 1. Основной кузов (Черно-белая раскраска)
        const mainBody = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.6), blackMat);
        mainBody.position.y = 0.55;
        this.carGroup.add(mainBody);

        // Белые двери и боковины
        const whiteDoors = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.68, 2.2), whiteMat);
        whiteDoors.position.set(0, 0.55, 0);
        this.carGroup.add(whiteDoors);

        // Белая крыша и стойки
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.4), whiteMat);
        cabin.position.set(0, 1.15, -0.2);
        this.carGroup.add(cabin);

        // Лобовое и заднее стекло
        const glassFront = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.55, 0.8), glassMat);
        glassFront.position.set(0, 1.12, 0.65);
        glassFront.rotation.x = -0.4;
        const glassBack = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.55, 0.7), glassMat);
        glassBack.position.set(0, 1.12, -1.05);
        glassBack.rotation.x = 0.35;
        this.carGroup.add(glassFront, glassBack);

        // Силовой полицейский кенгурятник (Push-Bumper)
        const pushBumper = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.45, 0.25), bumperMat);
        pushBumper.position.set(0, 0.5, 2.4);
        this.carGroup.add(pushBumper);

        // 2. Полицейская люстра / мигалка на крыше
        const lightbarBase = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.3), bumperMat);
        lightbarBase.position.set(0, 1.52, -0.2);

        this.redLightMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.26), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
        this.redLightMesh.position.set(-0.35, 1.54, -0.2);

        this.blueLightMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.26), new THREE.MeshBasicMaterial({ color: 0x0044ff }));
        this.blueLightMesh.position.set(0.35, 1.54, -0.2);

        this.redSpot = new THREE.PointLight(0xff0000, 3.5, 25.0);
        this.redSpot.position.set(-0.6, 1.6, -0.2);

        this.blueSpot = new THREE.PointLight(0x0066ff, 3.5, 25.0);
        this.blueSpot.position.set(0.6, 1.6, -0.2);

        this.carGroup.add(lightbarBase, this.redLightMesh, this.blueLightMesh, this.redSpot, this.blueSpot);

        // Колеса
        const wheelPositions = [
            [-1.05, 0.35, 1.35],
            [1.05, 0.35, 1.35],
            [-1.05, 0.35, -1.35],
            [1.05, 0.35, -1.35]
        ];

        this.wheels = [];
        wheelPositions.forEach(([x, y, z]) => {
            const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 12);
            wheelGeo.rotateZ(Math.PI / 2);
            const wMesh = new THREE.Mesh(wheelGeo, wheelMat);
            wMesh.position.set(x, y, z);
            this.carGroup.add(wMesh);
            this.wheels.push(wMesh);
        });
    }

    initPhysics(startX, startZ, startRot) {
        const chassisShape = new CANNON.Box(new CANNON.Vec3(1.05, 0.45, 2.3));
        this.chassisBody = new CANNON.Body({
            mass: 1650,
            material: (this.physicsMaterials && this.physicsMaterials.vehicle) || this.physicsMaterials.default,
            position: new CANNON.Vec3(startX, 1.2, startZ)
        });
        this.chassisBody.addShape(chassisShape, new CANNON.Vec3(0, 0.45, 0));
        this.chassisBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), startRot);
        this.chassisBody.linearDamping = 0.15;
        this.chassisBody.angularDamping = 0.65;

        if (this.world) {
            this.world.addBody(this.chassisBody);
        }
    }

    update(deltaTime, playerPos, officerManager) {
        if (!this.chassisBody) return;
        const dt = Math.min(deltaTime, 0.1);

        // 1. Анимация стробоскопа мигалок
        this.strobeTimer += dt;
        if (this.strobeTimer >= 0.12) {
            this.strobeTimer = 0;
            this.isRedStrobe = !this.isRedStrobe;

            this.redLightMesh.material.color.setHex(this.isRedStrobe ? 0xff0000 : 0x330000);
            this.blueLightMesh.material.color.setHex(this.isRedStrobe ? 0x001133 : 0x0066ff);

            this.redSpot.intensity = this.isRedStrobe ? 4.5 : 0.2;
            this.blueSpot.intensity = this.isRedStrobe ? 0.2 : 4.5;
        }

        // 2. ИИ преследования игрока
        if (playerPos && this.isChasing) {
            const pos = this.chassisBody.position;
            const wantedMgr = window.gameEngine && window.gameEngine.wantedManager;
            const isHidden = wantedMgr && wantedMgr.isPlayerHidden(pos);

            // Если игрок скрыт в листве — едем к последней известной позиции
            let targetPos = playerPos;
            if (isHidden) {
                if (wantedMgr.lastKnownPosition) {
                    targetPos = wantedMgr.lastKnownPosition;
                } else {
                    targetPos = pos;
                }
            }

            const dx = targetPos.x - pos.x;
            const dz = targetPos.z - pos.z;
            const dist = Math.hypot(dx, dz);
            const distToActualPlayer = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);

            // Если машина подъехала в упор к спрятавшемуся (< 3.5м), раскрываем игрока
            if (isHidden && distToActualPlayer < 3.5) {
                if (wantedMgr) wantedMgr.revealPlayer();
            }

            if (dist > 1.5) {
                const targetAngle = Math.atan2(-dx, -dz);
                const currentEuler = new THREE.Euler().setFromQuaternion(
                    new THREE.Quaternion(
                        this.chassisBody.quaternion.x,
                        this.chassisBody.quaternion.y,
                        this.chassisBody.quaternion.z,
                        this.chassisBody.quaternion.w
                    ),
                    'YXZ'
                );

                let diffAngle = targetAngle - currentEuler.y;
                while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
                while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;

                // Поворот машины
                const turnRate = 3.2;
                const newYaw = currentEuler.y + Math.max(-turnRate * dt, Math.min(turnRate * dt, diffAngle));
                this.chassisBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), newYaw);

                // Разгон
                const forwardX = -Math.sin(newYaw);
                const forwardZ = -Math.cos(newYaw);
                const speed = isHidden ? 14.0 : ((dist > 12.0) ? 26.0 : 18.0);

                this.chassisBody.velocity.x = THREE.MathUtils.lerp(this.chassisBody.velocity.x, forwardX * speed, dt * 2.5);
                this.chassisBody.velocity.z = THREE.MathUtils.lerp(this.chassisBody.velocity.z, forwardZ * speed, dt * 2.5);
            } else {
                // Остановка в точке поиска
                this.chassisBody.velocity.x *= 0.8;
                this.chassisBody.velocity.z *= 0.8;
            }

            // Высадка офицеров для пешего прочесывания местности
            if (((!isHidden && dist < 14.0) || (isHidden && dist < 8.0)) && !this.disembarked && officerManager) {
                this.disembarked = true;
                this.isChasing = false;
                officerManager.spawnOfficersNearCar(pos);
            }
        }

        // 3. Синхронизация 3D-модели с телом Cannon.js
        this.carGroup.position.copy(this.chassisBody.position);
        this.carGroup.quaternion.copy(this.chassisBody.quaternion);

        // Вращение колес по ходу движения
        const speed = Math.hypot(this.chassisBody.velocity.x, this.chassisBody.velocity.z);
        for (let i = 0; i < this.wheels.length; i++) {
            this.wheels[i].rotation.x += speed * dt * 1.5;
        }
    }

    destroy() {
        if (this.carGroup && this.scene) {
            this.scene.remove(this.carGroup);
        }
        if (this.chassisBody && this.world) {
            this.world.remove(this.chassisBody);
        }
    }
}
window.PoliceVehicle = PoliceVehicle;
