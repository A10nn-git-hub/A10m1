/**
 * STEP 32: Комплексный процедурный генератор районов открытого мира (Downtown, Industrial, Commercial)
 * - Downtown: гигантские стеклянные небоскребы с открытыми вестибюлями на 1 этаже, стойками ресепшен и скоростными лифтами на крышу/вертодромы!
 * - Industrial: кирпичные фабрики и логистические склады со свободными въездными воротами, рампами и интерьерами.
 * - Commercial: магазины и торговые центры со свободными входами, витринами, кассовыми зонами и неоновыми вывесками.
 * - Полная поддержка High-LOD геометрии, коллизий Cannon.js и скоростных лифтовых кабин!
 */
class DistrictGenerator {
    constructor(scene, world, physicsMaterials, chunkManager) {
        this.scene = scene;
        this.world = world;
        this.physicsMaterials = physicsMaterials;
        this.chunkManager = chunkManager;

        this.elevators = [];
        this.promptElement = null;

        this.initMaterials();
        this.initUI();
        this.generateDistricts();
    }

    initUI() {
        let el = document.getElementById('tower-elevator-prompt');
        if (!el) {
            el = document.createElement('div');
            el.id = 'tower-elevator-prompt';
            el.style.cssText = `
                position: fixed;
                bottom: 120px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(15, 23, 42, 0.88);
                border: 2px solid #38bdf8;
                border-radius: 12px;
                color: #ffffff;
                font-family: 'Segoe UI', system-ui, sans-serif;
                font-size: 16px;
                font-weight: 600;
                padding: 10px 22px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 15px rgba(56, 189, 248, 0.4);
                display: none;
                z-index: 9999;
                pointer-events: none;
                text-align: center;
                backdrop-filter: blur(8px);
                transition: opacity 0.2s ease;
            `;
            document.body.appendChild(el);
        }
        this.promptElement = el;
    }

