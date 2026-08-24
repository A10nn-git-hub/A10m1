/**
 * SkyscraperElevatorSystem - Интерактивная сеть лифтов во ВСЕХ зданиях открытого мира
 * - Maze Bank Tower: 10 этажей (Вестибюль -> Офисы -> Смотровая площадка -> Вертодром 92м)
 * - LSPD Police Precinct: 3 этажа (Дежурная часть/Камеры -> Оружейная/Детективы -> Тактическая крыша)
 * - Pillbox Hill Hospital: 3 этажа (Приемный покой -> Хирургия/ICU -> Вертолетная площадка "H")
 * - Downtown Skyscrapers: 3 этажа (Вестибюль -> Бизнес-центр -> Панорамная крыша)
 */
class SkyscraperElevatorSystem {
    constructor(scene, world, physicsMaterials) {
        this.scene = scene;
        this.world = world;
        this.physicsMaterials = physicsMaterials;

        this.audioSynth = new ElevatorAudioSynth();

        this.materials = {
            titaniumWall: new THREE.MeshLambertMaterial({ color: 0x475569 }),
            shaftOuterMat: new THREE.MeshLambertMaterial({ color: 0x334155 }),
            brushedSteelDoor: new THREE.MeshLambertMaterial({ color: 0x94a3b8 }),
            goldHandrail: new THREE.MeshLambertMaterial({ color: 0xf59e0b }),
            floorGranite: new THREE.MeshLambertMaterial({ color: 0x1e293b }),
            ceilingLamp: new THREE.MeshBasicMaterial({ color: 0xfffaed }),
            glassWindows: new THREE.MeshLambertMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.65 })
        };

        this.elevators = [];
        this.activeElevator = null;

        this.hudPromptElement = document.getElementById('elevator-hud-prompt');
        this.hudTitleElement = document.querySelector('.elevator-title');
        this.hudStatusElement = document.getElementById('elevator-status-text');
        this.floorButtonsContainer = document.getElementById('elevator-floor-buttons');

        this.initAllBuildingElevators();
    }

    initAllBuildingElevators() {
        // 1. Лифт Небоскреба Maze Bank (10 этажей)
        const mazeFloors = [
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
        this.createBuildingElevator('ЛИФТ MAZE BANK TOWER', -3.5, 60.0, mazeFloors, 7.5, 7.5, 96.0, true);

        // 2. Лифт Полицейского Участка LSPD (3 этажа)
        const policeFloors = [
            { floor: 1, name: 'Дежурная часть и Камеры', y: 0.0 },
            { floor: 2, name: 'Оружейная и Детективы', y: 3.4 },
            { floor: 3, name: 'Крыша и Тактическая площадка', y: 6.8 }
        ];
        this.createBuildingElevator('ЛИФТ LSPD PRECINCT', -52.5, 66.0, policeFloors, 4.2, 4.2, 10.0, false);

        // 3. Лифт Госпиталя Pillbox Hill (3 этажа)
        const hospitalFloors = [
            { floor: 1, name: 'Приемный покой и Травмпункт', y: 0.0 },
            { floor: 2, name: 'Хирургия и Реанимация', y: 3.5 },
            { floor: 3, name: 'Вертолетная площадка Скорой (Helipad)', y: 7.0 }
        ];
        this.createBuildingElevator('ЛИФТ PILLBOX HOSPITAL', 52.5, 66.0, hospitalFloors, 4.2, 4.2, 10.0, false);

        // 4. Лифт Западного Небоскреба Downtown West (3 этажа)
        const westTowerFloors = [
            { floor: 1, name: 'Уличный вестибюль', y: 0.0 },
            { floor: 2, name: 'Бизнес-центр и Офисы', y: 28.0 },
            { floor: 3, name: 'Крыша и Вертолетная площадка ("H")', y: 56.0 }
        ];
        this.createBuildingElevator('ЛИФТ DOWNTOWN WEST TOWER', -120.0, 60.0, westTowerFloors, 5.0, 5.0, 62.0, false);

        // 5. Лифт Восточного Небоскреба Downtown East (3 этажа)
        const eastTowerFloors = [
            { floor: 1, name: 'Главный вестибюль', y: 0.0 },
            { floor: 2, name: 'Корпоративный лаунж', y: 28.0 },
            { floor: 3, name: 'Панорамная смотровая крыша', y: 56.0 }
        ];
        this.createBuildingElevator('ЛИФТ DOWNTOWN EAST TOWER', 120.0, 60.0, eastTowerFloors, 5.0, 5.0, 62.0, false);

        this.activeElevator = this.elevators[0];
    }

    createStaticWallBox(x, y, z, w, h, d) {
        const body = new CANNON.Body({
            mass: 0,
            material: this.physicsMaterials.wall,
            position: new CANNON.Vec3(x, y, z)
        });
        body.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)));
        this.world.addBody(body);
        return body;
    }

    createBuildingElevator(name, shaftX, shaftZ, floors, cW, cD, shaftH, isMazeBank = false) {
        const elev = {
            name: name,
            shaftX: shaftX,
            shaftZ: shaftZ,
            floors: floors,
            cW: cW,
            cD: cD,
            shaftH: shaftH,
            currentFloorIndex: 0,
            targetFloorIndex: 0,
            currentY: 0.0,
            startY: 0.0,
            destY: 0.0,
            moveProgress: 1.0,
            moveDuration: isMazeBank ? 3.0 : 2.0,
            state: 'IDLE',
            doorProgress: 0.0,
            insideStayTimer: 0.0,
            isPlayerInside: false,
            isMazeBank: isMazeBank
        };

        const shaftMat = this.materials.shaftOuterMat;

        // Стены шахты
        const lMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, shaftH, cD + 0.6), shaftMat);
        lMesh.position.set(shaftX - cW / 2 - 0.15, shaftH / 2, shaftZ);
        this.scene.add(lMesh);
        this.createStaticWallBox(shaftX - cW / 2 - 0.15, shaftH / 2, shaftZ, 0.3, shaftH, cD + 0.6);

        const rMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, shaftH, cD + 0.6), shaftMat);
        rMesh.position.set(shaftX + cW / 2 + 0.15, shaftH / 2, shaftZ);
        this.scene.add(rMesh);
        this.createStaticWallBox(shaftX + cW / 2 + 0.15, shaftH / 2, shaftZ, 0.3, shaftH, cD + 0.6);

        const bMesh = new THREE.Mesh(new THREE.BoxGeometry(cW + 0.6, shaftH, 0.3), shaftMat);
        bMesh.position.set(shaftX, shaftH / 2, shaftZ + cD / 2 + 0.15);
        this.scene.add(bMesh);
        this.createStaticWallBox(shaftX, shaftH / 2, shaftZ + cD / 2 + 0.15, cW + 0.6, shaftH, 0.3);

        const pillarW = cW * 0.28;
        const plMesh = new THREE.Mesh(new THREE.BoxGeometry(pillarW, shaftH, 0.3), shaftMat);
        plMesh.position.set(shaftX - cW / 2 + pillarW / 2, shaftH / 2, shaftZ - cD / 2 - 0.15);
        this.scene.add(plMesh);
        this.createStaticWallBox(shaftX - cW / 2 + pillarW / 2, shaftH / 2, shaftZ - cD / 2 - 0.15, pillarW, shaftH, 0.3);

        const prMesh = new THREE.Mesh(new THREE.BoxGeometry(pillarW, shaftH, 0.3), shaftMat);
        prMesh.position.set(shaftX + cW / 2 - pillarW / 2, shaftH / 2, shaftZ - cD / 2 - 0.15);
        this.scene.add(prMesh);
        this.createStaticWallBox(shaftX + cW / 2 - pillarW / 2, shaftH / 2, shaftZ - cD / 2 - 0.15, pillarW, shaftH, 0.3);

        // Кабина лифта
        const cabinGroup = new THREE.Group();
        cabinGroup.position.set(shaftX, 0, shaftZ);

        const cH = 3.2;
        const cFloorMesh = new THREE.Mesh(new THREE.BoxGeometry(cW - 0.2, 0.15, cD - 0.2), this.materials.floorGranite);
        cFloorMesh.position.set(0, 0.075, 0);
        cFloorMesh.receiveShadow = true;
        cabinGroup.add(cFloorMesh);

        const cCeilMesh = new THREE.Mesh(new THREE.BoxGeometry(cW - 0.2, 0.15, cD - 0.2), this.materials.titaniumWall);
        cCeilMesh.position.set(0, cH - 0.075, 0);
        cabinGroup.add(cCeilMesh);

        const lampMesh = new THREE.Mesh(new THREE.BoxGeometry(cW * 0.4, 0.05, cD * 0.4), this.materials.ceilingLamp);
        lampMesh.position.set(0, cH - 0.12, 0);
        cabinGroup.add(lampMesh);

        const cabLight = new THREE.PointLight(0xfffaea, 2.2, 14, 2);
        cabLight.position.set(0, cH - 0.3, 0);
        cabinGroup.add(cabLight);

        // Створки дверей кабины
        const dW = (cW * 0.44) / 2;
        const dLeft = new THREE.Mesh(new THREE.BoxGeometry(dW, cH * 0.95, 0.06), this.materials.brushedSteelDoor);
        dLeft.position.set(-dW / 2, cH * 0.48, -cD / 2 + 0.1);
        cabinGroup.add(dLeft);

        const dRight = new THREE.Mesh(new THREE.BoxGeometry(dW, cH * 0.95, 0.06), this.materials.brushedSteelDoor);
        dRight.position.set(dW / 2, cH * 0.48, -cD / 2 + 0.1);
        cabinGroup.add(dRight);

        this.scene.add(cabinGroup);

        // Физический пол кабины Cannon.js
        const cBody = new CANNON.Body({
            mass: 0,
            material: this.physicsMaterials.wall,
            position: new CANNON.Vec3(shaftX, 0.07, shaftZ)
        });
        cBody.addShape(new CANNON.Box(new CANNON.Vec3(cW / 2 - 0.1, 0.1, cD / 2 - 0.1)));
        this.world.addBody(cBody);

        elev.cabinGroup = cabinGroup;
        elev.cabinBody = cBody;
        elev.doorLeft = dLeft;
        elev.doorRight = dRight;
        elev.doorWidth = dW;

        this.elevators.push(elev);
        return elev;
    }

    selectFloor(floorNum, isAutoCall = false) {
        const elev = this.activeElevator;
        if (!elev) return;

        const targetIdx = elev.floors.findIndex(f => f.floor === floorNum);
        if (targetIdx === -1 || targetIdx === elev.currentFloorIndex) return;

        elev.targetFloorIndex = targetIdx;
        elev.startY = elev.currentY;
        elev.destY = elev.floors[targetIdx].y;
        elev.moveProgress = 0.0;
        elev.state = 'DOORS_CLOSING';

        this.updateFloorButtonsUI(elev);
    }

    updateFloorButtonsUI(elev) {
        if (!this.floorButtonsContainer) {
            this.floorButtonsContainer = document.getElementById('elevator-floor-buttons');
        }
        if (!this.floorButtonsContainer || !elev) return;

        // Если сменилось здание, пересобираем кнопки под текущие этажи
        if (this.currentRenderedElevator !== elev) {
            this.currentRenderedElevator = elev;
            this.floorButtonsContainer.innerHTML = '';
            for (let i = 0; i < elev.floors.length; i++) {
                const fl = elev.floors[i];
                const btn = document.createElement('button');
                btn.type = 'button';
                const isHeliFloor = (fl.name && fl.name.includes('Helipad')) || (fl.floor === 10);
                btn.className = 'elevator-floor-btn' + (isHeliFloor ? ' heli-floor-btn' : '');
                btn.dataset.floor = fl.floor;
                btn.title = `${fl.floor} этаж: ${fl.name}`;
                btn.innerHTML = isHeliFloor ? `${fl.floor} 🚁` : `${fl.floor}`;
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    this.selectFloor(fl.floor);
                });
                this.floorButtonsContainer.appendChild(btn);
            }
        }

        const btns = this.floorButtonsContainer.querySelectorAll('.elevator-floor-btn');
        btns.forEach((btn, idx) => {
            btn.classList.remove('current-floor', 'target-floor');
            if (idx === elev.currentFloorIndex) {
                btn.classList.add('current-floor');
            }
            if (elev.targetFloorIndex !== undefined && idx === elev.targetFloorIndex && elev.targetFloorIndex !== elev.currentFloorIndex) {
                btn.classList.add('target-floor');
            }
        });
    }

    update(deltaTime, player) {
        const dt = Math.min(deltaTime, 0.1);
        let playerNearAnyElevator = false;

        for (let i = 0; i < this.elevators.length; i++) {
            const elev = this.elevators[i];
            const cW = elev.cW;
            const cD = elev.cD;

            let isNearOutside = false;
            let playerTargetFloor = -1;

            if (player && player.body) {
                const pPos = player.body.position;
                const dy = pPos.y - (elev.currentY + 0.8);
                const isSameHeight = Math.abs(dy) < 2.5;
                const dx = pPos.x - elev.shaftX;
                const dz = pPos.z - elev.shaftZ;

                elev.isPlayerInside = (isSameHeight && Math.abs(dx) < (cW / 2 - 0.2) && Math.abs(dz) < (cD / 2 - 0.2));

                // Проверка этажа снаружи
                for (let f = 0; f < elev.floors.length; f++) {
                    const flY = elev.floors[f].y;
                    if (Math.abs(pPos.y - flY) < 2.2) {
                        const entranceZ = elev.shaftZ - cD / 2;
                        const distToDoor = Math.hypot(pPos.x - elev.shaftX, pPos.z - entranceZ);
                        if (distToDoor < 4.5 && pPos.z < entranceZ + 0.8) {
                            isNearOutside = true;
                            playerTargetFloor = f;
                        }
                        break;
                    }
                }

                if (elev.isPlayerInside || isNearOutside) {
                    this.activeElevator = elev;
                    playerNearAnyElevator = true;
                }

                // Автоматический вызов лифта при подходе
                if (isNearOutside && playerTargetFloor >= 0 && playerTargetFloor !== elev.currentFloorIndex && elev.state === 'IDLE') {
                    elev.targetFloorIndex = playerTargetFloor;
                    elev.startY = elev.currentY;
                    elev.destY = elev.floors[playerTargetFloor].y;
                    elev.moveProgress = 0.0;
                    elev.state = 'DOORS_CLOSING';
                }

                // Отображение UI
                if (elev.isPlayerInside) {
                    if (this.hudPromptElement) {
                        this.hudPromptElement.style.display = 'block';
                        this.hudPromptElement.classList.add('active');
                        if (this.hudTitleElement) this.hudTitleElement.innerText = elev.name;
                        if (elev.state === 'IDLE' && this.hudStatusElement) {
                            this.hudStatusElement.innerText = `Текущий: ${elev.floors[elev.currentFloorIndex].floor} этаж — ${elev.floors[elev.currentFloorIndex].name}`;
                        }
                        this.updateFloorButtonsUI(elev);
                    }
                }
            }

            // Машина состояний дверей и движения
            if (elev.state === 'IDLE') {
                if (isNearOutside && playerTargetFloor === elev.currentFloorIndex) {
                    if (elev.doorProgress < 1.0) elev.state = 'DOORS_OPENING';
                    elev.insideStayTimer = 0.0;
                } else if (elev.isPlayerInside) {
                    elev.insideStayTimer += dt;
                    if (elev.insideStayTimer > 1.8 && elev.doorProgress > 0.0) {
                        elev.state = 'DOORS_CLOSING';
                    }
                } else {
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
                // Если двери открыты (> 0.5), убираем коллизию барьера под пол
                if (this.doorBarrierBody) {
                    if (this.doorProgress > 0.5 && this.state !== 'MOVING') {
                        this.doorBarrierBody.position.y = -100.0;
                    } else {
                        this.doorBarrierBody.position.y = this.currentY + 1.8;
                    }
                }
            }
        }
