class AITrafficVehicle {
            constructor(scene, world, physicsMaterials, terrainManager, id) {
                this.scene = scene;
                this.world = world;
                this.physicsMaterials = physicsMaterials;
                this.terrainManager = terrainManager;
                this.id = id;

                this.route = null;
                this.waypointIndex = 0;
                this.heading = 0.0;
                this.currentSpeed = 0.0;
                this.targetSpeed = 12.5;
                this.isBraking = false;
                this.carName = 'City Sedan';

                // Поведение: 65% авто постоянно ездят по правой полосе ('CRUISER'), 35% останавливаются у домов и высаживают жителей ('COMMUTER')
                this.behavior = (this.id % 3 === 0) ? 'COMMUTER' : 'CRUISER';
                this.state = 'CRUISING'; // 'CRUISING', 'PARKING', 'PARKED'
                this.tripTimer = 25.0 + Math.random() * 45.0;
                this.parkTimer = 0.0;

                this.buildVisualModel();
                this.buildPhysicsBody();
            }

            buildVisualModel() {
                this.group = new THREE.Group();

                const colors = [0xd32f2f, 0x1976d2, 0x388e3c, 0xfbc02d, 0x212121, 0x7b1fa2, 0xe0e0e0, 0x5d4037];
                const carColor = colors[this.id % colors.length];

                // 1. Кузов
                this.matPaint = new THREE.MeshLambertMaterial({ color: carColor });
                const bodyGeo = new THREE.BoxGeometry(2.0, 0.75, 4.4);
                const bodyMesh = new THREE.Mesh(bodyGeo, this.matPaint);
                bodyMesh.position.set(0, 0.65, 0);
                bodyMesh.castShadow = true;
                this.group.add(bodyMesh);

                // 2. Салон, прозрачные тонированные окна и 3D-водитель NPC
                const matGlass = new THREE.MeshLambertMaterial({ color: 0x64748b, transparent: true, opacity: 0.45 });
                const cabinGeo = new THREE.BoxGeometry(1.7, 0.65, 2.3);
                const cabinMesh = new THREE.Mesh(cabinGeo, matGlass);
                cabinMesh.position.set(0, 1.25, -0.2);
                cabinMesh.castShadow = true;
                this.group.add(cabinMesh);

                // Фигурка водителя NPC внутри салона
                this.driverMesh = new THREE.Group();
                this.driverMesh.position.set(-0.35, 0.85, 0.05);

                const skinColors = [0xffdbac, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524];
                const shirtColors = [0x2563eb, 0xdc2626, 0x059669, 0xd97706, 0x475569, 0x1e293b, 0x7c3aed];

                const matSkin = new THREE.MeshLambertMaterial({ color: skinColors[this.id % skinColors.length] });
                const matShirt = new THREE.MeshLambertMaterial({ color: shirtColors[this.id % shirtColors.length] });
                const matWheel = new THREE.MeshLambertMaterial({ color: 0x1e293b });

                const driverHead = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), matSkin);
                driverHead.position.set(0, 0.52, 0);
                this.driverMesh.add(driverHead);

                const driverTorso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.46, 0.3), matShirt);
                driverTorso.position.set(0, 0.22, 0);
                this.driverMesh.add(driverTorso);

                const steeringWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 12), matWheel);
                steeringWheel.rotation.x = Math.PI / 3;
                steeringWheel.position.set(0, 0.28, 0.32);
                this.driverMesh.add(steeringWheel);

                const driverArmL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), matShirt);
                driverArmL.position.set(-0.2, 0.25, 0.16);
                driverArmL.rotation.x = -Math.PI / 4;
                this.driverMesh.add(driverArmL);

                const driverArmR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), matShirt);
                driverArmR.position.set(0.2, 0.25, 0.16);
                driverArmR.rotation.x = -Math.PI / 4;
                this.driverMesh.add(driverArmR);

                this.group.add(this.driverMesh);

                this.matHeadlight = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x000000 });
                const hlGeo = new THREE.BoxGeometry(0.35, 0.14, 0.1);
                const hlL = new THREE.Mesh(hlGeo, this.matHeadlight);
                hlL.position.set(-0.7, 0.7, 2.22);
                const hlR = new THREE.Mesh(hlGeo, this.matHeadlight);
                hlR.position.set(0.7, 0.7, 2.22);
                this.group.add(hlL); this.group.add(hlR);

                this.matTaillight = new THREE.MeshLambertMaterial({ color: 0x660000, emissive: 0x330000 });
                const tlGeo = new THREE.BoxGeometry(0.4, 0.14, 0.1);
                const tlL = new THREE.Mesh(tlGeo, this.matTaillight);
                tlL.position.set(-0.7, 0.7, -2.22);
                const tlR = new THREE.Mesh(tlGeo, this.matTaillight);
                tlR.position.set(0.7, 0.7, -2.22);
                this.group.add(tlL); this.group.add(tlR);

                this.matTire = new THREE.MeshLambertMaterial({ color: 0x1f2937 });
                this.wheelMeshes = [];
                const wheelPositions = [
                    { x: -0.95, y: 0.35, z: 1.3, isFront: true },
                    { x: 0.95, y: 0.35, z: 1.3, isFront: true },
                    { x: -0.95, y: 0.35, z: -1.3, isFront: false },
                    { x: 0.95, y: 0.35, z: -1.3, isFront: false }
                ];

                const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
                wheelGeo.rotateZ(Math.PI / 2);

                for (const wp of wheelPositions) {
                    const wMesh = new THREE.Mesh(wheelGeo, this.matTire);
                    wMesh.position.set(wp.x, wp.y, wp.z);
                    wMesh.castShadow = true;
                    this.group.add(wMesh);
                    this.wheelMeshes.push({ mesh: wMesh, isFront: wp.isFront, basePos: wp });
                }

                this.scene.add(this.group);
            }

            buildPhysicsBody() {
                this.chassisBody = new CANNON.Body({
                    mass: 1400,
                    material: this.physicsMaterials.wall,
                    position: new CANNON.Vec3(0, -999, 0)
                });
                this.chassisBody.addShape(new CANNON.Box(new CANNON.Vec3(1.0, 0.75, 2.2)));
                this.world.addBody(this.chassisBody);
            }

            spawnOnRoute(route, wpIndex = 0) {
                this.route = route;
                this.waypointIndex = wpIndex % route.length;

                const wp = this.route[this.waypointIndex];
                const nextWp = this.route[(this.waypointIndex + 1) % this.route.length];

                if (window.gameEngine && window.gameEngine.districtManager) {
                    const district = window.gameEngine.districtManager.getDistrictAt(wp.x, wp.z);
                    const dId = district ? district.id : 'downtown';

                    if (dId === 'richman' || dId === 'downtown') {
                        const luxuryNames = ['Pfister Comet S2', 'Pegassi Zentorno', 'Grotti Turismo', 'Enus Paragon', 'Benefactor Schafter'];
                        const luxuryColors = [0xdc2626, 0x2563eb, 0xf8fafc, 0x18181b, 0xd97706, 0x7c3aed];
                        this.carName = luxuryNames[this.id % luxuryNames.length];
                        this.matPaint.color.setHex(luxuryColors[this.id % luxuryColors.length]);
                    } else if (dId === 'lapuerta' || dId === 'cypress') {
                        const industrialNames = ['Vapid Sadler Utility', 'Brute Boxville Delivery', 'Bravado Rumpo Van', 'MTL Pounder Cargo'];
                        const industrialColors = [0x475569, 0x94a3b8, 0xb45309, 0xca8a04, 0x334155];
                        this.carName = industrialNames[this.id % industrialNames.length];
                        this.matPaint.color.setHex(industrialColors[this.id % industrialColors.length]);
                    } else if (dId === 'senora' || dId === 'grapeseed' || dId === 'chiliad' || dId === 'palomino') {
                        const countryNames = ['Karin Rebel 4x4', 'Canis Mesa Offroad', 'Vapid Sandking XL', 'Declasse Rancher'];
                        const countryColors = [0x78350f, 0x3f6212, 0xa16207, 0x57534e, 0x713f12];
                        this.carName = countryNames[this.id % countryNames.length];
                        this.matPaint.color.setHex(countryColors[this.id % countryColors.length]);
                        this.matPaint.metalness = 0.4;
                        this.matPaint.roughness = 0.65;
                    } else {
                        // Городские городские седаны (City Core)
                        const cityNames = ['Albany V-STR', 'Karin Sultan', 'Vapid Dominator', 'Gallivanter Baller'];
                        const cityColors = [0xd32f2f, 0x1976d2, 0x388e3c, 0xfbc02d, 0x212121];
                        this.carName = cityNames[this.id % cityNames.length];
                        this.matPaint.color.setHex(cityColors[this.id % cityColors.length]);
                        this.matPaint.metalness = 0.85;
                        this.matPaint.roughness = 0.25;
                    }
                }

                const groundY = this.terrainManager ? this.terrainManager.getTerrainHeight(wp.x, wp.z) : 0.0;
                // Учет высоты эстакады если на автомагистрали над низиной
                const isOverpass = Math.abs(wp.x) > 430 && Math.abs(wp.z) < 80;
                const posY = isOverpass ? 6.2 : groundY + 0.35;

                this.heading = Math.atan2(nextWp.x - wp.x, nextWp.z - wp.z);
                this.currentSpeed = wp.speed * (0.8 + Math.random() * 0.3);

                this.chassisBody.position.set(wp.x, posY, wp.z);
                this.chassisBody.velocity.set(
                    Math.sin(this.heading) * this.currentSpeed,
                    0,
                    Math.cos(this.heading) * this.currentSpeed
                );
                this.group.position.set(wp.x, posY, wp.z);
                this.group.rotation.set(0, this.heading, 0);
            }

            update(deltaTime, playerPos, activePlayerCar, allAITraffic, nightFactor, allPedestrians = []) {
                if (!this.route || this.route.length === 0) return;

                const pos = this.chassisBody.position;
                const targetWp = this.route[this.waypointIndex];
                const distToWp = Math.hypot(targetWp.x - pos.x, targetWp.z - pos.z);

                if (distToWp < 6.0) {
                    this.waypointIndex = (this.waypointIndex + 1) % this.route.length;
                }

                // 1. Определение базовой скорости по дорожному полотну
                let cruiseSpeed = targetWp.speed;
                let obstacleAhead = false;
                let obstacleDist = 999.0;
                let pedestrianAvoidanceSteer = 0.0;
                let emergencyPedestrianStop = false;

                // 2. Логика остановок у домов и выхода жителей (COMMUTER)
                if (this.behavior === 'COMMUTER') {
                    if (this.state === 'CRUISING') {
                        this.tripTimer -= deltaTime;
                        if (this.tripTimer <= 0) {
                            this.state = 'PARKING';
                        }
                    } else if (this.state === 'PARKING') {
                        cruiseSpeed = 0.0;
                        if (this.currentSpeed < 0.3) {
                            this.currentSpeed = 0.0;
                            this.state = 'PARKED';
                            this.parkTimer = 16.0 + Math.random() * 20.0;
                            // NPC водитель выходит из машины на тротуар
                            this.driverMesh.visible = false;
                            if (window.gameEngine && window.gameEngine.pedestrianManager) {
                                const pedMgr = window.gameEngine.pedestrianManager;
                                const freePed = pedMgr.pedestrians.find(p => p.state !== 'KNOCKED_DOWN' && p.interiorState === 'NONE' && p.npcType !== 'SOCCER_PLAYER');
                                if (freePed && freePed.body) {
                                    const exitX = pos.x + Math.cos(this.heading) * 1.8;
                                    const exitZ = pos.z - Math.sin(this.heading) * 1.8;
                                    freePed.body.position.set(exitX, 0.8, exitZ);
                                    freePed.body.velocity.set(0, 0, 0);
                                    freePed.targetRotation = this.heading + Math.PI / 2;
                                }
                            }
                        }
                    } else if (this.state === 'PARKED') {
                        cruiseSpeed = 0.0;
                        this.parkTimer -= deltaTime;
                        if (this.parkTimer <= 0) {
                            // Водитель садится обратно и автомобиль возобновляет поездку
                            this.driverMesh.visible = true;
                            this.state = 'CRUISING';
                            this.tripTimer = 35.0 + Math.random() * 55.0;
                        }
                    }
                }

                // 3. Фронтальный радар / сенсор обнаружения препятствий и пешеходов
                const fwdX = Math.sin(this.heading);
                const fwdZ = Math.cos(this.heading);
                const rightX = fwdZ;
                const rightZ = -fwdX;

                // Проверка пешеходов NPC (полная остановка + объезд)
                if (allPedestrians && allPedestrians.length > 0) {
                    for (let i = 0; i < allPedestrians.length; i++) {
                        const ped = allPedestrians[i];
                        if (!ped || !ped.body) continue;
                        const pedPos = ped.body.position;
                        const toPedX = pedPos.x - pos.x;
                        const toPedZ = pedPos.z - pos.z;
                        const dPedSq = toPedX * toPedX + toPedZ * toPedZ;

                        if (dPedSq < 784.0 && dPedSq > 0.01) { // 28.0^2
                            const longDist = toPedX * fwdX + toPedZ * fwdZ;
                            const latDist = toPedX * rightX + toPedZ * rightZ;

                            if (longDist > -0.8 && longDist < 26.0) {
                                const corridorWidth = (longDist < 8.0) ? 3.0 : 2.5;
                                if (Math.abs(latDist) < corridorWidth) {
                                    obstacleAhead = true;
                                    obstacleDist = Math.min(obstacleDist, Math.max(0.1, longDist));

                                    // Экстренная остановка, если пешеход прямо перед капотом
                                    if (longDist < 6.8 && Math.abs(latDist) < 2.2) {
                                        emergencyPedestrianStop = true;
                                    }

                                    // Расчет угла объезда препятствия
                                    const steerDir = latDist >= 0 ? -1.0 : 1.0;
                                    const urgency = (26.0 - longDist) / 26.0;
                                    const lateralOverlap = (corridorWidth - Math.abs(latDist)) / corridorWidth;
                                    const avoidTerm = steerDir * urgency * lateralOverlap * 0.55;

                                    if (Math.abs(avoidTerm) > Math.abs(pedestrianAvoidanceSteer)) {
                                        pedestrianAvoidanceSteer = avoidTerm;
                                    }
                                }
                            }
                        }
                    }
                }

                // Проверка игрока пешком
                if (playerPos && !activePlayerCar) {
                    const toPX = playerPos.x - pos.x;
                    const toPZ = playerPos.z - pos.z;
                    const dPlayerSq = toPX * toPX + toPZ * toPZ;
                    if (dPlayerSq < 784.0 && dPlayerSq > 0.01) { // 28.0^2
                        const longDist = toPX * fwdX + toPZ * fwdZ;
                        const latDist = toPX * rightX + toPZ * rightZ;

                        if (longDist > -0.8 && longDist < 26.0) {
                            const corridorWidth = (longDist < 8.0) ? 3.2 : 2.6;
                            if (Math.abs(latDist) < corridorWidth) {
                                obstacleAhead = true;
                                obstacleDist = Math.min(obstacleDist, Math.max(0.1, longDist));

                                if (longDist < 7.0 && Math.abs(latDist) < 2.4) {
                                    emergencyPedestrianStop = true;
                                }

                                const steerDir = latDist >= 0 ? -1.0 : 1.0;
                                const urgency = (26.0 - longDist) / 26.0;
                                const lateralOverlap = (corridorWidth - Math.abs(latDist)) / corridorWidth;
                                const avoidTerm = steerDir * urgency * lateralOverlap * 0.55;

                                if (Math.abs(avoidTerm) > Math.abs(pedestrianAvoidanceSteer)) {
                                    pedestrianAvoidanceSteer = avoidTerm;
                                }
                            }
                        }
                    }
                }

                // Проверка управляемого автомобиля игрока
                if (activePlayerCar && activePlayerCar.chassisBody) {
                    const carPos = activePlayerCar.chassisBody.position;
                    const toCX = carPos.x - pos.x;
                    const toCZ = carPos.z - pos.z;
                    const dCarSq = toCX * toCX + toCZ * toCZ;
                    if (dCarSq < 676.0 && dCarSq > 0.01) { // 26.0^2
                        const dCar = Math.sqrt(dCarSq);
                        const dot = (fwdX * toCX + fwdZ * toCZ) / dCar;
                        if (dot > 0.6) {
                            obstacleAhead = true;
                            obstacleDist = Math.min(obstacleDist, dCar);
                        }
                    }
                }

                // Проверка других AI-автомобилей впереди в полосе
                for (let i = 0; i < allAITraffic.length; i++) {
                    const other = allAITraffic[i];
                    if (other.id === this.id) continue;
                    const oPos = other.chassisBody.position;
                    const toOX = oPos.x - pos.x;
                    const toOZ = oPos.z - pos.z;
                    const dOtherSq = toOX * toOX + toOZ * toOZ;
                    if (dOtherSq < 484.0 && dOtherSq > 0.01) { // 22.0^2
                        const dOther = Math.sqrt(dOtherSq);
                        const dot = (fwdX * toOX + fwdZ * toOZ) / dOther;
                        if (dot > 0.7) {
                            obstacleAhead = true;
                            obstacleDist = Math.min(obstacleDist, dOther);
                        }
                    }
                }

                // 4. Регулирование скорости и торможение
                if (emergencyPedestrianStop || (obstacleAhead && obstacleDist < 6.5) || this.state === 'PARKED') {
                    this.targetSpeed = 0.0;
                    this.isBraking = true;
                } else if (obstacleAhead || this.state === 'PARKING') {
                    const safeDistance = 5.5;
                    const speedRatio = Math.max(0.0, Math.min(1.0, (obstacleDist - safeDistance) / 14.0));
                    this.targetSpeed = Math.min(cruiseSpeed, cruiseSpeed * Math.pow(speedRatio, 1.2));
                    this.isBraking = true;
                } else {
                    this.targetSpeed = cruiseSpeed;
                    this.isBraking = this.currentSpeed > this.targetSpeed + 1.5;
                }

                // Ускорение / замедление (мгновенный отклик на экстренное торможение)
                const accelRate = emergencyPedestrianStop ? 22.0 : (this.isBraking ? 14.0 : 6.0);
                this.currentSpeed += (this.targetSpeed - this.currentSpeed) * Math.min(deltaTime * accelRate, 1.0);
                if (this.currentSpeed < 0.05) this.currentSpeed = 0.0;

                // 5. Руление, доворот на вейпоинт и объезд пешеходов
                let steerAngle = 0;
                if (this.state !== 'PARKED') {
                    let targetAngle = Math.atan2(targetWp.x - pos.x, targetWp.z - pos.z);

                    // Добавление корректирующего смещения для объезда пешехода
                    if (Math.abs(pedestrianAvoidanceSteer) > 0.01) {
                        targetAngle += pedestrianAvoidanceSteer;
                    }

                    let angleDiff = targetAngle - this.heading;
                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

                    const turnRate = Math.min(deltaTime * (pedestrianAvoidanceSteer !== 0 ? 6.0 : 4.5), 1.0);
                    this.heading += angleDiff * turnRate;
                    steerAngle = THREE.MathUtils.clamp(angleDiff * 1.8, -0.45, 0.45);
                }

                // 6. Движение и защита от застревания в стенах
                const isBlockedByWall = (this.currentSpeed < 0.3 && this.targetSpeed > 1.5);
                if (isBlockedByWall) {
                    this.stuckTimer = (this.stuckTimer || 0) + deltaTime;
                    if (this.stuckTimer > 1.8) {
                        // Машина разворачивается или перескакивает на чистый маршрут
                        this.stuckTimer = 0;
                        const routes = this.route;
                        if (routes && routes.length > 2) {
                            this.currentWaypointIndex = (this.currentWaypointIndex + 2) % routes.length;
                            const nextWp = routes[this.currentWaypointIndex];
                            this.chassisBody.position.set(nextWp.x, 0.4, nextWp.z);
                            this.heading = Math.atan2(nextWp.x - pos.x, nextWp.z - pos.z);
                        }
                    }
                } else {
                    this.stuckTimer = 0;
                }

                const vx = Math.sin(this.heading) * this.currentSpeed;
                const vz = Math.cos(this.heading) * this.currentSpeed;

                const groundY = this.terrainManager ? this.terrainManager.getTerrainHeight(pos.x, pos.z) : 0.0;
                const isOverpass = Math.abs(pos.x) > 430 && Math.abs(pos.z) < 80;
                const targetY = isOverpass ? 6.2 : groundY + 0.35;

                this.chassisBody.position.x += vx * deltaTime;
                this.chassisBody.position.z += vz * deltaTime;
                this.chassisBody.position.y += (targetY - this.chassisBody.position.y) * Math.min(deltaTime * 10.0, 1.0);
                this.chassisBody.velocity.set(vx, 0, vz);
                this.group.position.copy(this.chassisBody.position);
                this.group.rotation.set(0, this.heading, 0);

                // 7. Визуальные эффекты фар, стоп-сигналов и вращения колес
                if (this.isBraking || this.state === 'PARKED') {
                    this.matTaillight.color.setHex(0xff0000);
                    this.matTaillight.emissive.setHex(0xff2222);
                } else if (nightFactor > 0.35) {
                    this.matTaillight.color.setHex(0xaa0000);
                    this.matTaillight.emissive.setHex(0x550000);
                } else {
                    this.matTaillight.color.setHex(0x660000);
                    this.matTaillight.emissive.setHex(0x220000);
                }

                if (nightFactor > 0.35) {
                    this.matHeadlight.emissive.setHex(0xfffaea);
                } else {
                    this.matHeadlight.emissive.setHex(0x000000);
                }

                // Вращение и поворот передних колес
                const wheelSpin = (this.currentSpeed / 0.36) * deltaTime;
                for (const w of this.wheelMeshes) {
                    w.mesh.rotation.x += wheelSpin;
                    if (w.isFront) {
                        w.mesh.rotation.y = steerAngle;
                    }
                }
            }

            setShadowsEnabled(enabled) {
                if (this.group) {
                    this.group.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = enabled;
                        }
                    });
                }
            }
        }
