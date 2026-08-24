/**
         * STEP 28 & 29: Полнофункциональная интерактивная система лифта небоскреба Maze Bank Tower
         * Сплошная физическая шахта (вход только с 1 стороны), этажные лобби со сплошными коллизиями для всех 10 этажей,
         * синхронные автоматические двери и автоматический зум камеры.
         */
        class SkyscraperElevatorSystem {
            constructor(scene, world, physicsMaterials) {
                this.scene = scene;
                this.world = world;
                this.physicsMaterials = physicsMaterials;

                this.audioSynth = new ElevatorAudioSynth();

                // Позиция грандиозной шахты лифта в Maze Bank
                this.shaftX = -3.5;
                this.shaftZ = 60.0;

                // 10 полноценных этажей со строго выверенными высотами
                this.floors = [
                    { floor: 1, name: 'Вестибюль (Grand Lobby)', y: 0.0 },
                    { floor: 2, name: 'Служба Безопасности', y: 8.5 },
                    { floor: 3, name: 'Финансовая Аналитика', y: 17.0 },
                    { floor: 4, name: 'Зал Заседаний (Boardroom)', y: 25.5 },
                    { floor: 5, name: 'VIP Лаунж и Бар', y: 34.0 },
                    { floor: 6, name: 'Торговая Биржа', y: 42.5 },
                    { floor: 7, name: 'Офис Руководства', y: 51.0 },
                    { floor: 8, name: 'Пентхаус Директората', y: 59.5 },
                    { floor: 9, name: 'Панорамная Смотровая (Sky Deck)', y: 74.0 },
                    { floor: 10, name: 'Крыша и Вертолетная Площадка (Helipad)', y: 92.05 }
                ];

                this.currentFloorIndex = 0;
                this.targetFloorIndex = 0;
                this.pendingFloorIndex = -1;
                this.selectionCountdown = 0.0;

                this.currentY = 0.0;
                this.startY = 0.0;
                this.destY = 0.0;
                this.moveProgress = 1.0;
                this.moveDuration = 3.0;

                // Состояния: 'IDLE', 'DOORS_CLOSING', 'MOVING', 'ARRIVED', 'DOORS_OPENING'
                this.state = 'IDLE';
                this.doorProgress = 0.0;
                this.insideStayTimer = 0.0;

                this.isPlayerInside = false;

                this.hudPromptElement = document.getElementById('elevator-hud-prompt');
                this.hudStatusElement = document.getElementById('elevator-status-text');

                this.materials = {
                    titaniumWall: new THREE.MeshLambertMaterial({ color: 0x475569 }),
                    shaftOuterMat: new THREE.MeshLambertMaterial({ color: 0x334155 }),
                    mirrorBack: new THREE.MeshLambertMaterial({ color: 0xe2e8f0 }),
                    brushedSteelDoor: new THREE.MeshLambertMaterial({ color: 0x94a3b8 }),
                    goldHandrail: new THREE.MeshLambertMaterial({ color: 0xf59e0b }),
                    floorGranite: new THREE.MeshLambertMaterial({ color: 0x1e293b }),
                    ceilingLamp: new THREE.MeshBasicMaterial({ color: 0xfffaed }),
                    panelTex: new THREE.MeshLambertMaterial({ map: ProceduralTextureFactory.createElevatorPanelTexture() }),
                    displayTex: new THREE.MeshBasicMaterial({ map: ProceduralTextureFactory.createElevatorDisplayTexture(1, '▲') }),
                    glassWindows: new THREE.MeshLambertMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.65 }),
                    deskWood: new THREE.MeshLambertMaterial({ color: 0x78350f }),
                    sofaLeather: new THREE.MeshLambertMaterial({ color: 0x991b1b }),
                    chairLeather: new THREE.MeshLambertMaterial({ color: 0x1e293b })
                };

                this.buildShaftAndFloors();
                this.buildCabin();
                this.initPhysics();
                this.initFloorButtonsUI();
            }

            initFloorButtonsUI() {
                this.floorButtonsContainer = document.getElementById('elevator-floor-buttons');
                if (!this.floorButtonsContainer) return;
                this.floorButtonsContainer.innerHTML = '';
                for (let i = 0; i < this.floors.length; i++) {
                    const fl = this.floors[i];
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'elevator-floor-btn' + (fl.floor === 10 ? ' heli-floor-btn' : '');
                    btn.dataset.floor = fl.floor;
                    btn.title = `${fl.floor} этаж: ${fl.name}`;
                    btn.innerHTML = fl.floor === 10 ? '10 🚁' : `${fl.floor}`;
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        this.selectFloor(fl.floor);
                    });
                    this.floorButtonsContainer.appendChild(btn);
                }
                this.updateFloorButtonsUI(this.currentFloorIndex);
            }

            updateFloorButtonsUI(targetIndex) {
                if (!this.floorButtonsContainer) {
                    this.floorButtonsContainer = document.getElementById('elevator-floor-buttons');
                }
                if (!this.floorButtonsContainer) return;
                const btns = this.floorButtonsContainer.querySelectorAll('.elevator-floor-btn');
                btns.forEach((btn, idx) => {
                    btn.classList.remove('current-floor', 'target-floor');
                    if (idx === this.currentFloorIndex) {
                        btn.classList.add('current-floor');
                    }
                    if (targetIndex !== undefined && idx === targetIndex && targetIndex !== this.currentFloorIndex) {
                        btn.classList.add('target-floor');
                    }
                });
            }

            buildShaftAndFloors() {
                // 1. Сплошные внешние стены шахты лифта на 3 стороны (Левая, Правая, Задняя)
                // Левая сплошная стена шахты (X = -7.45, от 0 до 96м)
                const leftWallMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 96.0, 8.2), this.materials.shaftOuterMat);
                leftWallMesh.position.set(-7.45, 48.0, 60.0);
                this.scene.add(leftWallMesh);
                this.createStaticWallBox(-7.45, 48.0, 60.0, 0.4, 96.0, 8.2);

                // Правая сплошная стена шахты (X = 0.45, от 0 до 96м)
                const rightWallMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 96.0, 8.2), this.materials.shaftOuterMat);
                rightWallMesh.position.set(0.45, 48.0, 60.0);
                this.scene.add(rightWallMesh);
                this.createStaticWallBox(0.45, 48.0, 60.0, 0.4, 96.0, 8.2);

                // Задняя сплошная стена шахты (Z = 63.95, от 0 до 96м)
                const backWallMesh = new THREE.Mesh(new THREE.BoxGeometry(8.3, 96.0, 0.4), this.materials.shaftOuterMat);
                backWallMesh.position.set(-3.5, 48.0, 63.95);
                this.scene.add(backWallMesh);
                this.createStaticWallBox(-3.5, 48.0, 63.95, 8.3, 96.0, 0.4);

                // Передняя стена шахты: левый и правый глухие пилоны по бокам дверного проема (Z = 56.05)
                const frontLeftPillar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 96.0, 0.4), this.materials.shaftOuterMat);
                frontLeftPillar.position.set(-6.45, 48.0, 56.05);
                this.scene.add(frontLeftPillar);
                this.createStaticWallBox(-6.45, 48.0, 56.05, 2.4, 96.0, 0.4);

                const frontRightPillar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 96.0, 0.4), this.materials.shaftOuterMat);
                frontRightPillar.position.set(-0.55, 48.0, 56.05);
                this.scene.add(frontRightPillar);
                this.createStaticWallBox(-0.55, 48.0, 56.05, 2.4, 96.0, 0.4);

                // Яркий золотой портал и вывеска лифта на 1 этаже (вестибюль Maze Bank)
                const groundPortalFrame = new THREE.Group();
                groundPortalFrame.position.set(this.shaftX, 0, 55.75);

                const portalTop = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.5, 0.25), this.materials.goldHandrail);
                portalTop.position.set(0, 3.45, 0);
                groundPortalFrame.add(portalTop);

                const portalSignTex = ProceduralTextureFactory.createElevatorDisplayTexture(1, '▲ LOBBY');
                const portalSign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.5), new THREE.MeshBasicMaterial({ map: portalSignTex }));
                portalSign.position.set(0, 3.45, 0.14);
                groundPortalFrame.add(portalSign);

                const portalL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.5, 0.25), this.materials.goldHandrail);
                portalL.position.set(-2.15, 1.75, 0);
                groundPortalFrame.add(portalL);

                const portalR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.5, 0.25), this.materials.goldHandrail);
                portalR.position.set(2.15, 1.75, 0);
                groundPortalFrame.add(portalR);

                // Кнопка вызова лифта на стене справа от дверей
                const callBtnBox = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, 0.1), this.materials.goldHandrail);
                callBtnBox.position.set(2.45, 1.5, 0.05);
                groundPortalFrame.add(callBtnBox);

                const callBtnLed = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.04), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
                callBtnLed.position.set(2.45, 1.5, 0.11);
                groundPortalFrame.add(callBtnLed);

                // Яркий точечный свет перед лифтом
                const lobbyElevatorLight = new THREE.PointLight(0xffedd5, 2.6, 18, 2);
                lobbyElevatorLight.position.set(0, 3.8, 2.2);
                groundPortalFrame.add(lobbyElevatorLight);

                this.scene.add(groundPortalFrame);

                // 2. Генерация полноценных просторных лобби и сплошных физических полов для ВСЕХ этажей (2..8)
                for (let k = 1; k < this.floors.length - 2; k++) {
                    const fl = this.floors[k];
                    this.buildFloorLobby(fl);
                }

                // 3. 9-й Этаж: Панорамная смотровая площадка (Sky Deck на Y = 74.0м)
                const skyDeckGroup = new THREE.Group();
                skyDeckGroup.position.set(0, 74.0, 60.0);

                const deckFloor = new THREE.Mesh(new THREE.BoxGeometry(28.0, 0.4, 28.0), this.materials.floorGranite);
                deckFloor.position.y = -0.2;
                skyDeckGroup.add(deckFloor);

                const deckCeil = new THREE.Mesh(new THREE.BoxGeometry(28.0, 0.4, 28.0), this.materials.titaniumWall);
                deckCeil.position.y = 5.2;
                skyDeckGroup.add(deckCeil);

                // Панорамные стеклянные стены по периметру
                const gNorth = new THREE.Mesh(new THREE.BoxGeometry(28.0, 5.2, 0.2), this.materials.glassWindows);
                gNorth.position.set(0, 2.6, 14.0); skyDeckGroup.add(gNorth);
                const gSouth = new THREE.Mesh(new THREE.BoxGeometry(28.0, 5.2, 0.2), this.materials.glassWindows);
                gSouth.position.set(0, 2.6, -14.0); skyDeckGroup.add(gSouth);
                const gEast = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5.2, 28.0), this.materials.glassWindows);
                gEast.position.set(14.0, 2.6, 0); skyDeckGroup.add(gEast);
                const gWest = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5.2, 28.0), this.materials.glassWindows);
                gWest.position.set(-14.0, 2.6, 0); skyDeckGroup.add(gWest);

                // Диваны и лаунж-столики
                const sofa1 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.8, 1.4), this.materials.sofaLeather);
                sofa1.position.set(0, 0.4, 6.5); skyDeckGroup.add(sofa1);

                const sofa2 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.8, 1.4), this.materials.sofaLeather);
                sofa2.position.set(0, 0.4, -6.5); sofa2.rotation.y = Math.PI; skyDeckGroup.add(sofa2);

                const table = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.5, 1.2), this.materials.goldHandrail);
                table.position.set(0, 0.25, 0); skyDeckGroup.add(table);

                // Золотые панорамные телескопы по углам площадки
                const telescopePositions = [
                    { tx: 10.5, tz: 10.5, rot: Math.PI / 4 },
                    { tx: -10.5, tz: 10.5, rot: 3 * Math.PI / 4 },
                    { tx: 10.5, tz: -10.5, rot: -Math.PI / 4 },
                    { tx: -10.5, tz: -10.5, rot: -3 * Math.PI / 4 }
                ];
                for (const tp of telescopePositions) {
                    const scopeGroup = new THREE.Group();
                    scopeGroup.position.set(tp.tx, 0, tp.tz);
                    scopeGroup.rotation.y = tp.rot;

                    const scopeStand = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.35, 1.4, 12), this.materials.goldHandrail);
                    scopeStand.position.y = 0.7; scopeGroup.add(scopeStand);

                    const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 1.3, 14), this.materials.goldHandrail);
                    scopeBody.rotation.x = -0.22; scopeBody.position.set(0, 1.45, 0.2);
                    scopeGroup.add(scopeBody);

                    skyDeckGroup.add(scopeGroup);
                }

                // Освещение Sky Deck
                const skyDeckLight = new THREE.PointLight(0xffeedb, 2.2, 28, 2);
                skyDeckLight.position.set(0, 4.6, 0);
                skyDeckGroup.add(skyDeckLight);

                this.scene.add(skyDeckGroup);

                // 4. 10-й Этаж: Крыша и Вертолетная Площадка (Helipad на Y = 92.05м)
                const helipadExitGroup = new THREE.Group();
                helipadExitGroup.position.set(this.shaftX, 92.05, this.shaftZ);

                const heliPortal = new THREE.Mesh(new THREE.BoxGeometry(7.8, 3.8, 7.8), this.materials.titaniumWall);
                heliPortal.position.y = 1.9;
                helipadExitGroup.add(heliPortal);

                // Ограждения по периметру крыши вертолетной площадки
                const railMat = this.materials.goldHandrail;
                const rN = new THREE.Mesh(new THREE.BoxGeometry(27.0, 1.1, 0.1), railMat);
                rN.position.set(-this.shaftX, 0.55, 13.5 - this.shaftZ + 60.0); helipadExitGroup.add(rN);
                const rS = new THREE.Mesh(new THREE.BoxGeometry(27.0, 1.1, 0.1), railMat);
                rS.position.set(-this.shaftX, 0.55, -13.5 - this.shaftZ + 60.0); helipadExitGroup.add(rS);
                const rE = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 27.0), railMat);
                rE.position.set(13.5 - this.shaftX, 0.55, 60.0 - this.shaftZ); helipadExitGroup.add(rE);
                const rW = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 27.0), railMat);
                rW.position.set(-13.5 - this.shaftX, 0.55, 60.0 - this.shaftZ); helipadExitGroup.add(rW);

                this.scene.add(helipadExitGroup);

                // Коллизии для 1, 9 и 10 этажей
                this.createStaticFloorBox(0, -0.2, 60, 32, 0.4, 32);
                this.createStaticFloorBox(0, 73.9, 60, 28, 0.4, 28);
                this.createStaticFloorBox(0, 91.95, 60, 28, 0.4, 28);

                // Защитные стены по периметру 9 и 10 этажей
                this.createStaticWallBox(0, 76.6, 74.0, 28, 5.2, 0.4);
                this.createStaticWallBox(0, 76.6, 46.0, 28, 5.2, 0.4);
                this.createStaticWallBox(14.0, 76.6, 60.0, 0.4, 5.2, 28);
                this.createStaticWallBox(-14.0, 76.6, 60.0, 0.4, 5.2, 28);

                this.createStaticWallBox(0, 92.6, 73.5, 27, 1.2, 0.4);
                this.createStaticWallBox(0, 92.6, 46.5, 27, 1.2, 0.4);
                this.createStaticWallBox(13.5, 92.6, 60.0, 0.4, 1.2, 27);
                this.createStaticWallBox(-13.5, 92.6, 60.0, 0.4, 1.2, 27);
            }

            buildFloorLobby(fl) {
                const floorGroup = new THREE.Group();
                floorGroup.position.set(0, fl.y, 60.0);

                const fW = 30.0; const fD = 30.0; const fH = 4.2;

                // 1. Пол этажа с открытой шахтой для лифта (шахта X = -3.5, Z = 60.0 свободна!)
                // Южный сегмент пола (перед лифтом)
                const southFloor = new THREE.Mesh(new THREE.BoxGeometry(fW, 0.35, 11.0), this.materials.floorGranite);
                southFloor.position.set(0, -0.175, -9.5);
                southFloor.receiveShadow = true;
                floorGroup.add(southFloor);
                this.createStaticFloorBox(0, fl.y - 0.175, 60.0 - 9.5, fW, 0.35, 11.0);

                // Северный сегмент пола (за лифтом)
                const northFloor = new THREE.Mesh(new THREE.BoxGeometry(fW, 0.35, 11.0), this.materials.floorGranite);
                northFloor.position.set(0, -0.175, 9.5);
                northFloor.receiveShadow = true;
                floorGroup.add(northFloor);
                this.createStaticFloorBox(0, fl.y - 0.175, 60.0 + 9.5, fW, 0.35, 11.0);

                // Восточный сегмент пола (справа от шахты)
                const eastFloor = new THREE.Mesh(new THREE.BoxGeometry(19.0, 0.35, 8.0), this.materials.floorGranite);
                eastFloor.position.set(5.5, -0.175, 0);
                eastFloor.receiveShadow = true;
                floorGroup.add(eastFloor);
                this.createStaticFloorBox(5.5, fl.y - 0.175, 60.0, 19.0, 0.35, 8.0);

                // Западный сегмент пола (слева от шахты)
                const westFloor = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.35, 8.0), this.materials.floorGranite);
                westFloor.position.set(-11.5, -0.175, 0);
                westFloor.receiveShadow = true;
                floorGroup.add(westFloor);
                this.createStaticFloorBox(-11.5, fl.y - 0.175, 60.0, 7.0, 0.35, 8.0);

                // Потолок этажа (с открытой шахтой для свободного движения кабины без ударов о перекрытия)
                const southCeil = new THREE.Mesh(new THREE.BoxGeometry(fW, 0.35, 11.0), this.materials.titaniumWall);
                southCeil.position.set(0, fH, -9.5);
                floorGroup.add(southCeil);

                const northCeil = new THREE.Mesh(new THREE.BoxGeometry(fW, 0.35, 11.0), this.materials.titaniumWall);
                northCeil.position.set(0, fH, 9.5);
                floorGroup.add(northCeil);

                const eastCeil = new THREE.Mesh(new THREE.BoxGeometry(19.0, 0.35, 8.0), this.materials.titaniumWall);
                eastCeil.position.set(5.5, fH, 0);
                floorGroup.add(eastCeil);

                const westCeil = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.35, 8.0), this.materials.titaniumWall);
                westCeil.position.set(-11.5, fH, 0);
                floorGroup.add(westCeil);

                // Стеклянные панорамные стены по внешнему периметру этажа
                const northWall = new THREE.Mesh(new THREE.BoxGeometry(fW, fH, 0.3), this.materials.glassWindows);
                northWall.position.set(0, fH / 2, fD / 2); floorGroup.add(northWall);
                this.createStaticWallBox(0, fl.y + fH / 2, 60.0 + fD / 2, fW, fH, 0.3);

                const southWall = new THREE.Mesh(new THREE.BoxGeometry(fW, fH, 0.3), this.materials.glassWindows);
                southWall.position.set(0, fH / 2, -fD / 2); floorGroup.add(southWall);
                this.createStaticWallBox(0, fl.y + fH / 2, 60.0 - fD / 2, fW, fH, 0.3);

                const eastWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, fH, fD), this.materials.glassWindows);
                eastWall.position.set(fW / 2, fH / 2, 0); floorGroup.add(eastWall);
                this.createStaticWallBox(fW / 2, fl.y + fH / 2, 60.0, 0.3, fH, fD);

                const westWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, fH, fD), this.materials.glassWindows);
                westWall.position.set(-fW / 2, fH / 2, 0); floorGroup.add(westWall);
                this.createStaticWallBox(-fW / 2, fl.y + fH / 2, 60.0, 0.3, fH, fD);

                // 2. Меблировка интерьера строго в лаунж-зоне спереди (Z = -9.0), полностью исключая шахту лифта
                if (fl.floor === 4 || fl.floor === 7) {
                    // Конференц-зал
                    const confTable = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.75, 2.2), this.materials.deskWood);
                    confTable.position.set(2.0, 0.375, -8.5); confTable.castShadow = true;
                    floorGroup.add(confTable);
                    this.createStaticWallBox(2.0, fl.y + 0.375, 60.0 - 8.5, 6.5, 0.75, 2.2);

                    for (let cx = -0.4; cx <= 4.4; cx += 1.2) {
                        const chair1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.85, 0.6), this.materials.chairLeather);
                        chair1.position.set(cx, 0.425, -7.1); floorGroup.add(chair1);
                        this.createStaticWallBox(cx, fl.y + 0.425, 60.0 - 7.1, 0.6, 0.85, 0.6);

                        const chair2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.85, 0.6), this.materials.chairLeather);
                        chair2.position.set(cx, 0.425, -9.9); floorGroup.add(chair2);
                        this.createStaticWallBox(cx, fl.y + 0.425, 60.0 - 9.9, 0.6, 0.85, 0.6);
                    }
                } else if (fl.floor === 5 || fl.floor === 8) {
                    // VIP Лаунж — барная стойка и диван далеко от лифта
                    const barCounter = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.1, 0.9), this.materials.goldHandrail);
                    barCounter.position.set(5.5, 0.55, -8.5); floorGroup.add(barCounter);
                    this.createStaticWallBox(5.5, fl.y + 0.55, 60.0 - 8.5, 5.2, 1.1, 0.9);

                    const loungeSofa = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.8, 1.5), this.materials.sofaLeather);
                    loungeSofa.position.set(-6.0, 0.4, -8.5); floorGroup.add(loungeSofa);
                    this.createStaticWallBox(-6.0, fl.y + 0.4, 60.0 - 8.5, 4.8, 0.8, 1.5);
                } else {
                    // Офисные рабочие места
                    const desk1 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.75, 1.2), this.materials.deskWood);
                    desk1.position.set(-6.0, 0.375, -8.5); floorGroup.add(desk1);
                    this.createStaticWallBox(-6.0, fl.y + 0.375, 60.0 - 8.5, 2.4, 0.75, 1.2);

                    const desk2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.75, 1.2), this.materials.deskWood);
                    desk2.position.set(6.0, 0.375, -8.5); floorGroup.add(desk2);
                    this.createStaticWallBox(6.0, fl.y + 0.375, 60.0 - 8.5, 2.4, 0.75, 1.2);
                }

                // Перемычка над входом в лифт
                const lintelMesh = new THREE.Mesh(new THREE.BoxGeometry(3.6, fH - 3.2, 0.4), this.materials.shaftOuterMat);
                lintelMesh.position.set(this.shaftX, 3.2 + (fH - 3.2) / 2, -3.95);
                floorGroup.add(lintelMesh);

                // Освещение этажного лобби
                const floorLight = new THREE.PointLight(0xfffaed, 1.6, 28.0, 2);
                floorLight.position.set(0, fH - 0.5, -6.0);
                floorGroup.add(floorLight);

                this.scene.add(floorGroup);
            }

            createStaticFloorBox(x, y, z, w, h, d) {
                const body = new CANNON.Body({
                    mass: 0,
                    material: this.physicsMaterials.ground,
                    position: new CANNON.Vec3(x, y, z)
                });
                body.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)));
                this.world.addBody(body);
            }

            createStaticWallBox(x, y, z, w, h, d) {
                const body = new CANNON.Body({
                    mass: 0,
                    material: this.physicsMaterials.wall,
                    position: new CANNON.Vec3(x, y, z)
                });
                body.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)));
                this.world.addBody(body);
            }

            buildCabin() {
                this.cabinGroup = new THREE.Group();
                this.cabinGroup.position.set(this.shaftX, this.currentY, this.shaftZ);

                // Увеличенная в 3 раза просторная кабина лифта (7.5м х 3.6м х 7.5м)
                const cW = 7.5; const cH = 3.6; const cD = 7.5; const wT = 0.12;

                // 1. Пол кабины
                const cabinFloor = new THREE.Mesh(new THREE.BoxGeometry(cW, 0.14, cD), this.materials.floorGranite);
                cabinFloor.position.y = 0.07;
                this.cabinGroup.add(cabinFloor);

                // 2. Потолок кабины с подсветкой
                const cabinCeil = new THREE.Mesh(new THREE.BoxGeometry(cW, 0.14, cD), this.materials.titaniumWall);
                cabinCeil.position.y = cH;
                this.cabinGroup.add(cabinCeil);

                const lampMesh = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.06, 3.5), this.materials.ceilingLamp);
                lampMesh.position.set(0, cH - 0.03, 0);
                this.cabinGroup.add(lampMesh);

                this.cabinLight = new THREE.PointLight(0xfff5e6, 2.2, 14.0, 2);
                this.cabinLight.position.set(0, cH - 0.4, 0);
                this.cabinGroup.add(this.cabinLight);

                // 3. Стены кабины (Левая, Правая, Задняя)
                const wallL = new THREE.Mesh(new THREE.BoxGeometry(wT, cH, cD), this.materials.titaniumWall);
                wallL.position.set(-cW / 2 + wT / 2, cH / 2, 0);
                this.cabinGroup.add(wallL);

                const wallR = new THREE.Mesh(new THREE.BoxGeometry(wT, cH, cD), this.materials.titaniumWall);
                wallR.position.set(cW / 2 - wT / 2, cH / 2, 0);
                this.cabinGroup.add(wallR);

                const wallBack = new THREE.Mesh(new THREE.BoxGeometry(cW, cH, wT), this.materials.titaniumWall);
                wallBack.position.set(0, cH / 2, cD / 2 - wT / 2);
                this.cabinGroup.add(wallBack);

                // Большое панорамное зеркало на задней стенке
                const mirrorMesh = new THREE.Mesh(new THREE.PlaneGeometry(cW * 0.82, cH * 0.72), this.materials.mirrorBack);
                mirrorMesh.position.set(0, cH / 2, cD / 2 - wT - 0.02);
                mirrorMesh.rotation.y = Math.PI;
                this.cabinGroup.add(mirrorMesh);

                // Золотые поручни по периметру
                const railBack = new THREE.Mesh(new THREE.BoxGeometry(cW * 0.85, 0.08, 0.08), this.materials.goldHandrail);
                railBack.position.set(0, 1.05, cD / 2 - wT - 0.1);
                this.cabinGroup.add(railBack);

                const railLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, cD * 0.85), this.materials.goldHandrail);
                railLeft.position.set(-cW / 2 + wT + 0.1, 1.05, 0);
                this.cabinGroup.add(railLeft);

                const railRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, cD * 0.85), this.materials.goldHandrail);
                railRight.position.set(cW / 2 - wT - 0.1, 1.05, 0);
                this.cabinGroup.add(railRight);

                // 4. Панель кнопок этажей
                const panelMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 1.8), this.materials.panelTex);
                panelMesh.position.set(cW / 2 - wT - 0.03, 1.5, -0.6);
                panelMesh.rotation.y = -Math.PI / 2;
                this.cabinGroup.add(panelMesh);

                // 5. Цифровое табло над дверями
                const displayMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), this.materials.displayTex);
                displayMesh.position.set(0, cH - 0.35, -cD / 2 + wT + 0.03);
                this.cabinGroup.add(displayMesh);
                this.displayMesh = displayMesh;

                // 6. Раздвижные двери кабины увеличенного размера (Grand Double Sliding Doors)
                this.doorGroup = new THREE.Group();
                this.doorGroup.position.set(0, 0, -cD / 2 + 0.06);

                const doorW = 2.0; const doorH = 3.2;
                const dGeo = new THREE.BoxGeometry(doorW, doorH, 0.08);

                this.cabinDoorLeft = new THREE.Mesh(dGeo, this.materials.brushedSteelDoor);
                this.cabinDoorLeft.position.set(-doorW / 2, doorH / 2, 0);
                this.doorGroup.add(this.cabinDoorLeft);

                this.cabinDoorRight = new THREE.Mesh(dGeo, this.materials.brushedSteelDoor);
                this.cabinDoorRight.position.set(doorW / 2, doorH / 2, 0);
                this.doorGroup.add(this.cabinDoorRight);

                this.cabinGroup.add(this.doorGroup);
                this.scene.add(this.cabinGroup);
            }

            initPhysics() {
                // Кинематическое физическое тело пола кабины (7.5м х 7.5м)
                this.cabinBody = new CANNON.Body({
                    mass: 0,
                    type: CANNON.Body.KINEMATIC,
                    material: this.physicsMaterials.ground,
                    position: new CANNON.Vec3(this.shaftX, this.currentY + 0.07, this.shaftZ)
                });
                this.cabinBody.addShape(new CANNON.Box(new CANNON.Vec3(3.75, 0.07, 3.75)));
                this.world.addBody(this.cabinBody);
            }

            selectFloor(floorNum) {
                // floorNum: 1..10
                const targetIdx = Math.max(0, Math.min(this.floors.length - 1, floorNum - 1));
                if (this.state === 'MOVING' || this.state === 'DOORS_CLOSING') return;

                if (targetIdx === this.currentFloorIndex && this.state === 'IDLE') {
                    if (this.hudStatusElement) {
                        this.hudStatusElement.innerText = `Вы уже на ${this.floors[targetIdx].floor} этаже (${this.floors[targetIdx].name})`;
                    }
                    this.updateFloorButtonsUI(this.currentFloorIndex);
                    return;
                }

                this.targetFloorIndex = targetIdx;
                this.pendingFloorIndex = -1;
                this.selectionCountdown = 0.0;
                this.startY = this.currentY;
                this.destY = this.floors[this.targetFloorIndex].y;
                const distance = Math.abs(this.destY - this.startY);
                this.moveDuration = Math.max(1.8, distance / 14.0 + 1.2);
                this.moveProgress = 0.0;
                this.state = 'DOORS_CLOSING';

                if (this.hudStatusElement) {
                    const targetFl = this.floors[targetIdx];
                    this.hudStatusElement.innerText = `▶ ВЫБРАН: ${targetFl.floor} ЭТАЖ (${targetFl.name}). Закрытие дверей...`;
                }
                this.updateFloorButtonsUI(targetIdx);
            }

            update(deltaTime, player) {
                const dt = Math.min(deltaTime, 0.1);
                const cW = 7.5; const cD = 7.5;

                let isNearOutside = false;
                let playerTargetFloor = -1;

                // 1. Проверка положения ИСКЛЮЧИТЕЛЬНО игрока (NPC полностью игнорируются)
                if (player && player.body) {
                    const pPos = player.body.position;

                    // Нахождение внутри кабины
                    const dy = pPos.y - (this.currentY + 0.8);
                    const isSameCabinHeight = Math.abs(dy) < 2.5;
                    const dx = pPos.x - this.shaftX;
                    const dz = pPos.z - this.shaftZ;
                    this.isPlayerInside = (isSameCabinHeight && Math.abs(dx) < (cW / 2 - 0.3) && Math.abs(dz) < (cD / 2 - 0.3));

                    // Определение этажа, на котором находится игрок снаружи
                    for (let f = 0; f < this.floors.length; f++) {
                        const flY = this.floors[f].y;
                        if (Math.abs(pPos.y - flY) < 2.2) {
                            const entranceZ = this.shaftZ - cD / 2;
                            const distToDoor = Math.hypot(pPos.x - this.shaftX, pPos.z - entranceZ);
                            if (distToDoor < 4.8 && pPos.z < entranceZ + 0.8) {
                                isNearOutside = true;
                                playerTargetFloor = f;
                            }
                            break;
                        }
                    }

                    // Автоматический вызов лифта: если игрок подошел к дверям на любом этаже, лифт сразу едет к нему!
                    if (isNearOutside && playerTargetFloor >= 0 && playerTargetFloor !== this.currentFloorIndex && this.state === 'IDLE') {
                        this.targetFloorIndex = playerTargetFloor;
                        this.startY = this.currentY;
                        this.destY = this.floors[this.targetFloorIndex].y;
                        const distance = Math.abs(this.destY - this.startY);
                        this.moveDuration = Math.max(1.8, distance / 14.0 + 1.2);
                        this.moveProgress = 0.0;
                        this.state = 'DOORS_CLOSING';
                        this.updateFloorButtonsUI(this.targetFloorIndex);
                    }

                    if (this.isPlayerInside) {
                        if (this.hudPromptElement) {
                            this.hudPromptElement.style.display = 'block';
                            this.hudPromptElement.classList.add('active');
                            if (this.state === 'IDLE') {
                                if (this.hudStatusElement) {
                                    this.hudStatusElement.innerText = `Текущий: ${this.floors[this.currentFloorIndex].floor} этаж — ${this.floors[this.currentFloorIndex].name}`;
                                }
                                this.updateFloorButtonsUI(this.currentFloorIndex);
                            }
                        }
                    } else {
                        if (this.hudPromptElement && this.state === 'IDLE') {
                            this.hudPromptElement.style.display = 'none';
                            this.hudPromptElement.classList.remove('active');
                        }
                    }
                }

                // Логика автоматического открытия дверей
                if (this.state === 'IDLE') {
                    if (isNearOutside && playerTargetFloor === this.currentFloorIndex) {
                        if (this.doorProgress < 1.0) this.state = 'DOORS_OPENING';
                        this.insideStayTimer = 0.0;
                    } else if (this.isPlayerInside) {
                        this.insideStayTimer += dt;
                        if (this.insideStayTimer > 1.8 && this.doorProgress > 0.0) {
                            this.state = 'DOORS_CLOSING';
                        }
                    } else {
                        this.insideStayTimer = 0.0;
                        if (this.doorProgress > 0.0) {
                            this.state = 'DOORS_CLOSING';
                        }
                    }
                }

                // Машина состояний движения лифта
                if (this.state === 'DOORS_CLOSING') {
                    this.doorProgress = Math.max(0.0, this.doorProgress - dt * 1.8);
                    this.updateDoors();
                    if (this.doorProgress <= 0.0) {
                        if (this.targetFloorIndex !== this.currentFloorIndex) {
                            this.state = 'MOVING';
                            this.audioSynth.startHum();
                            const arrow = this.destY > this.startY ? '▲' : '▼';
                            this.displayMesh.material.map = ProceduralTextureFactory.createElevatorDisplayTexture(this.floors[this.targetFloorIndex].floor, arrow);
                            this.displayMesh.material.needsUpdate = true;
                        } else {
                            this.state = 'IDLE';
                        }
                    }
                } else if (this.state === 'MOVING') {
                    this.moveProgress += dt / this.moveDuration;
                    const t = Math.min(1.0, this.moveProgress);
                    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

                    const newY = THREE.MathUtils.lerp(this.startY, this.destY, ease);
                    this.currentY = newY;

                    this.cabinGroup.position.y = this.currentY;
                    this.cabinBody.position.y = this.currentY + 0.07;

                    // Полная фиксация игрока внутри кабины во время движения (0 коллизий с перекрытиями)
                    if (this.isPlayerInside && player && player.body) {
                        player.body.position.y = this.currentY + 0.88;
                        player.body.velocity.set(0, 0, 0);
                        if (player.mesh) player.mesh.position.y = this.currentY;
                    }

                    if (this.hudStatusElement) {
                        const targetFl = this.floors[this.targetFloorIndex];
                        this.hudStatusElement.innerText = `В ДВИЖЕНИИ... [На ${targetFl.floor} этаж: ${targetFl.name}]`;
                    }

                    if (this.moveProgress >= 1.0) {
                        this.currentY = this.destY;
                        this.cabinGroup.position.y = this.currentY;
                        this.cabinBody.position.y = this.currentY + 0.07;
                        this.currentFloorIndex = this.targetFloorIndex;
                        this.state = 'ARRIVED';

                        this.audioSynth.stopHum();
                        this.audioSynth.playDing();

                        this.displayMesh.material.map = ProceduralTextureFactory.createElevatorDisplayTexture(this.floors[this.currentFloorIndex].floor, '●');
                        this.displayMesh.material.needsUpdate = true;

                        if (this.hudStatusElement) {
                            this.hudStatusElement.innerText = `Прибыли: ${this.floors[this.currentFloorIndex].floor} этаж — ${this.floors[this.currentFloorIndex].name}!`;
                        }
                        this.updateFloorButtonsUI(this.currentFloorIndex);

                        setTimeout(() => {
                            if (this.state === 'ARRIVED') this.state = 'DOORS_OPENING';
                        }, 350);
                    }
                } else if (this.state === 'DOORS_OPENING') {
                    this.doorProgress = Math.min(1.0, this.doorProgress + dt * 1.8);
                    this.updateDoors();
                    if (this.doorProgress >= 1.0) {
                        this.state = 'IDLE';
                        if (this.hudStatusElement) {
                            this.hudStatusElement.innerText = `Текущий: ${this.floors[this.currentFloorIndex].floor} этаж — ${this.floors[this.currentFloorIndex].name}`;
                        }
                        this.updateFloorButtonsUI(this.currentFloorIndex);
                    }
                }
            }

            updateDoors() {
                // Створки увеличенных дверей (Slide Progress 0..1)
                const slideDist = this.doorProgress * 1.95;
                if (this.cabinDoorLeft && this.cabinDoorRight) {
                    this.cabinDoorLeft.position.x = -1.0 - slideDist;
                    this.cabinDoorRight.position.x = 1.0 + slideDist;
                }
            }
        }
