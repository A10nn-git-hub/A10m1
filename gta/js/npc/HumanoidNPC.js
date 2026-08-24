/**
         * Класс NPC с Behavior Tree, посещением интерьеров, разговорами у кассы, сидением в креслах и прислонением к стенам
         */
        class HumanoidNPC {
            constructor(scene, world, physicsMaterials, startPos, waypoints, startWaypointIndex = 0, archetypeIndex = 0, isPartner = false) {
                this.scene = scene;
                this.world = world;
                this.physicsMaterials = physicsMaterials;
                this.waypoints = waypoints;
                this.currentWaypointIndex = startWaypointIndex;
                this.archetypeIndex = archetypeIndex;
                this.isPartner = isPartner;

                const isSoccerPair = (archetypeIndex === 4 || archetypeIndex === 5);
                const npcTypes = ['JOGGER', 'PHONE_CALLER', 'SOCCER_PLAYER', 'CASUAL_WALKER'];
                this.npcType = isSoccerPair ? 'SOCCER_PLAYER' : npcTypes[archetypeIndex % npcTypes.length];

                if (this.npcType === 'JOGGER') {
                    const jogPaces = [7.2, 4.8, 6.6, 5.2];
                    this.baseSpeed = jogPaces[archetypeIndex % jogPaces.length];
                    this.state = 'RUNNING';
                } else if (this.npcType === 'SOCCER_PLAYER') {
                    this.baseSpeed = 3.2;
                    this.state = 'SOCCER_ACTIVE';
                } else {
                    const walkPaces = [3.2, 2.7, 1.9, 3.0];
                    this.baseSpeed = walkPaces[archetypeIndex % walkPaces.length];
                    this.state = 'WALKING';
                }

                this.isCrossingRoad = false;
                this.walkCycle = Math.random() * Math.PI * 2;
                this.targetRotation = 0;
                this.stuckTimer = 0;
                this.lastRecordedPos = new CANNON.Vec3(startPos.x, 1.4, startPos.z);

                this.knockedDownTimer = 0.0;
                this.flightTime = 0.0;
                this.isGroundedRagdoll = false;
                this.fallPoseType = 0;
                this.tumbleSpinX = 0;
                this.tumbleSpinY = 0;
                this.tumbleSpinZ = 0;

                this.partnerNPC = null;
                this.soccerBall = null;
                this.kickCooldown = 0.0;
                this.isKickingTurn = !isPartner;

                // STEP 27: Behavior Tree параметры посещения интерьеров
                this.interiorMission = null;
                this.interiorState = 'NONE'; // 'HEADING_TO_ENTRANCE', 'NAVIGATING_INSIDE', 'PERFORMING_ACTION', 'NAVIGATING_OUT'
                this.interiorTimer = 0.0;
                this.interiorWaypointIndex = 0;
                this.decisionCooldown = 8.0 + (archetypeIndex * 3.5) % 18.0;
                this.actionCycle = Math.random() * Math.PI * 2;

                this.group = new THREE.Group();
                this.scene.add(this.group);
                this.limbs = {};
                this.props = {};

                this.buildHumanoidModel(archetypeIndex, startPos);
                this.initPhysics(startPos);
            }

            buildHumanoidModel(archetypeIndex, startPos) {
                const skinColors = [0xf5d0b5, 0xdca17a, 0xb87b56, 0x7c4f35];
                let dId = 'downtown';
                if (startPos && window.gameEngine && window.gameEngine.districtManager) {
                    const d = window.gameEngine.districtManager.getDistrictAt(startPos.x, startPos.z);
                    if (d) dId = d.id;
                }

                const isJogger = this.npcType === 'JOGGER';
                const isSoccer = this.npcType === 'SOCCER_PLAYER';

                let topColor = 0x2c3e50;
                let pantsColor = 0x1e272e;
                let shoesColor = 0x111111;
                let hatType = 'NONE'; // 'HARDHAT', 'COWBOY', 'HEADBAND', 'CAP'

                if (isJogger) {
                    topColor = 0x00e5ff;
                    pantsColor = 0x111111;
                    shoesColor = 0xff3d00;
                    hatType = 'HEADBAND';
                } else if (isSoccer) {
                    topColor = 0xffeb3b;
                    pantsColor = 0x111111;
                    shoesColor = 0x2ecc71;
                } else if (dId === 'richman' || dId === 'downtown') {
                    // Элитный район (костюмы, смокинги, дизайнерские рубашки)
                    const affluentTops = [0x0f172a, 0x1e3a8a, 0xf8fafc, 0x991b1b, 0x475569];
                    const affluentPants = [0x0f172a, 0x334155, 0xf1f5f9, 0x1e293b];
                    topColor = affluentTops[archetypeIndex % affluentTops.length];
                    pantsColor = affluentPants[archetypeIndex % affluentPants.length];
                    shoesColor = 0x09090b; // Черные кожаные туфли
                } else if (dId === 'lapuerta' || dId === 'cypress') {
                    // Индустриальный район / порт (рабочие каски, сигнальные жилеты)
                    const workerTops = [0xeab308, 0xf97316, 0x1e3a8a, 0x3b82f6];
                    const workerPants = [0x334155, 0x1e293b, 0x475569];
                    topColor = workerTops[archetypeIndex % workerTops.length];
                    pantsColor = workerPants[archetypeIndex % workerPants.length];
                    shoesColor = 0x78350f; // Рабочие ботинки
                    hatType = 'HARDHAT';
                } else if (dId === 'senora' || dId === 'grapeseed' || dId === 'chiliad' || dId === 'palomino') {
                    // Сельская местность / пустыня (клетчатые рубашки, ковбойские шляпы)
                    const countryTops = [0xb91c1c, 0x15803d, 0xc2410c, 0xd97706];
                    const countryPants = [0x3b82f6, 0x64748b, 0x78350f];
                    topColor = countryTops[archetypeIndex % countryTops.length];
                    pantsColor = countryPants[archetypeIndex % countryPants.length];
                    shoesColor = 0x451a03;
                    hatType = 'COWBOY';
                } else if (dId === 'pillbox') {
                    // Медицинский персонал
                    topColor = 0x06b6d4; pantsColor = 0xf8fafc; shoesColor = 0xffffff;
                } else if (dId === 'mission_row') {
                    // Полицейские
                    topColor = 0x1e3a8a; pantsColor = 0x0f172a; shoesColor = 0x000000; hatType = 'CAP';
                } else {
                    const topColors = [0x2c3e50, 0xc0392b, 0x2980b9, 0x27ae60, 0xd35400, 0x8e44ad];
                    const pantsColors = [0x1e272e, 0x2f3640, 0x353b48, 0x718093];
                    topColor = topColors[archetypeIndex % topColors.length];
                    pantsColor = pantsColors[archetypeIndex % pantsColors.length];
                }

                const matSkin = new THREE.MeshLambertMaterial({ color: skinColors[archetypeIndex % skinColors.length] });
                const matTop = new THREE.MeshLambertMaterial({ color: topColor });
                const matPants = new THREE.MeshLambertMaterial({ color: pantsColor });
                const matShoes = new THREE.MeshLambertMaterial({ color: shoesColor });
                const matPhone = new THREE.MeshLambertMaterial({ color: 0x15181e });
                const matMouth = new THREE.MeshBasicMaterial({ color: 0x1a0a0a });

                const torsoGroup = new THREE.Group();
                torsoGroup.position.set(0, 1.15, 0);

                const chestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.44, 0.26), matTop);
                chestMesh.position.set(0, 0.08, 0); chestMesh.castShadow = true;
                torsoGroup.add(chestMesh);

                this.group.add(torsoGroup);
                this.limbs.torso = torsoGroup;

                const headGroup = new THREE.Group();
                headGroup.position.set(0, 0.36, 0);
                const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.24), matSkin);
                headMesh.position.set(0, 0.15, 0); headMesh.castShadow = true;
                headGroup.add(headMesh);

                const mouthMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.02), matMouth);
                mouthMesh.position.set(0, 0.07, 0.13);
                headGroup.add(mouthMesh);
                this.props.mouth = mouthMesh;

                // Аксессуары на голове в зависимости от района и профессии
                if (hatType === 'HEADBAND') {
                    const headband = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.26), new THREE.MeshLambertMaterial({ color: 0xff3d00 }));
                    headband.position.set(0, 0.22, 0);
                    headGroup.add(headband);
                } else if (hatType === 'HARDHAT') {
                    const matHelmet = new THREE.MeshLambertMaterial({ color: 0xfacc15 });
                    const helmetDome = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.1, 12), matHelmet);
                    helmetDome.position.set(0, 0.31, 0);
                    const helmetBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.02, 12), matHelmet);
                    helmetBrim.position.set(0, 0.26, 0);
                    headGroup.add(helmetDome);
                    headGroup.add(helmetBrim);
                } else if (hatType === 'COWBOY') {
                    const matCowboy = new THREE.MeshLambertMaterial({ color: 0x854d0e });
                    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.12, 10), matCowboy);
                    crown.position.set(0, 0.32, 0);
                    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.02, 10), matCowboy);
                    brim.position.set(0, 0.26, 0);
                    headGroup.add(crown);
                    headGroup.add(brim);
                } else if (hatType === 'CAP') {
                    const matCap = new THREE.MeshLambertMaterial({ color: 0x0f172a });
                    const capDome = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.08, 12), matCap);
                    capDome.position.set(0, 0.30, 0);
                    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.12), matCap);
                    visor.position.set(0, 0.26, 0.13);
                    headGroup.add(capDome);
                    headGroup.add(visor);
                }

                torsoGroup.add(headGroup);
                this.limbs.head = headGroup;

                const createArm = (isLeft) => {
                    const side = isLeft ? 1 : -1;
                    const armPivot = new THREE.Group();
                    armPivot.position.set(side * 0.3, 0.24, 0);
                    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.26, 0.15), matTop);
                    shoulder.position.set(0, -0.11, 0); shoulder.castShadow = true;
                    armPivot.add(shoulder);

                    const forearm = new THREE.Group();
                    forearm.position.set(0, -0.24, 0);
                    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.25, 0.12), matSkin);
                    hand.position.set(0, -0.11, 0); hand.castShadow = true;
                    forearm.add(hand);

                    if (!isLeft) {
                        // 1. Смартфон
                        const handPhoneMesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.09), matPhone);
                        handPhoneMesh.position.set(0, -0.24, 0.06);
                        handPhoneMesh.visible = (this.npcType === 'PHONE_CALLER');
                        forearm.add(handPhoneMesh);
                        this.props.phone = handPhoneMesh;

                        // 2. Газета Los Santos Chronicle
                        const matNewspaper = new THREE.MeshLambertMaterial({
                            map: ProceduralTextureFactory.createNewspaperTexture(),
                            side: THREE.DoubleSide
                        });
                        const newsMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.32), matNewspaper);
                        newsMesh.position.set(0.16, -0.22, 0.26);
                        newsMesh.rotation.set(-0.35, 0, 0);
                        newsMesh.visible = false;
                        forearm.add(newsMesh);
                        this.props.newspaper = newsMesh;

                        // 3. Раскрытая книга в переплете
                        const bookGroup = new THREE.Group();
                        const matBook = new THREE.MeshLambertMaterial({
                            map: ProceduralTextureFactory.createBookTexture(),
                            side: THREE.DoubleSide
                        });
                        const coverL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.02), matBook);
                        coverL.position.set(-0.08, 0, 0); coverL.rotation.y = 0.25;
                        const coverR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.02), matBook);
                        coverR.position.set(0.08, 0, 0); coverR.rotation.y = -0.25;
                        bookGroup.add(coverL); bookGroup.add(coverR);
                        bookGroup.position.set(0.14, -0.20, 0.24);
                        bookGroup.rotation.set(-0.55, 0, 0);
                        bookGroup.visible = false;
                        forearm.add(bookGroup);
                        this.props.book = bookGroup;

                        // 4. Стаканчик кофе с крышкой и манжетой
                        const coffeeGroup = new THREE.Group();
                        const matCoffee = new THREE.MeshLambertMaterial({ map: ProceduralTextureFactory.createCoffeeCupTexture() });
                        const cupMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.12, 10), matCoffee);
                        const lidMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.02, 10), new THREE.MeshLambertMaterial({ color: 0x1e293b }));
                        lidMesh.position.y = 0.065;
                        coffeeGroup.add(cupMesh); coffeeGroup.add(lidMesh);
                        coffeeGroup.position.set(0, -0.22, 0.08);
                        coffeeGroup.rotation.set(0.2, 0, 0);
                        coffeeGroup.visible = false;
                        forearm.add(coffeeGroup);
                        this.props.coffeeCup = coffeeGroup;

                        // 5. Полицейский планшет / папка отчетов
                        const clipMesh = new THREE.Mesh(
                            new THREE.BoxGeometry(0.18, 0.26, 0.02),
                            new THREE.MeshLambertMaterial({ map: ProceduralTextureFactory.createClipboardTexture() })
                        );
                        clipMesh.position.set(0, -0.20, 0.12);
                        clipMesh.rotation.set(-0.4, 0, 0);
                        clipMesh.visible = false;
                        forearm.add(clipMesh);
                        this.props.clipboard = clipMesh;
                    }

                    armPivot.add(forearm);
                    torsoGroup.add(armPivot);
                    return { pivot: armPivot, forearm };
                };

                this.limbs.leftArm = createArm(true);
                this.limbs.rightArm = createArm(false);

                // 6. Мяч для чеканки и набивания под навесом
                const juggleBall = new THREE.Mesh(
                    new THREE.SphereGeometry(0.22, 16, 16),
                    new THREE.MeshLambertMaterial({ map: ProceduralTextureFactory.createSoccerBallTexture() })
                );
                juggleBall.position.set(0, 0.4, 0.45);
                juggleBall.visible = false;
                this.group.add(juggleBall);
                this.props.jugglingBall = juggleBall;

                const createLeg = (isLeft) => {
                    const side = isLeft ? 1 : -1;
                    const hipPivot = new THREE.Group();
                    hipPivot.position.set(side * 0.13, 0.88, 0);
                    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.4, 0.19), matPants);
                    thigh.position.set(0, -0.19, 0); thigh.castShadow = true;
                    hipPivot.add(thigh);

                    const knee = new THREE.Group();
                    knee.position.set(0, -0.4, 0);
                    const calf = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.38, 0.17), matPants);
                    calf.position.set(0, -0.17, 0); calf.castShadow = true;
                    knee.add(calf);

                    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.11, 0.26), matShoes);
                    shoe.position.set(0, -0.36, 0.03); shoe.castShadow = true;
                    knee.add(shoe);

                    hipPivot.add(knee);
                    this.group.add(hipPivot);
                    return { pivot: hipPivot, knee };
                };

                this.limbs.leftLeg = createLeg(true);
                this.limbs.rightLeg = createLeg(false);
            }

            initPhysics(pos) {
                const radius = 0.34;
                const height = 0.95;
                this.body = new CANNON.Body({
                    mass: 65,
                    material: this.physicsMaterials.player,
                    position: new CANNON.Vec3(pos.x, 1.4, pos.z),
                    linearDamping: 0.0,
                    fixedRotation: true
                });

                const cylinderShape = new CANNON.Cylinder(radius, radius, height, 12);
                const qCyl = new CANNON.Quaternion();
                qCyl.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
                this.body.addShape(cylinderShape, new CANNON.Vec3(0, 0, 0), qCyl);
                this.body.addShape(new CANNON.Sphere(radius), new CANNON.Vec3(0, height / 2, 0));
                this.body.addShape(new CANNON.Sphere(radius), new CANNON.Vec3(0, -height / 2, 0));

                this.world.addBody(this.body);
            }

            takeDamage(amount) {
                this.hp = (this.hp !== undefined ? this.hp : 60) - amount;
                this.state = 'KNOCKED_DOWN';
                this.knockedDownTimer = 3.8;

                if (this.hp <= 0) {
                    if (window.gameEngine && window.gameEngine.wantedManager) {
                        window.gameEngine.wantedManager.reportCrime('KILL_CIVILIAN');
                    }
                    if (window.gameEngine && window.gameEngine.playerController) {
                        const loot = 200 + Math.floor(Math.random() * 350);
                        window.gameEngine.playerController.addMoney(loot);
                        if (window.soundEngine && typeof window.soundEngine.playCashPickup === 'function') {
                            window.soundEngine.playCashPickup();
                        }
                    }
                    this.hp = 60;
                }
            }

            hitByVehicle(car) {
                this.state = 'KNOCKED_DOWN';
                this.knockedDownTimer = 3.2; // 3.2 секунды на падение, лежание и подъем
                this.flightTime = 0.0;
                this.isGroundedRagdoll = false;
                this.fallPoseType = Math.floor(Math.random() * 3);

                const carVel = (car && car.chassisBody) ? car.chassisBody.velocity : new CANNON.Vec3(0, 0, 0);
                const carSpeedH = Math.hypot(carVel.x, carVel.z);
                const dirX = carVel.x / (carSpeedH || 1);
                const dirZ = carVel.z / (carSpeedH || 1);

                const launchSpeedH = Math.min(8.0, Math.max(3.0, carSpeedH * 0.6));

                this.body.velocity.x = dirX * launchSpeedH;
                this.body.velocity.z = dirZ * launchSpeedH;
                this.body.velocity.y = 1.2;
            }

            update(deltaTime, playerPos, allNPCs, soccerBalls, drivenCar, allCars) {
                if (!this.body) return;

                const isSidewalk = (Math.abs(this.body.position.x) >= 8.0 || Math.abs(this.body.position.z) >= 8.0);
                const surfaceY = isSidewalk ? 0.22 : 0.02;

                if (this.state === 'KNOCKED_DOWN' || this.knockedDownTimer > 0) {
                    this.knockedDownTimer -= deltaTime;

                    if (this.knockedDownTimer > 1.2) {
                        // 1. Падение и лежание ровно на поверхности пола (без вращений сквозь пол)
                        this.body.velocity.x *= 0.85;
                        this.body.velocity.z *= 0.85;
                        this.body.velocity.y = 0;
                        this.body.position.y = surfaceY + 0.70;

                        this.group.position.set(this.body.position.x, surfaceY, this.body.position.z);
                        this.group.rotation.set(-Math.PI / 2, 0, this.targetRotation);
                        this.limbs.torso.position.set(0, 0.22, 0);
                        this.limbs.leftArm.pivot.rotation.set(0, 0, 1.2);
                        this.limbs.rightArm.pivot.rotation.set(0, 0, -1.2);
                        this.limbs.leftLeg.pivot.rotation.x = 0.1;
                        this.limbs.rightLeg.pivot.rotation.x = -0.1;
                        this.limbs.leftLeg.knee.rotation.x = 0.2;
                        this.limbs.rightLeg.knee.rotation.x = 0.2;
                        this.limbs.head.rotation.set(0, 0.2, 0.1);
                        if (this.props.mouth) this.props.mouth.scale.set(1.3, 2.2, 1);
                    } else if (this.knockedDownTimer > 0) {
                        // 2. Плавный подъем на ноги
                        const p = (1.2 - this.knockedDownTimer) / 1.2;
                        this.body.position.y = surfaceY + 0.70;
                        this.group.position.set(this.body.position.x, surfaceY, this.body.position.z);
                        this.group.rotation.set(THREE.MathUtils.lerp(-Math.PI / 2, 0, p), 0, this.targetRotation);
                        this.limbs.torso.position.y = THREE.MathUtils.lerp(0.22, 1.15, p);
                        this.limbs.leftArm.pivot.rotation.set(0, 0, 0);
                        this.limbs.rightArm.pivot.rotation.set(0, 0, 0);
                        this.limbs.leftLeg.pivot.rotation.x = 0;
                        this.limbs.rightLeg.pivot.rotation.x = 0;
                        this.limbs.leftLeg.knee.rotation.x = 0;
                        this.limbs.rightLeg.knee.rotation.x = 0;
                        this.limbs.head.rotation.set(0, 0, 0);
                        if (this.props.mouth) this.props.mouth.scale.set(1.0, 1.0, 1.0);
                    } else {
                        // 3. Полное возрождение и восстановление ходьбы
                        this.state = this.npcType === 'JOGGER' ? 'RUNNING' : 'WALKING';
                        this.body.position.y = surfaceY + 0.70;
                        this.body.velocity.set(0, 0, 0);
                        this.group.position.set(this.body.position.x, surfaceY, this.body.position.z);
                        this.group.rotation.set(0, this.targetRotation, 0);
                        this.limbs.torso.position.set(0, 1.15, 0);
                        this.limbs.leftArm.pivot.rotation.set(0, 0, 0);
                        this.limbs.rightArm.pivot.rotation.set(0, 0, 0);
                        this.limbs.leftLeg.pivot.rotation.set(0, 0, 0);
                        this.limbs.rightLeg.pivot.rotation.set(0, 0, 0);
                        this.limbs.leftLeg.knee.rotation.set(0, 0, 0);
                        this.limbs.rightLeg.knee.rotation.set(0, 0, 0);
                        if (this.props.mouth) this.props.mouth.scale.set(1.0, 1.0, 1.0);
                    }
                    return;
                }

                let isPanicking = false;
                if (drivenCar) {
                    const cPos = drivenCar.chassisBody.position;
                    const cVel = drivenCar.chassisBody.velocity;
                    const cSpeedH = Math.hypot(cVel.x, cVel.z);
                    const cSpeedKmh = cSpeedH * 3.6;

                    const carQuat = drivenCar.carGroup ? drivenCar.carGroup.quaternion : drivenCar.chassisBody.quaternion;
                    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(carQuat);
                    const rgt = new THREE.Vector3(1, 0, 0).applyQuaternion(carQuat);

                    const hitPoints = [
                        cPos,
                        new THREE.Vector3(cPos.x + fwd.x * 2.2, cPos.y, cPos.z + fwd.z * 2.2),
                        new THREE.Vector3(cPos.x + fwd.x * 2.2 - rgt.x * 0.9, cPos.y, cPos.z + fwd.z * 2.2 - rgt.z * 0.9),
                        new THREE.Vector3(cPos.x + fwd.x * 2.2 + rgt.x * 0.9, cPos.y, cPos.z + fwd.z * 2.2 + rgt.z * 0.9),
                        new THREE.Vector3(cPos.x + fwd.x * 1.1, cPos.y, cPos.z + fwd.z * 1.1)
                    ];

                    let isPedHit = false;
                    for (let hp = 0; hp < hitPoints.length; hp++) {
                        const pt = hitPoints[hp];
                        const dSq = (pt.x - this.body.position.x) * (pt.x - this.body.position.x) + (pt.z - this.body.position.z) * (pt.z - this.body.position.z);
                        if (dSq < 1.35 * 1.35) {
                            isPedHit = true;
                            break;
                        }
                    }

                    if (isPedHit && cSpeedKmh > 7.0) {
                        this.hitByVehicle(drivenCar);
                        return;
                    }

                    const dx = this.body.position.x - cPos.x;
                    const dz = this.body.position.z - cPos.z;
                    const distToCar = Math.hypot(dx, dz);

                    if (cSpeedKmh > 10.0 && distToCar < 18.0) {
                        const dotMove = (cVel.x * dx + cVel.z * dz) / (cSpeedH * distToCar);

                        if (dotMove > 0.42) {
                            isPanicking = true;
                            this.targetRotation = Math.atan2(-dx, -dz);
                        }
                    }
                }

                let moveX = 0; let moveZ = 0;
                let currentTargetSpeed = this.baseSpeed;

                if (isPanicking) {
                    this.state = 'PANIC';
                    this.walkCycle += deltaTime * 18.0;

                    if (this.props.mouth) this.props.mouth.scale.set(1.5, 3.5, 1);
                    this.limbs.torso.rotation.x = -0.25;

                    const waveSin = Math.sin(this.walkCycle);
                    this.limbs.leftArm.pivot.rotation.set(-2.2 + waveSin * 0.7, 0, 0.4);
                    this.limbs.rightArm.pivot.rotation.set(-2.2 - waveSin * 0.7, 0, -0.4);
                    this.limbs.leftArm.forearm.rotation.set(0.6, 0, 0);
                    this.limbs.rightArm.forearm.rotation.set(0.6, 0, 0);

                    this.body.velocity.x = 0;
                    this.body.velocity.z = 0;
                } else {
                    if (this.props.mouth) this.props.mouth.scale.set(1.0, 1.0, 1.0);

                    if (this.npcType === 'SOCCER_PLAYER' && this.soccerBall && this.partnerNPC) {
                        const ballPos = this.soccerBall.body.position;
                        const distToBall = Math.hypot(this.body.position.x - ballPos.x, this.body.position.z - ballPos.z);
                        const partnerPos = this.partnerNPC.body.position;
                        const distToPartner = Math.hypot(partnerPos.x - this.body.position.x, partnerPos.z - this.body.position.z) || 1;
                        const partnerDistToBall = Math.hypot(this.partnerNPC.body.position.x - ballPos.x, this.partnerNPC.body.position.z - ballPos.z);

                        if (this.kickCooldown > 0) this.kickCooldown -= deltaTime;

                        const isMyBall = (distToBall <= partnerDistToBall + 0.3) || this.isKickingTurn;

                        if (isMyBall) {
                            const dx = ballPos.x - this.body.position.x;
                            const dz = ballPos.z - this.body.position.z;
                            const d = Math.hypot(dx, dz) || 1;
                            this.targetRotation = Math.atan2(dx, dz);

                            if (distToBall > 0.85) {
                                moveX = (dx / d) * 3.6;
                                moveZ = (dz / d) * 3.6;
                            } else {
                                moveX = 0; moveZ = 0;
                                if (this.kickCooldown <= 0) {
                                    const dirToPartnerX = partnerPos.x - ballPos.x;
                                    const dirToPartnerZ = partnerPos.z - ballPos.z;
                                    const kickPower = Math.min(10.5, Math.max(5.5, distToPartner * 1.3));
                                    this.soccerBall.kick(dirToPartnerX, 3.2, dirToPartnerZ, kickPower);
                                    this.kickCooldown = 1.8;
                                    this.isKickingTurn = false;
                                    this.partnerNPC.isKickingTurn = true;
                                    this.partnerNPC.kickCooldown = 0.5;

                                    this.limbs.rightLeg.pivot.rotation.x = 1.2;
                                    this.limbs.rightLeg.knee.rotation.x = 0.8;
                                }
                            }
                        } else {
                            this.targetRotation = Math.atan2(ballPos.x - this.body.position.x, ballPos.z - this.body.position.z);
                            moveX = 0; moveZ = 0;
                            if (this.kickCooldown <= 0.3) {
                                this.limbs.rightLeg.pivot.rotation.x = 0;
                                this.limbs.rightLeg.knee.rotation.x = 0;
                            }
                        }
                    } else {
                        const isRaining = window.gameEngine && window.gameEngine.weatherManager && window.gameEngine.weatherManager.rainIntensity > 0.15;

                        // При дожде боты НЕ идут упираться в стены зданий, а просто ускоряют шаг по тротуару
                        if (isRaining && this.state !== 'KNOCKED_DOWN') {
                            currentTargetSpeed = (this.archetypeIndex % 2 === 1) ? 6.5 : 4.8;
                        }
                        if (this.interiorState !== 'NONE' && this.interiorMission) {
                            let targetX = 0;
                            let targetZ = 0;

                            if (this.interiorState === 'HEADING_TO_ENTRANCE') {
                                if (!isRaining) currentTargetSpeed = 2.8;
                                targetX = this.interiorMission.entrance.x;
                                targetZ = this.interiorMission.entrance.z;
                                const dEnt = Math.hypot(targetX - this.body.position.x, targetZ - this.body.position.z);
                                if (dEnt < 1.4) {
                                    this.interiorState = 'NAVIGATING_INSIDE';
                                    this.interiorWaypointIndex = 0;
                                }
                            } else if (this.interiorState === 'NAVIGATING_INSIDE') {
                                currentTargetSpeed = 2.2;
                                const wp = this.interiorMission.indoorWaypoints[this.interiorWaypointIndex];
                                targetX = wp.x;
                                targetZ = wp.z;
                                const dWp = Math.hypot(targetX - this.body.position.x, targetZ - this.body.position.z);
                                if (dWp < 0.9) {
                                    this.interiorWaypointIndex++;
                                    if (this.interiorWaypointIndex >= this.interiorMission.indoorWaypoints.length) {
                                        this.interiorState = 'PERFORMING_ACTION';
                                        this.interiorTimer = this.interiorMission.duration;
                                    }
                                }
                            } else if (this.interiorState === 'NAVIGATING_OUT') {
                                currentTargetSpeed = 2.4;
                                const wp = this.interiorMission.exitWaypoints[this.interiorWaypointIndex];
                                targetX = wp.x;
                                targetZ = wp.z;
                                const dExit = Math.hypot(targetX - this.body.position.x, targetZ - this.body.position.z);
                                if (dExit < 1.3) {
                                    this.interiorWaypointIndex++;
                                    if (this.interiorWaypointIndex >= this.interiorMission.exitWaypoints.length) {
                                        this.interiorState = 'NONE';
                                        this.interiorMission = null;
                                        this.decisionCooldown = 32.0 + Math.random() * 28.0;
                                    }
                                }
                            }

                            if (this.interiorState === 'PERFORMING_ACTION') {
                                moveX = 0; moveZ = 0;
                                this.targetRotation = this.interiorMission.targetRotation;
                                this.actionCycle += deltaTime * 2.2;
                                this.interiorTimer -= deltaTime;

                                if (this.interiorTimer <= 0) {
                                    this.limbs.torso.position.y = 1.15;
                                    this.limbs.torso.rotation.set(0, 0, 0);
                                    this.limbs.leftLeg.pivot.rotation.set(0, 0, 0);
                                    this.limbs.rightLeg.pivot.rotation.set(0, 0, 0);
                                    this.limbs.leftLeg.knee.rotation.set(0, 0, 0);
                                    this.limbs.rightLeg.knee.rotation.set(0, 0, 0);
                                    this.limbs.leftArm.pivot.rotation.set(0, 0, 0);
                                    this.limbs.rightArm.pivot.rotation.set(0, 0, 0);

                                    this.interiorState = 'NAVIGATING_OUT';
                                    this.interiorWaypointIndex = 0;
                                }
                            } else {
                                const dx = targetX - this.body.position.x;
                                const dz = targetZ - this.body.position.z;
                                const d = Math.hypot(dx, dz) || 1;
                                moveX = (dx / d) * currentTargetSpeed;
                                moveZ = (dz / d) * currentTargetSpeed;
                            }
                        } else if (this.waypoints && this.waypoints.length > 0) {
                            const target = this.waypoints[this.currentWaypointIndex];
                            const dx = target.x - this.body.position.x;
                            const dz = target.z - this.body.position.z;
                            const dist = Math.hypot(dx, dz);

                            this.isCrossingRoad = !!target.isCrosswalk;

                            if (this.isCrossingRoad) {
                                currentTargetSpeed = 7.4;
                            }

                            if (dist < 1.5) {
                                this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
                                this.stuckTimer = 0;
                            } else {
                                moveX = (dx / dist) * currentTargetSpeed;
                                moveZ = (dz / dist) * currentTargetSpeed;
                            }

                            const movedDist = Math.hypot(this.body.position.x - this.lastRecordedPos.x, this.body.position.z - this.lastRecordedPos.z);
                            if (movedDist < 0.2) {
                                this.stuckTimer += deltaTime;
                                if (this.stuckTimer > 0.8) {
                                    this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
                                    this.stuckTimer = 0;
                                }
                            } else {
                                this.stuckTimer = 0;
                                this.lastRecordedPos.copy(this.body.position);
                            }
                        }
                    }

                    let isEvadingObstacle = false;

                    if (allCars && this.npcType !== 'SOCCER_PLAYER' && this.interiorState === 'NONE') {
                        for (let i = 0; i < allCars.length; i++) {
                            const car = allCars[i];
                            if (!car || !car.chassisBody) continue;
                            const cPos = car.chassisBody.position;
                            const cdx = this.body.position.x - cPos.x;
                            const cdz = this.body.position.z - cPos.z;
                            if (Math.abs(cdx) > 6.5 || Math.abs(cdz) > 6.5) continue;
                            const cdist = Math.hypot(cdx, cdz);

                            if (cdist < 6.5 && cdist > 0.05) {
                                isEvadingObstacle = true;
                                const repFactor = (6.5 - cdist) / 6.5;
                                const repX = cdx / cdist;
                                const repZ = cdz / cdist;
                                const sideSign = (cdx * (-repZ) + cdz * repX >= 0) ? 1.0 : -1.0;
                                const tangentX = -repZ * sideSign;
                                const tangentZ = repX * sideSign;

                                moveX += (repX * 3.5 + tangentX * 5.2) * repFactor;
                                moveZ += (repZ * 3.5 + tangentZ * 5.2) * repFactor;
                                currentTargetSpeed = Math.max(currentTargetSpeed, 6.8);
                            }
                        }
                    }

                    if (allNPCs && this.npcType !== 'SOCCER_PLAYER') {
                        for (let i = 0; i < allNPCs.length; i++) {
                            const other = allNPCs[i];
                            if (other === this || !other.body) continue;
                            const ox = this.body.position.x - other.body.position.x;
                            const oz = this.body.position.z - other.body.position.z;
                            if (Math.abs(ox) > 2.0 || Math.abs(oz) > 2.0) continue;
                            const odist = Math.hypot(ox, oz);
                            if (odist < 2.0 && odist > 0.01) {
                                const rep = (2.0 - odist) / 2.0;
                                moveX += (ox / odist) * rep * 2.5 - (oz / odist) * rep * 1.5;
                                moveZ += (oz / odist) * rep * 2.5 + (ox / odist) * rep * 1.5;
                            }
                        }
                    }

                    if (playerPos && this.npcType !== 'SOCCER_PLAYER' && this.interiorState === 'NONE') {
                        const px = this.body.position.x - playerPos.x;
                        const pz = this.body.position.z - playerPos.z;
                        if (Math.abs(px) <= 3.8 && Math.abs(pz) <= 3.8) {
                            const pdist = Math.hypot(px, pz);
                            if (pdist < 3.8 && pdist > 0.01) {
                                isEvadingObstacle = true;
                                const rep = (3.8 - pdist) / 3.8;
                                const repX = px / pdist;
                                const repZ = pz / pdist;
                                const tangentX = -repZ;
                                const tangentZ = repX;

                                moveX += (repX * 3.0 + tangentX * 3.8) * rep;
                                moveZ += (repZ * 3.0 + tangentZ * 3.8) * rep;
                                currentTargetSpeed = Math.max(currentTargetSpeed, 5.0);
                            }
                        }
                    }

                    if (Math.abs(moveX) > 0.01 || Math.abs(moveZ) > 0.01) {
                        this.body.velocity.x = moveX;
                        this.body.velocity.z = moveZ;
                        this.targetRotation = Math.atan2(moveX, moveZ);
                    } else {
                        this.body.velocity.x = 0;
                        this.body.velocity.z = 0;
                    }

                    const currentSpeed = Math.hypot(this.body.velocity.x, this.body.velocity.z);
                    const isRunningFast = currentSpeed > 4.2 || isEvadingObstacle;
                    const isRunning = (this.npcType === 'JOGGER' || this.isCrossingRoad || isRunningFast) && currentSpeed > 1.8;

                    this.walkCycle += deltaTime * (isRunning ? (currentTargetSpeed * 2.2) : (currentSpeed * 2.8 + 1.2));
                    const sinP = Math.sin(this.walkCycle);
                    const w = (currentSpeed > 0.15 || isRunning) ? 1.0 : 0.0;

                    if (this.interiorState === 'PERFORMING_ACTION') {
                        const act = this.interiorMission.actionType;
                        if (act === 'BANK_TALK' || act === 'POLICE_REPORT') {
                            this.limbs.torso.position.y = 1.15;
                            this.limbs.torso.rotation.set(0, 0, 0);
                            this.limbs.leftLeg.pivot.rotation.set(0, 0, 0);
                            this.limbs.rightLeg.pivot.rotation.set(0, 0, 0);
                            this.limbs.leftLeg.knee.rotation.set(0, 0, 0);
                            this.limbs.rightLeg.knee.rotation.set(0, 0, 0);

                            this.limbs.rightArm.pivot.rotation.set(-1.0 + Math.sin(this.actionCycle * 1.6) * 0.35, 0.2, 0.35);
                            this.limbs.rightArm.forearm.rotation.set(-0.75 + Math.cos(this.actionCycle * 2.2) * 0.35, 0, 0);
                            this.limbs.leftArm.pivot.rotation.set(-0.35 + Math.sin(this.actionCycle * 0.9) * 0.2, 0, 0.15);
                            this.limbs.head.rotation.set(Math.sin(this.actionCycle * 1.8) * 0.14, Math.cos(this.actionCycle * 0.8) * 0.22, 0);
                            if (this.props.mouth) this.props.mouth.scale.set(1.0, 1.0 + Math.abs(Math.sin(this.actionCycle * 3.2)) * 1.4, 1);
                        } else if (act === 'HOSPITAL_SIT') {
                            this.limbs.torso.position.y = 0.62;
                            this.limbs.torso.rotation.set(0.06, 0, 0);
                            this.limbs.leftLeg.pivot.rotation.x = -1.55;
                            this.limbs.rightLeg.pivot.rotation.x = -1.55;
                            this.limbs.leftLeg.knee.rotation.x = 1.55;
                            this.limbs.rightLeg.knee.rotation.x = 1.55;
                            this.limbs.leftArm.pivot.rotation.set(-0.55, 0, 0.25);
                            this.limbs.rightArm.pivot.rotation.set(-0.55, 0, -0.25);
                            this.limbs.head.rotation.set(0, Math.sin(this.actionCycle * 0.6) * 0.28, 0);
                            if (this.props.mouth) this.props.mouth.scale.set(1.0, 1.0, 1.0);
                        } else if (act === 'POLICE_LEAN') {
                            this.limbs.torso.position.y = 1.12;
                            this.limbs.torso.rotation.x = -0.15;
                            this.limbs.leftArm.pivot.rotation.set(-1.15, 0.45, 0.75);
                            this.limbs.leftArm.forearm.rotation.set(-0.7, 0.3, 0);
                            this.limbs.rightArm.pivot.rotation.set(-1.15, -0.45, -0.75);
                            this.limbs.rightArm.forearm.rotation.set(-0.7, -0.3, 0);
                            this.limbs.leftLeg.pivot.rotation.x = -0.35;
                            this.limbs.leftLeg.knee.rotation.x = 0.55;
                            this.limbs.rightLeg.pivot.rotation.x = -0.05;
                            this.limbs.rightLeg.knee.rotation.x = 0.05;
                            this.limbs.head.rotation.set(0.08, Math.sin(this.actionCycle * 0.5) * 0.3, 0);
                            if (this.props.mouth) this.props.mouth.scale.set(1.0, 1.0, 1.0);
                        }
                    } else if (this.npcType === 'PHONE_CALLER') {
                        this.limbs.rightArm.pivot.rotation.set(-1.25, 0.15, 0.45);
                        this.limbs.rightArm.forearm.rotation.set(-1.55, 0.25, 0.35);
                        this.limbs.head.rotation.set(0, -0.12, 0.18);

                        this.limbs.leftArm.pivot.rotation.x = -sinP * 0.4 * w;
                        this.limbs.torso.position.y = 1.15 + Math.abs(Math.cos(this.walkCycle)) * 0.03 * w;
                        this.limbs.leftLeg.pivot.rotation.x = sinP * 0.65 * w;
                        this.limbs.rightLeg.pivot.rotation.x = -sinP * 0.65 * w;
                        this.limbs.leftLeg.knee.rotation.x = Math.max(0.02, -sinP * 0.75) * w;
                        this.limbs.rightLeg.knee.rotation.x = Math.max(0.02, sinP * 0.75) * w;
                    } else if (this.npcType === 'SOCCER_PLAYER') {
                        if (this.kickCooldown <= 0.3) {
                            this.limbs.rightLeg.pivot.rotation.x = 0.0;
                            this.limbs.rightLeg.knee.rotation.x = 0.0;
                        }
                    } else {
                        this.limbs.torso.position.y = 1.15 + Math.abs(Math.cos(this.walkCycle)) * (isRunning ? 0.09 : 0.03) * w;
                        this.limbs.torso.rotation.x = isRunning ? 0.24 : 0.05;
                        this.limbs.leftArm.pivot.rotation.x = -sinP * (isRunning ? 1.3 : 0.65) * w;
                        
                        const isRainingNow = window.gameEngine && window.gameEngine.weatherManager && window.gameEngine.weatherManager.rainIntensity > 0.15;
                        const isLightJogger = (this.archetypeIndex % 2 === 0);
                        if (isRainingNow && isLightJogger && this.interiorState === 'HEADING_TO_ENTRANCE') {
                            this.limbs.rightArm.pivot.rotation.set(-2.1, 0.35, 0.45);
                            this.limbs.rightArm.forearm.rotation.set(-1.1, 0, 0);
                        } else {
                            this.limbs.rightArm.pivot.rotation.x = sinP * (isRunning ? 1.3 : 0.65) * w;
                            this.limbs.rightArm.forearm.rotation.set(0, 0, 0);
                        }

                        this.limbs.leftLeg.pivot.rotation.x = sinP * (isRunning ? 1.25 : 0.75) * w;
                        this.limbs.rightLeg.pivot.rotation.x = -sinP * (isRunning ? 1.25 : 0.75) * w;
                        this.limbs.leftLeg.knee.rotation.x = Math.max(0.02, -sinP * (isRunning ? 1.45 : 0.95)) * w;
                        this.limbs.rightLeg.knee.rotation.x = Math.max(0.02, sinP * (isRunning ? 1.45 : 0.95)) * w;
                    }

                    if (window.soundEngine && currentSpeed > 0.4 && this.state !== 'KNOCKED_DOWN' && this.state !== 'PANIC') {
                        const phase = Math.sin(this.walkCycle) > 0;
                        if (this.lastStepPhase === undefined) this.lastStepPhase = phase;
                        if (phase !== this.lastStepPhase) {
                            this.lastStepPhase = phase;
                            const isIndoor = (this.interiorState === 'NAVIGATING_INSIDE' || this.interiorState === 'PERFORMING_ACTION');
                            const isOnDirt = (window.gameEngine && window.gameEngine.roadNetwork)
                                ? window.gameEngine.roadNetwork.isPositionOnDirt(this.body.position.x, this.body.position.z)
                                : (Math.hypot(this.body.position.x, this.body.position.z) > 150.0);
                            const surfaceType = isIndoor ? 'indoor' : (isOnDirt ? 'grass' : 'default');
                            window.soundEngine.playFootstep(this.body.position.x, this.body.position.y, this.body.position.z, isIndoor, isRunning ? 0.75 : 0.5, surfaceType);
                        }
                    }

                    if (this.interiorState === 'PERFORMING_ACTION' && window.soundEngine && Math.random() < 0.03) {
                        window.soundEngine.playRustle(this.body.position.x, this.body.position.y, this.body.position.z, 0.45);
                    }
                }

                this.group.position.set(
                    this.body.position.x,
                    this.body.position.y - 0.70,
                    this.body.position.z
                );

                let rotDiff = this.targetRotation - this.group.rotation.y;
                while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
                while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
                this.group.rotation.y += rotDiff * Math.min(deltaTime * 12.0, 1.0);
            }

            takeDamage(amount) {
                if (this.isDead) return;
                this.health = (this.health !== undefined) ? this.health - amount : (60 - amount);
                this.state = 'KNOCKED_DOWN';
                this.knockedDownTimer = 4.5;

                // Оповещение полиции об атаке / убийстве гражданина
                if (this.health <= 0) {
                    this.isDead = true;
                    if (window.gameEngine && window.gameEngine.wantedManager) {
                        window.gameEngine.wantedManager.reportCrime('KILL_CIVILIAN', this.body ? this.body.position : null);
                    }
                    if (window.gameEngine && window.gameEngine.playerController) {
                        window.gameEngine.playerController.addMoney(150 + Math.floor(Math.random() * 200));
                    }
                } else {
                    if (window.gameEngine && window.gameEngine.wantedManager) {
                        window.gameEngine.wantedManager.reportCrime('PUNCH', this.body ? this.body.position : null);
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