    initMaterials() {
        // Атласы остекления небоскребов (Sapphire, Emerald, Bronze, Obsidian)
        this.skyscraperMats = [];
        for (let i = 0; i < 4; i++) {
            this.skyscraperMats.push(new THREE.MeshLambertMaterial({
                map: ProceduralTextureFactory.createSkyscraperAtlas(i)
            }));
        }

        // Индустриальные материалы
        this.matIndustrialBrick = new THREE.MeshLambertMaterial({
            map: ProceduralTextureFactory.createIndustrialBrickAtlas()
        });
        this.matCorrugatedSteel = new THREE.MeshLambertMaterial({
            map: ProceduralTextureFactory.createCorrugatedSteelTexture('#525e75')
        });
        this.matCorrugatedWarehouse = new THREE.MeshLambertMaterial({
            map: ProceduralTextureFactory.createCorrugatedSteelTexture('#64748b')
        });
        this.matChainLinkFence = new THREE.MeshLambertMaterial({
            map: ProceduralTextureFactory.createChainLinkFenceTexture(),
            transparent: true,
            alphaTest: 0.25,
            side: THREE.DoubleSide
        });

        // Материалы морских контейнеров
        this.containerMats = [
            new THREE.MeshLambertMaterial({ color: 0xb91c1c }),
            new THREE.MeshLambertMaterial({ color: 0x1d4ed8 }),
            new THREE.MeshLambertMaterial({ color: 0x15803d }),
            new THREE.MeshLambertMaterial({ color: 0xd97706 })
        ];

        // Коммерческие неоновые вывески и фасады (7 типов магазинов)
        this.commercialNeonMats = [];
        this.commercialDisplayMats = [];
        for (let s = 0; s < 7; s++) {
            this.commercialNeonMats.push(new THREE.MeshLambertMaterial({
                map: ProceduralTextureFactory.createCommercialNeonAtlas(s),
                emissive: new THREE.Color(0xffffff),
                emissiveIntensity: 0.8
            }));
            this.commercialDisplayMats.push(new THREE.MeshLambertMaterial({
                map: ProceduralTextureFactory.createStorefrontDisplayTexture(s)
            }));
        }

        // Архитектурные детали и интерьеры
        this.matHelipad = new THREE.MeshLambertMaterial({
            map: ProceduralTextureFactory.createHelipadTexture()
        });
        this.matConcrete = new THREE.MeshLambertMaterial({ color: 0x334155 });
        this.matLobbyFloor = new THREE.MeshLambertMaterial({ map: ProceduralTextureFactory.createMarbleFloorTexture() });
        this.matShopFloor = new THREE.MeshLambertMaterial({ map: ProceduralTextureFactory.createMarbleFloorTexture() });
        this.matRoofGravel = new THREE.MeshLambertMaterial({ color: 0x1e293b });
        this.matSteelStructure = new THREE.MeshLambertMaterial({ color: 0xd4d4d8 });
        this.matBeaconRed = new THREE.MeshBasicMaterial({ color: 0xff1744 });
        this.matCanopyOrange = new THREE.MeshLambertMaterial({ color: 0xe65100 });
        this.matCanopyBlue = new THREE.MeshLambertMaterial({ color: 0x0284c7 });
        this.matCanopyGreen = new THREE.MeshLambertMaterial({ color: 0x16a34a });
        this.matCommercialWall = new THREE.MeshLambertMaterial({ color: 0x3f3f46 });
        this.matGlassDoor = new THREE.MeshLambertMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.45 });
        this.matElevatorGlow = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        this.matCounterWood = new THREE.MeshLambertMaterial({ color: 0x451a03 });

        // Low LOD прокси-материалы для 60 FPS на горизонте
        this.proxyDowntown = new THREE.MeshBasicMaterial({ color: 0x1e293b });
        this.proxyIndustrial = new THREE.MeshBasicMaterial({ color: 0x332924 });
        this.proxyCommercial = new THREE.MeshBasicMaterial({ color: 0x27272a });
    }

    generateDistricts() {
        const gridRadius = 2;
        for (let gx = -gridRadius; gx <= gridRadius; gx++) {
            for (let gz = -gridRadius; gz <= gridRadius; gz++) {
                const px = gx * 60.0;
                const pz = gz * 60.0;

                // Пропускаем центральные кварталы с Maze Bank Tower, LSPD, Hospital
                if (Math.abs(gx) <= 1 && Math.abs(gz) <= 1) continue;

                const absX = Math.abs(gx);
                const absZ = Math.abs(gz);

                if (absX >= 2 && absZ <= 1) {
                    // Деловой квартал (Небоскребы со свободным входом и лифтами)
                    this.buildDowntownTower(gx, gz, px, pz);
                } else if (absX <= 1 && absZ >= 2) {
                    // Коммерческий сектор и индустриальные склады со свободным входом
                    if (gz > 0) {
                        this.buildCommercialPlaza(gx, gz, px, pz);
                    } else {
                        this.buildIndustrialDepot(gx, gz, px, pz);
                    }
                }
            }
        }
    }

    getDeterministicHash(cx, cz) {
        return Math.abs(Math.sin(cx * 12.9898 + cz * 78.233 + 42.1) * 43758.5453);
    }

    buildDowntownTower(cx, cz, px, pz) {
        const hash = this.getDeterministicHash(cx, cz);
        const themeIdx = Math.floor(hash * 5) % 4;

        const bW = 24.0 + (Math.floor(hash * 7) % 10);
        const bD = 24.0 + (Math.floor(hash * 13) % 10);
        const bH = 45.0 + (Math.floor(hash * 23) % 65); // Высота 45м - 110м
        const roofType = Math.floor(hash * 17) % 4;
        const lobbyH = 4.5;
        const doorW = 5.0;

        const highGroup = new THREE.Group();
        highGroup.position.set(px, 0, pz);

        // 1. Верхний стеклянный корпус небоскреба (начиная с 4.5м)
        const upperH = bH - lobbyH;
        const towerGeo = new THREE.BoxGeometry(bW, upperH, bD);
        const towerMesh = new THREE.Mesh(towerGeo, this.skyscraperMats[themeIdx]);
        towerMesh.position.set(0, lobbyH + upperH / 2, 0);
        towerMesh.castShadow = true; towerMesh.receiveShadow = true;
        highGroup.add(towerMesh);

        // 2. Вестибюль 1-го этажа: пол из полированного мрамора
        const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(bW - 0.4, bD - 0.4), this.matLobbyFloor);
        floorMesh.rotation.x = -Math.PI / 2;
        floorMesh.position.y = 0.05;
        floorMesh.receiveShadow = true;
        highGroup.add(floorMesh);

        // Потолок вестибюля
        const ceilMesh = new THREE.Mesh(new THREE.BoxGeometry(bW, 0.4, bD), this.matConcrete);
        ceilMesh.position.y = lobbyH - 0.2;
        highGroup.add(ceilMesh);

        // Стены вестибюля (Задняя, Левая, Правая, Фасадная с широким проемом входа)
        const segW = (bW - doorW) / 2;
        const wallThick = 0.4;

        const bWall = new THREE.Mesh(new THREE.BoxGeometry(bW, lobbyH, wallThick), this.matConcrete);
        bWall.position.set(0, lobbyH / 2, -bD / 2);
        highGroup.add(bWall);

        const lWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, lobbyH, bD), this.matConcrete);
        lWall.position.set(-bW / 2, lobbyH / 2, 0);
        highGroup.add(lWall);

        const rWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, lobbyH, bD), this.matConcrete);
        rWall.position.set(bW / 2, lobbyH / 2, 0);
        highGroup.add(rWall);

        const fLeft = new THREE.Mesh(new THREE.BoxGeometry(segW, lobbyH, wallThick), this.matConcrete);
        fLeft.position.set(-(doorW / 2 + segW / 2), lobbyH / 2, bD / 2);
        highGroup.add(fLeft);

        const fRight = new THREE.Mesh(new THREE.BoxGeometry(segW, lobbyH, wallThick), this.matConcrete);
        fRight.position.set(doorW / 2 + segW / 2, lobbyH / 2, bD / 2);
        highGroup.add(fRight);

        // Козырек над входом
        const canopy = new THREE.Mesh(new THREE.BoxGeometry(doorW + 2.0, 0.3, 3.0), this.matSteelStructure);
        canopy.position.set(0, lobbyH - 0.3, bD / 2 + 1.5);
        highGroup.add(canopy);

        // Стойка ресепшен внутри вестибюля
        const desk = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.1, 1.2), this.matCounterWood);
        desk.position.set(-bW / 4, 0.55, 0);
        highGroup.add(desk);

        // Внутреннее освещение вестибюля
        const lobbyLight = new THREE.PointLight(0xfffaed, 2.0, 16);
        lobbyLight.position.set(0, lobbyH - 0.6, 0);
        highGroup.add(lobbyLight);

        // 3. Лифтовая кабина/портал в вестибюле
        const elevPadGeo = new THREE.BoxGeometry(3.2, 0.1, 3.2);
        const elevPadMesh = new THREE.Mesh(elevPadGeo, this.matElevatorGlow);
        elevPadMesh.position.set(bW / 4, 0.06, 0);
        highGroup.add(elevPadMesh);

        const elevPortal = new THREE.Mesh(new THREE.BoxGeometry(3.6, lobbyH - 0.5, 0.3), this.matSteelStructure);
        elevPortal.position.set(bW / 4, (lobbyH - 0.5) / 2, -1.6);
        highGroup.add(elevPortal);

        // 4. Угловые стальные колонны и верхний парапет
        const cornerGeo = new THREE.BoxGeometry(0.8, bH + 1.2, 0.8);
        const corners = [
            { x: -bW / 2, z: -bD / 2 }, { x: bW / 2, z: -bD / 2 },
            { x: -bW / 2, z: bD / 2 }, { x: bW / 2, z: bD / 2 }
        ];
        for (const c of corners) {
            const cMesh = new THREE.Mesh(cornerGeo, this.matSteelStructure);
            cMesh.position.set(c.x, (bH + 1.2) / 2, c.z);
            highGroup.add(cMesh);
        }

        // 5. Уникальные надстройки крыши (Roof Structures) + выход лифта на крышу
        let extraHeight = 0;
        if (roofType === 0) {
            // Вертолетная площадка
            const hpW = Math.min(bW - 2.0, 20.0);
            const hpD = Math.min(bD - 2.0, 20.0);
            const hpMesh = new THREE.Mesh(new THREE.BoxGeometry(hpW, 1.2, hpD), this.matHelipad);
            hpMesh.position.set(0, bH + 0.6, 0);
            hpMesh.receiveShadow = true;
            highGroup.add(hpMesh);

            for (let lx of [-hpW / 2 + 0.5, hpW / 2 - 0.5]) {
                for (let lz of [-hpD / 2 + 0.5, hpD / 2 - 0.5]) {
                    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), this.matBeaconRed);
                    beacon.position.set(lx, bH + 1.6, lz);
                    highGroup.add(beacon);
                }
            }
            extraHeight = 1.2;
        } else if (roofType === 1) {
            // Радиокоммуникационный шпиль
            const spireH = 22.0 + (Math.floor(hash * 9) % 14);
            const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(6.0, 3.0, 6.0), this.matConcrete);
            baseMesh.position.set(0, bH + 1.5, 0);
            highGroup.add(baseMesh);

            const mastGeo = new THREE.CylinderGeometry(0.2, 0.8, spireH, 8);
            const mastMesh = new THREE.Mesh(mastGeo, this.matSteelStructure);
            mastMesh.position.set(0, bH + 3.0 + spireH / 2, 0);
            highGroup.add(mastMesh);

            const redLight = new THREE.Mesh(new THREE.SphereGeometry(0.65, 10, 10), this.matBeaconRed);
            redLight.position.set(0, bH + 3.0 + spireH + 0.3, 0);
            highGroup.add(redLight);
            extraHeight = 3.0 + spireH;
        } else if (roofType === 2) {
            // Ступенчатая корона Арт-Деко
            const tier1 = new THREE.Mesh(new THREE.BoxGeometry(bW * 0.75, 4.0, bD * 0.75), this.skyscraperMats[themeIdx]);
            tier1.position.set(0, bH + 2.0, 0);
            highGroup.add(tier1);

            const tier2 = new THREE.Mesh(new THREE.BoxGeometry(bW * 0.5, 3.5, bD * 0.5), this.skyscraperMats[themeIdx]);
            tier2.position.set(0, bH + 5.75, 0);
            highGroup.add(tier2);

            const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.5, 8.0, 8), this.matSteelStructure);
            spire.position.set(0, bH + 11.5, 0);
            highGroup.add(spire);
            extraHeight = 15.5;
        } else {
            // Пентхаус с чиллерами
            const phW = bW * 0.6; const phD = bD * 0.6; const phH = 4.5;
            const phMesh = new THREE.Mesh(new THREE.BoxGeometry(phW, phH, phD), this.matConcrete);
            phMesh.position.set(0, bH + phH / 2, 0);
            highGroup.add(phMesh);

            for (let cx of [-phW / 3, phW / 3]) {
                for (let cz of [-phD / 3, phD / 3]) {
                    const ac = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 1.4, 12), this.matSteelStructure);
                    ac.position.set(cx, bH + phH + 0.7, cz);
                    highGroup.add(ac);
                }
            }
            extraHeight = phH + 1.4;
        }

        // Выходной тамбур лифта на крыше
        const roofBooth = new THREE.Mesh(new THREE.BoxGeometry(4.0, 3.2, 4.0), this.matSteelStructure);
        roofBooth.position.set(bW / 4, bH + 1.6, 0);
        highGroup.add(roofBooth);

        const roofElevPad = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 3.0), this.matElevatorGlow);
        roofElevPad.position.set(bW / 4, bH + 0.1, 0);
        highGroup.add(roofElevPad);

        // Регистрация интерактивного скоростного лифта небоскреба
        this.elevators.push({
            name: `НЕБОСКРЕБ DOWNTOWN (${Math.round(bH)}м)`,
            bottomX: px + bW / 4,
            bottomY: 0.0,
            bottomZ: pz,
            topX: px + bW / 4,
            topY: bH + 0.5,
            topZ: pz,
            bH: bH
        });

        // 6. Полноценная полая физическая модель Cannon.js (свободный вход в вестибюль + твердые стены + твердая крыша)
        const body = new CANNON.Body({
            mass: 0,
            material: this.physicsMaterials.wall,
            position: new CANNON.Vec3(px, 0, pz)
        });

        // Стены вестибюля
        body.addShape(new CANNON.Box(new CANNON.Vec3(bW / 2, lobbyH / 2, wallThick / 2)), new CANNON.Vec3(0, lobbyH / 2, -bD / 2));
        body.addShape(new CANNON.Box(new CANNON.Vec3(wallThick / 2, lobbyH / 2, bD / 2)), new CANNON.Vec3(-bW / 2, lobbyH / 2, 0));
        body.addShape(new CANNON.Box(new CANNON.Vec3(wallThick / 2, lobbyH / 2, bD / 2)), new CANNON.Vec3(bW / 2, lobbyH / 2, 0));
        body.addShape(new CANNON.Box(new CANNON.Vec3(segW / 2, lobbyH / 2, wallThick / 2)), new CANNON.Vec3(-(doorW / 2 + segW / 2), lobbyH / 2, bD / 2));
        body.addShape(new CANNON.Box(new CANNON.Vec3(segW / 2, lobbyH / 2, wallThick / 2)), new CANNON.Vec3(doorW / 2 + segW / 2, lobbyH / 2, bD / 2));

        // Верхний массив здания
        body.addShape(new CANNON.Box(new CANNON.Vec3(bW / 2, upperH / 2, bD / 2)), new CANNON.Vec3(0, lobbyH + upperH / 2, 0));

        // Перекрытие крыши / вертолетной площадки
        body.addShape(new CANNON.Box(new CANNON.Vec3(bW / 2 + 0.2, 0.6, bD / 2 + 0.2)), new CANNON.Vec3(0, bH + 0.3, 0));

        if (this.chunkManager) {
            this.chunkManager.registerHighLOD(cx, cz, highGroup);
            const proxyMesh = new THREE.Mesh(new THREE.BoxGeometry(bW, bH + extraHeight * 0.5, bD), this.proxyDowntown);
            proxyMesh.position.set(px, (bH + extraHeight * 0.5) / 2, pz);
            this.chunkManager.registerLowLOD(cx, cz, proxyMesh);
            this.chunkManager.registerPhysicsBody(cx, cz, body);
        } else {
            this.scene.add(highGroup);
            this.world.addBody(body);
        }
    }

    buildIndustrialDepot(cx, cz, px, pz) {
        const hash = this.getDeterministicHash(cx, cz);
        const lotType = Math.floor(hash * 3) % 2;

        const highGroup = new THREE.Group();
        highGroup.position.set(px, 0, pz);

        if (lotType === 0) {
            // ЛОТ 0: Тяжелый кирпичный завод со свободным въездом
            const fW = 34.0; const fD = 24.0; const fH = 11.0;
            const doorW = 7.0; const doorH = 5.5;

            // Пол интерьера завода
            const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(fW - 0.4, fD - 0.4), this.matConcrete);
            floorMesh.rotation.x = -Math.PI / 2;
            floorMesh.position.set(-5, 0.05, 0);
            floorMesh.receiveShadow = true;
            highGroup.add(floorMesh);

            // Стены с широким въездным проемом спереди
            const fSegW = (fW - doorW) / 2;
            const wThick = 0.5;

            const bWall = new THREE.Mesh(new THREE.BoxGeometry(fW, fH, wThick), this.matIndustrialBrick);
            bWall.position.set(-5, fH / 2, -fD / 2); highGroup.add(bWall);

            const lWall = new THREE.Mesh(new THREE.BoxGeometry(wThick, fH, fD), this.matIndustrialBrick);
            lWall.position.set(-5 - fW / 2, fH / 2, 0); highGroup.add(lWall);

            const rWall = new THREE.Mesh(new THREE.BoxGeometry(wThick, fH, fD), this.matIndustrialBrick);
            rWall.position.set(-5 + fW / 2, fH / 2, 0); highGroup.add(rWall);

            const fLeft = new THREE.Mesh(new THREE.BoxGeometry(fSegW, fH, wThick), this.matIndustrialBrick);
            fLeft.position.set(-5 - (doorW / 2 + fSegW / 2), fH / 2, fD / 2); highGroup.add(fLeft);

            const fRight = new THREE.Mesh(new THREE.BoxGeometry(fSegW, fH, wThick), this.matIndustrialBrick);
            fRight.position.set(-5 + (doorW / 2 + fSegW / 2), fH / 2, fD / 2); highGroup.add(fRight);

            const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW, fH - doorH, wThick), this.matIndustrialBrick);
            lintel.position.set(-5, doorH + (fH - doorH) / 2, fD / 2); highGroup.add(lintel);

            // Перекрытие крыши
            const roof = new THREE.Mesh(new THREE.BoxGeometry(fW + 0.6, 0.5, fD + 0.6), this.matCorrugatedSteel);
            roof.position.set(-5, fH + 0.25, 0); highGroup.add(roof);

            // 3 треугольных конька крыши
            for (let s = 0; s < 3; s++) {
                const sawTooth = new THREE.Mesh(new THREE.ConeGeometry(5.0, 3.5, 4), this.matCorrugatedSteel);
                sawTooth.rotation.y = Math.PI / 4;
                sawTooth.position.set(-15 + s * 10, fH + 1.75, 0);
                highGroup.add(sawTooth);
            }

            // Высокая дымоходная труба
            const stackH = 38.0 + (Math.floor(hash * 11) % 10);
            const stackGeo = new THREE.CylinderGeometry(1.6, 2.8, stackH, 16);
            const stackMesh = new THREE.Mesh(stackGeo, this.matIndustrialBrick);
            stackMesh.position.set(18, stackH / 2, -7);
            stackMesh.castShadow = true;
            highGroup.add(stackMesh);

            const stackLight = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), this.matBeaconRed);
            stackLight.position.set(18, stackH + 0.3, -7);
            highGroup.add(stackLight);

            // Внутреннее освещение цеха
            const indLight = new THREE.PointLight(0xfffaed, 2.5, 22);
            indLight.position.set(-5, fH - 1.5, 0);
            highGroup.add(indLight);

            this.addChainLinkFence(highGroup, 54.0, 54.0);

            // Полая физика с проходом
            const bodyF = new CANNON.Body({ mass: 0, material: this.physicsMaterials.wall, position: new CANNON.Vec3(px - 5, 0, pz) });
            bodyF.addShape(new CANNON.Box(new CANNON.Vec3(fW / 2, fH / 2, wThick / 2)), new CANNON.Vec3(0, fH / 2, -fD / 2));
            bodyF.addShape(new CANNON.Box(new CANNON.Vec3(wThick / 2, fH / 2, fD / 2)), new CANNON.Vec3(-fW / 2, fH / 2, 0));
            bodyF.addShape(new CANNON.Box(new CANNON.Vec3(wThick / 2, fH / 2, fD / 2)), new CANNON.Vec3(fW / 2, fH / 2, 0));
            bodyF.addShape(new CANNON.Box(new CANNON.Vec3(fSegW / 2, fH / 2, wThick / 2)), new CANNON.Vec3(-(doorW / 2 + fSegW / 2), fH / 2, fD / 2));
            bodyF.addShape(new CANNON.Box(new CANNON.Vec3(fSegW / 2, fH / 2, wThick / 2)), new CANNON.Vec3(doorW / 2 + fSegW / 2, fH / 2, fD / 2));
            bodyF.addShape(new CANNON.Box(new CANNON.Vec3(fW / 2 + 0.3, 0.25, fD / 2 + 0.3)), new CANNON.Vec3(0, fH + 0.25, 0));

            const bodyS = new CANNON.Body({ mass: 0, material: this.physicsMaterials.wall, position: new CANNON.Vec3(px + 18, stackH / 2, pz - 7) });
            bodyS.addShape(new CANNON.Cylinder(1.6, 2.8, stackH, 12));

            if (this.chunkManager) {
                this.chunkManager.registerHighLOD(cx, cz, highGroup);
                this.chunkManager.registerPhysicsBody(cx, cz, bodyF);
                this.chunkManager.registerPhysicsBody(cx, cz, bodyS);
            } else {
                this.scene.add(highGroup);
                this.world.addBody(bodyF);
                this.world.addBody(bodyS);
            }
        } else {
            // ЛОТ 1: Логистический склад со свободной рампой и воротами
            const wW = 36.0; const wD = 26.0; const wH = 9.5;
            const doorW = 8.0; const doorH = 5.0;
            const wThick = 0.5;

            // Пол склада
            const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(wW - 0.4, wD - 0.4), this.matConcrete);
            floorMesh.rotation.x = -Math.PI / 2;
            floorMesh.position.set(-6, 0.05, 0);
            floorMesh.receiveShadow = true;
            highGroup.add(floorMesh);

            // Стены склада с открытыми воротами
            const fSegW = (wW - doorW) / 2;
            const bWall = new THREE.Mesh(new THREE.BoxGeometry(wW, wH, wThick), this.matCorrugatedWarehouse);
            bWall.position.set(-6, wH / 2, -wD / 2); highGroup.add(bWall);

            const lWall = new THREE.Mesh(new THREE.BoxGeometry(wThick, wH, wD), this.matCorrugatedWarehouse);
            lWall.position.set(-6 - wW / 2, wH / 2, 0); highGroup.add(lWall);

            const rWall = new THREE.Mesh(new THREE.BoxGeometry(wThick, wH, wD), this.matCorrugatedWarehouse);
            rWall.position.set(-6 + wW / 2, wH / 2, 0); highGroup.add(rWall);

            const fLeft = new THREE.Mesh(new THREE.BoxGeometry(fSegW, wH, wThick), this.matCorrugatedWarehouse);
            fLeft.position.set(-6 - (doorW / 2 + fSegW / 2), wH / 2, wD / 2); highGroup.add(fLeft);

            const fRight = new THREE.Mesh(new THREE.BoxGeometry(fSegW, wH, wThick), this.matCorrugatedWarehouse);
            fRight.position.set(-6 + (doorW / 2 + fSegW / 2), wH / 2, wD / 2); highGroup.add(fRight);

            const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW, wH - doorH, wThick), this.matCorrugatedWarehouse);
            lintel.position.set(-6, doorH + (wH - doorH) / 2, wD / 2); highGroup.add(lintel);

            const roof = new THREE.Mesh(new THREE.BoxGeometry(wW + 0.6, 0.5, wD + 0.6), this.matCorrugatedSteel);
            roof.position.set(-6, wH + 0.25, 0); highGroup.add(roof);

            // Погрузочная рампа
            const dockMesh = new THREE.Mesh(new THREE.BoxGeometry(doorW + 4.0, 0.6, 3.0), this.matConcrete);
            dockMesh.position.set(-6, 0.3, wD / 2 + 1.5);
            highGroup.add(dockMesh);

            // Освещение склада
            const whLight = new THREE.PointLight(0xfffaed, 2.2, 20);
            whLight.position.set(-6, wH - 1.5, 0);
            highGroup.add(whLight);

            // Контейнеры на улице
            for (let i = 0; i < 4; i++) {
                const matC = this.containerMats[(i + Math.floor(hash * 7)) % this.containerMats.length];
                const cMesh = new THREE.Mesh(new THREE.BoxGeometry(12.0, 2.6, 2.6), matC);
                cMesh.position.set(16, 1.3 + (i % 2) * 2.6, -10 + Math.floor(i / 2) * 12);
                cMesh.castShadow = true;
                highGroup.add(cMesh);
            }

            this.addChainLinkFence(highGroup, 54.0, 54.0);

            // Полая физика склада
            const bodyW = new CANNON.Body({ mass: 0, material: this.physicsMaterials.wall, position: new CANNON.Vec3(px - 6, 0, pz) });
            bodyW.addShape(new CANNON.Box(new CANNON.Vec3(wW / 2, wH / 2, wThick / 2)), new CANNON.Vec3(0, wH / 2, -wD / 2));
            bodyW.addShape(new CANNON.Box(new CANNON.Vec3(wThick / 2, wH / 2, wD / 2)), new CANNON.Vec3(-wW / 2, wH / 2, 0));
            bodyW.addShape(new CANNON.Box(new CANNON.Vec3(wThick / 2, wH / 2, wD / 2)), new CANNON.Vec3(wW / 2, wH / 2, 0));
            bodyW.addShape(new CANNON.Box(new CANNON.Vec3(fSegW / 2, wH / 2, wThick / 2)), new CANNON.Vec3(-(doorW / 2 + fSegW / 2), wH / 2, wD / 2));
            bodyW.addShape(new CANNON.Box(new CANNON.Vec3(fSegW / 2, wH / 2, wThick / 2)), new CANNON.Vec3(doorW / 2 + fSegW / 2, wH / 2, wD / 2));
            bodyW.addShape(new CANNON.Box(new CANNON.Vec3(wW / 2 + 0.3, 0.25, wD / 2 + 0.3)), new CANNON.Vec3(0, wH + 0.25, 0));

            const bodyC = new CANNON.Body({ mass: 0, material: this.physicsMaterials.wall, position: new CANNON.Vec3(px + 16, 2.6, pz) });
            bodyC.addShape(new CANNON.Box(new CANNON.Vec3(6.0, 2.6, 12.0)));

            if (this.chunkManager) {
                this.chunkManager.registerHighLOD(cx, cz, highGroup);
                this.chunkManager.registerPhysicsBody(cx, cz, bodyW);
                this.chunkManager.registerPhysicsBody(cx, cz, bodyC);
            } else {
                this.scene.add(highGroup);
                this.world.addBody(bodyW);
                this.world.addBody(bodyC);
            }
        }
    }

    addChainLinkFence(parentGroup, width, depth) {
        const fenceH = 2.4;
        const fenceGeoX = new THREE.PlaneGeometry(width, fenceH);
        const fenceGeoZ = new THREE.PlaneGeometry(depth, fenceH);

        const fN = new THREE.Mesh(fenceGeoX, this.matChainLinkFence);
        fN.position.set(0, fenceH / 2, -depth / 2); parentGroup.add(fN);

        const fS = new THREE.Mesh(fenceGeoX, this.matChainLinkFence);
        fS.position.set(0, fenceH / 2, depth / 2); parentGroup.add(fS);

        const fW = new THREE.Mesh(fenceGeoZ, this.matChainLinkFence);
        fW.rotation.y = Math.PI / 2;
        fW.position.set(-width / 2, fenceH / 2, 0); parentGroup.add(fW);

        const fE = new THREE.Mesh(fenceGeoZ, this.matChainLinkFence);
        fE.rotation.y = Math.PI / 2;
        fE.position.set(width / 2, fenceH / 2, 0); parentGroup.add(fE);
    }

    buildCommercialPlaza(cx, cz, px, pz) {
        const hash = this.getDeterministicHash(cx, cz);
        const shopType = Math.floor(hash * 11) % 7;

        const bW = 26.0 + (Math.floor(hash * 7) % 8);
        const bD = 20.0 + (Math.floor(hash * 13) % 6);
        const bH = 8.0 + (Math.floor(hash * 5) % 4);
        const doorW = 4.8; const doorH = 4.2;
        const wThick = 0.4;

        const highGroup = new THREE.Group();
        highGroup.position.set(px, 0, pz);

        // 1. Пол интерьера магазина
        const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(bW - 0.4, bD - 0.4), this.matShopFloor);
        floorMesh.rotation.x = -Math.PI / 2;
        floorMesh.position.y = 0.05;
        floorMesh.receiveShadow = true;
        highGroup.add(floorMesh);

        // 2. Стены магазина со свободным входом спереди
        const fSegW = (bW - doorW) / 2;
        const bWall = new THREE.Mesh(new THREE.BoxGeometry(bW, bH, wThick), this.matCommercialWall);
        bWall.position.set(0, bH / 2, -bD / 2); highGroup.add(bWall);

        const lWall = new THREE.Mesh(new THREE.BoxGeometry(wThick, bH, bD), this.matCommercialWall);
        lWall.position.set(-bW / 2, bH / 2, 0); highGroup.add(lWall);

        const rWall = new THREE.Mesh(new THREE.BoxGeometry(wThick, bH, bD), this.matCommercialWall);
        rWall.position.set(bW / 2, bH / 2, 0); highGroup.add(rWall);

        const fLeft = new THREE.Mesh(new THREE.BoxGeometry(fSegW, bH, wThick), this.matCommercialWall);
        fLeft.position.set(-(doorW / 2 + fSegW / 2), bH / 2, bD / 2); highGroup.add(fLeft);

        const fRight = new THREE.Mesh(new THREE.BoxGeometry(fSegW, bH, wThick), this.matCommercialWall);
        fRight.position.set(doorW / 2 + fSegW / 2, bH / 2, bD / 2); highGroup.add(fRight);

        const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW, bH - doorH, wThick), this.matCommercialWall);
        lintel.position.set(0, doorH + (bH - doorH) / 2, bD / 2); highGroup.add(lintel);

        const roof = new THREE.Mesh(new THREE.BoxGeometry(bW + 0.6, 0.4, bD + 0.6), this.matConcrete);
        roof.position.set(0, bH + 0.2, 0); highGroup.add(roof);

        // 3. Кассовая стойка и витрина внутри магазина
        const counter = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.1, 1.2), this.matCounterWood);
        counter.position.set(-bW / 4, 0.55, 0);
        highGroup.add(counter);

        // Торговые стеллажи
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(8.0, 2.8, 1.4), this.matSteelStructure);
        shelf.position.set(bW / 4, 1.4, -bD / 4);
        highGroup.add(shelf);

        // Внутреннее освещение магазина
        const shopLight = new THREE.PointLight(0xfffaed, 2.0, 18);
        shopLight.position.set(0, bH - 1.2, 0);
        highGroup.add(shopLight);

        // 4. Неоновая вывеска магазина над входом
        const signW = Math.min(bW - 2.0, 18.0);
        const signH = 3.6;
        const signMesh = new THREE.Mesh(new THREE.BoxGeometry(signW, signH, 0.4), this.commercialNeonMats[shopType]);
        signMesh.position.set(0, bH - signH / 2 + 0.6, bD / 2 + 0.3);
        highGroup.add(signMesh);

        // 5. Тканевый козырек над входом
        const canopies = [this.matCanopyOrange, this.matCanopyBlue, this.matCanopyGreen];
        const canopyMat = canopies[shopType % canopies.length];
        const canopy = new THREE.Mesh(new THREE.BoxGeometry(doorW + 2.0, 0.4, 3.2), canopyMat);
        canopy.position.set(0, doorH + 0.4, bD / 2 + 1.6);
        canopy.rotation.x = 0.12;
        highGroup.add(canopy);

        // Кондиционеры на крыше
        const ac1 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 1.8), this.matSteelStructure);
        ac1.position.set(-bW / 4, bH + 0.7, -bD / 4); highGroup.add(ac1);

        const ac2 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.2, 1.6), this.matSteelStructure);
        ac2.position.set(bW / 4, bH + 0.6, bD / 4); highGroup.add(ac2);

        // Полая физика магазина
        const body = new CANNON.Body({
            mass: 0,
            material: this.physicsMaterials.wall,
            position: new CANNON.Vec3(px, 0, pz)
        });
        body.addShape(new CANNON.Box(new CANNON.Vec3(bW / 2, bH / 2, wThick / 2)), new CANNON.Vec3(0, bH / 2, -bD / 2));
        body.addShape(new CANNON.Box(new CANNON.Vec3(wThick / 2, bH / 2, bD / 2)), new CANNON.Vec3(-bW / 2, bH / 2, 0));
        body.addShape(new CANNON.Box(new CANNON.Vec3(wThick / 2, bH / 2, bD / 2)), new CANNON.Vec3(bW / 2, bH / 2, 0));
        body.addShape(new CANNON.Box(new CANNON.Vec3(fSegW / 2, bH / 2, wThick / 2)), new CANNON.Vec3(-(doorW / 2 + fSegW / 2), bH / 2, bD / 2));
        body.addShape(new CANNON.Box(new CANNON.Vec3(fSegW / 2, bH / 2, wThick / 2)), new CANNON.Vec3(doorW / 2 + fSegW / 2, bH / 2, bD / 2));
        body.addShape(new CANNON.Box(new CANNON.Vec3(bW / 2 + 0.3, 0.2, bD / 2 + 0.3)), new CANNON.Vec3(0, bH + 0.2, 0));

        if (this.chunkManager) {
            this.chunkManager.registerHighLOD(cx, cz, highGroup);
            this.chunkManager.registerPhysicsBody(cx, cz, body);
        } else {
            this.scene.add(highGroup);
            this.world.addBody(body);
        }
    }

    update(deltaTime, player) {
        if (!player || !player.body) {
            if (this.promptElement) this.promptElement.style.display = 'none';
            return;
        }

        const pPos = player.body.position;
        let activeElev = null;
        let isAtBottom = false;

        for (let i = 0; i < this.elevators.length; i++) {
            const el = this.elevators[i];
            const distB = Math.hypot(pPos.x - el.bottomX, pPos.z - el.bottomZ);
            if (distB < 2.5 && Math.abs(pPos.y - el.bottomY) < 2.5) {
                activeElev = el;
                isAtBottom = true;
                break;
            }
            const distT = Math.hypot(pPos.x - el.topX, pPos.z - el.topZ);
            if (distT < 2.5 && Math.abs(pPos.y - el.topY) < 3.0) {
                activeElev = el;
                isAtBottom = false;
                break;
            }
        }

        if (activeElev && this.promptElement) {
            this.promptElement.style.display = 'block';
            if (isAtBottom) {
                this.promptElement.innerHTML = `🛗 <b>[E]</b> Скоростной лифт на крышу (${Math.round(activeElev.bH)}м)`;
            } else {
                this.promptElement.innerHTML = `🛗 <b>[E]</b> Спуститься в вестибюль 1 этажа`;
            }

            // Проверка нажатия E
            if (window.inputManager && window.inputManager.isKeyJustPressed && window.inputManager.isKeyJustPressed('KeyE')) {
                if (isAtBottom) {
                    player.body.position.set(activeElev.topX, activeElev.topY + 0.5, activeElev.topZ);
                    player.body.velocity.set(0, 0, 0);
                    if (player.mesh) player.mesh.position.copy(player.body.position);
                    if (window.soundEngine && window.soundEngine.playElevatorBell) window.soundEngine.playElevatorBell();
                } else {
                    player.body.position.set(activeElev.bottomX, activeElev.bottomY + 0.5, activeElev.bottomZ + 1.0);
                    player.body.velocity.set(0, 0, 0);
                    if (player.mesh) player.mesh.position.copy(player.body.position);
                    if (window.soundEngine && window.soundEngine.playElevatorBell) window.soundEngine.playElevatorBell();
                }
            }
        } else if (this.promptElement) {
            this.promptElement.style.display = 'none';
        }
    }
}

window.DistrictGenerator = DistrictGenerator;
