/**
         * Строитель жилых домов с открывающимися дверьми, уютным интерьером и поддержкой LOD
         */
        class SuburbanHouseBuilder {
            constructor(scene, world, physicsMaterials, chunkManager = null) {
                this.scene = scene;
                this.world = world;
                this.physicsMaterials = physicsMaterials;
                this.chunkManager = chunkManager;
                this.doors = [];
                this.houses = [];

                this.materials = {
                    brick: new THREE.MeshLambertMaterial({ map: ProceduralTextureFactory.createBrickTexture() }),
                    sidingBeige: new THREE.MeshLambertMaterial({ map: ProceduralTextureFactory.createSidingTexture() }),
                    sidingBlue: new THREE.MeshLambertMaterial({ color: 0x2563eb }),
                    sidingOlive: new THREE.MeshLambertMaterial({ color: 0x4d7c0f }),
                    roof: new THREE.MeshLambertMaterial({ map: ProceduralTextureFactory.createRoofShingleTexture() }),
                    parquetFloor: new THREE.MeshLambertMaterial({ map: ProceduralTextureFactory.createMarbleFloorTexture() }),
                    carpetFloor: new THREE.MeshLambertMaterial({ color: 0x78350f }),
                    interiorWall: new THREE.MeshLambertMaterial({ color: 0xf1f5f9 }),
                    woodDoor: new THREE.MeshLambertMaterial({ color: 0x6b4423 }),
                    chromeHandle: new THREE.MeshLambertMaterial({ color: 0xffffff }),
                    sofaFabric: new THREE.MeshLambertMaterial({ color: 0x1e3a8a }),
                    tvScreen: new THREE.MeshBasicMaterial({ color: 0x0f172a }),
                    deskWood: new THREE.MeshLambertMaterial({ color: 0x451a03 }),
                    counterMat: new THREE.MeshLambertMaterial({ color: 0xe2e8f0 }),
                    ceilingLamp: new THREE.MeshBasicMaterial({ color: 0xfffbeb }),
                    grass: new THREE.MeshLambertMaterial({ map: ProceduralTextureFactory.createGrassTexture() }),
                    proxyHouse: new THREE.MeshBasicMaterial({ color: 0x64748b }),
                    proxyRoof: new THREE.MeshBasicMaterial({ color: 0x7c2d12 })
                };
            }

            createStaticBox(x, y, z, w, h, d, cx = null, cz = null) {
                const body = new CANNON.Body({
                    mass: 0,
                    material: this.physicsMaterials.wall,
                    position: new CANNON.Vec3(x, y, z)
                });
                body.allowSleep = true;
                body.sleep();
                body.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)));
                if (this.chunkManager && cx !== null && cz !== null) {
                    this.chunkManager.registerPhysicsBody(cx, cz, body);
                } else {
                    this.world.addBody(body);
                }
                return body;
            }

            createHouse(posX, posZ, rotationY = 0, styleIndex = 0) {
                const cx = Math.round(posX / 60.0);
                const cz = Math.round(posZ / 60.0);

                const group = new THREE.Group();
                group.position.set(posX, 0, posZ);
                group.rotation.y = rotationY;

                const houseW = 14.0;
                const houseH = 5.2;
                const houseD = 11.0;
                const wallThick = 0.4;
                const doorWidth = 1.6;
                const doorHeight = 3.0;

                const wallMaterials = [this.materials.sidingBeige, this.materials.brick, this.materials.sidingBlue, this.materials.sidingOlive];
                const exteriorMat = wallMaterials[styleIndex % wallMaterials.length];

                // 1. Зеленый газон вокруг дома
                const yardMesh = new THREE.Mesh(new THREE.BoxGeometry(26.0, 0.15, 24.0), this.materials.grass);
                yardMesh.position.set(0, 0.075, 0); yardMesh.receiveShadow = true;
                group.add(yardMesh);

                // 2. Пол дома (паркет/ламинат)
                const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(houseW - 0.2, houseD - 0.2), this.materials.parquetFloor);
                floorMesh.rotation.x = -Math.PI / 2;
                floorMesh.position.y = 0.16;
                floorMesh.receiveShadow = true;
                group.add(floorMesh);

                // 3. Потолок и скатная крыша
                const ceilMesh = new THREE.Mesh(new THREE.BoxGeometry(houseW + 0.6, 0.3, houseD + 0.6), this.materials.interiorWall);
                ceilMesh.position.y = houseH + 0.15;
                group.add(ceilMesh);

                const roofGeo = new THREE.ConeGeometry(Math.hypot(houseW + 2.0, houseD + 2.0) * 0.5, 3.4, 4);
                const roofMesh = new THREE.Mesh(roofGeo, this.materials.roof);
                roofMesh.position.set(0, houseH + 1.8, 0);
                roofMesh.rotation.y = Math.PI / 4;
                roofMesh.scale.set(1.0, 1.0, 0.82);
                roofMesh.castShadow = true;
                group.add(roofMesh);

                // 4. Внешние стены дома с дверным проемом спереди
                const backWall = new THREE.Mesh(new THREE.BoxGeometry(houseW, houseH, wallThick), exteriorMat);
                backWall.position.set(0, houseH / 2, houseD / 2);
                backWall.castShadow = true; backWall.receiveShadow = true;
                group.add(backWall);

                const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, houseH, houseD), exteriorMat);
                leftWall.position.set(-houseW / 2, houseH / 2, 0);
                leftWall.castShadow = true; leftWall.receiveShadow = true;
                group.add(leftWall);

                const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, houseH, houseD), exteriorMat);
                rightWall.position.set(houseW / 2, houseH / 2, 0);
                rightWall.castShadow = true; rightWall.receiveShadow = true;
                group.add(rightWall);

                const frontSegW = (houseW - doorWidth) / 2;
                const frontLeft = new THREE.Mesh(new THREE.BoxGeometry(frontSegW, houseH, wallThick), exteriorMat);
                frontLeft.position.set(-(doorWidth / 2 + frontSegW / 2), houseH / 2, -houseD / 2);
                frontLeft.castShadow = true; frontLeft.receiveShadow = true;
                group.add(frontLeft);

                const frontRight = new THREE.Mesh(new THREE.BoxGeometry(frontSegW, houseH, wallThick), exteriorMat);
                frontRight.position.set(doorWidth / 2 + frontSegW / 2, houseH / 2, -houseD / 2);
                frontRight.castShadow = true; frontRight.receiveShadow = true;
                group.add(frontRight);

                const doorLintel = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, houseH - doorHeight, wallThick), exteriorMat);
                doorLintel.position.set(0, doorHeight + (houseH - doorHeight) / 2, -houseD / 2);
                group.add(doorLintel);

                // 5. Интерактивная входная дверь на петле (автоматически открывается при приближении)
                const doorPivot = new THREE.Group();
                doorPivot.position.set(-doorWidth / 2, 0, -houseD / 2);

                const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(doorWidth * 0.96, doorHeight, 0.08), this.materials.woodDoor);
                doorMesh.position.set(doorWidth * 0.48, doorHeight / 2, 0);
                doorMesh.castShadow = true;
                doorPivot.add(doorMesh);

                const handleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.12), this.materials.chromeHandle);
                handleMesh.position.set(doorWidth * 0.85, doorHeight * 0.48, 0);
                doorPivot.add(handleMesh);

                group.add(doorPivot);

                // Регистрация двери в системе
                const cosR = Math.cos(rotationY); const sinR = Math.sin(rotationY);
                const doorWorldPos = new THREE.Vector3(
                    posX + cosR * (-doorWidth / 2) + sinR * (-houseD / 2),
                    0,
                    posZ - sinR * (-doorWidth / 2) + cosR * (-houseD / 2)
                );
                this.doors.push({
                    pivot: doorPivot,
                    pos: doorWorldPos,
                    targetAngle: 0,
                    currentAngle: 0,
                    maxAngle: Math.PI / 2.1,
                    openDist: 3.8
                });

                // 6. Внутренние перегородки и мебель (Гостиная, Кухня, Спальня)
                const innerWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, houseH, 6.0), this.materials.interiorWall);
                innerWall.position.set(0.5, houseH / 2, 2.2);
                group.add(innerWall);

                const sofa = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.85, 1.3), this.materials.sofaFabric);
                sofa.position.set(-3.5, 0.425, 1.5);
                group.add(sofa);

                const tvStand = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 0.8), this.materials.deskWood);
                tvStand.position.set(-3.5, 0.3, -3.5); group.add(tvStand);
                const tvScreen = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.2, 0.08), this.materials.tvScreen);
                tvScreen.position.set(-3.5, 1.3, -3.5); group.add(tvScreen);

                const kitchenCounter = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.0, 1.0), this.materials.counterMat);
                kitchenCounter.position.set(4.0, 0.5, -2.5);
                group.add(kitchenCounter);

                const bed = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.65, 3.4), this.materials.carpetFloor);
                bed.position.set(4.0, 0.325, 3.0);
                group.add(bed);

                const lamp1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.8), this.materials.ceilingLamp);
                lamp1.position.set(-3.5, houseH - 0.05, 0); group.add(lamp1);
                const lamp2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.8), this.materials.ceilingLamp);
                lamp2.position.set(3.5, houseH - 0.05, 0); group.add(lamp2);

                if (this.chunkManager) {
                    this.chunkManager.registerHighLOD(cx, cz, group);

                    // Low-poly proxy mesh для дальних дистанций (LOD)
                    const proxyGroup = new THREE.Group();
                    proxyGroup.position.set(posX, 0, posZ);
                    proxyGroup.rotation.y = rotationY;

                    const proxyBase = new THREE.Mesh(new THREE.BoxGeometry(houseW, houseH, houseD), this.materials.proxyHouse);
                    proxyBase.position.set(0, houseH / 2, 0);
                    proxyGroup.add(proxyBase);

                    const proxyRoof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(houseW, houseD) * 0.45, 3.0, 4), this.materials.proxyRoof);
                    proxyRoof.position.set(0, houseH + 1.5, 0);
                    proxyRoof.rotation.y = Math.PI / 4;
                    proxyGroup.add(proxyRoof);

                    this.chunkManager.registerLowLOD(cx, cz, proxyGroup);
                } else {
                    this.scene.add(group);
                }

                // 7. Физические стены дома со свободным дверным проемом
                const getRotVec = (lx, lz) => {
                    return { x: posX + lx * cosR + lz * sinR, z: posZ - lx * sinR + lz * cosR };
                };

                const pBack = getRotVec(0, houseD / 2);
                const bBack = this.createStaticBox(pBack.x, houseH / 2, pBack.z, houseW, houseH, wallThick, cx, cz);
                bBack.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotationY);

                const pLeft = getRotVec(-houseW / 2, 0);
                const bLeft = this.createStaticBox(pLeft.x, houseH / 2, pLeft.z, wallThick, houseH, houseD, cx, cz);
                bLeft.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotationY);

                const pRight = getRotVec(houseW / 2, 0);
                const bRight = this.createStaticBox(pRight.x, houseH / 2, pRight.z, wallThick, houseH, houseD, cx, cz);
                bRight.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotationY);

                const pFL = getRotVec(-(doorWidth / 2 + frontSegW / 2), -houseD / 2);
                const bFL = this.createStaticBox(pFL.x, houseH / 2, pFL.z, frontSegW, houseH, wallThick, cx, cz);
                bFL.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotationY);

                const pFR = getRotVec(doorWidth / 2 + frontSegW / 2, -houseD / 2);
                const bFR = this.createStaticBox(pFR.x, houseH / 2, pFR.z, frontSegW, houseH, wallThick, cx, cz);
                bFR.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotationY);

                const pInner = getRotVec(0.5, 2.2);
                const bInner = this.createStaticBox(pInner.x, houseH / 2, pInner.z, 0.3, houseH, 6.0, cx, cz);
                bInner.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotationY);

                const pSofa = getRotVec(-3.5, 1.5);
                const bSofa = this.createStaticBox(pSofa.x, 0.425, pSofa.z, 3.6, 0.85, 1.3, cx, cz);
                bSofa.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotationY);

                const pKitchen = getRotVec(4.0, -2.5);
                const bKitchen = this.createStaticBox(pKitchen.x, 0.5, pKitchen.z, 4.2, 1.0, 1.0, cx, cz);
                bKitchen.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotationY);

                // Сплошной физический коллайдер крыши и перекрытия дома
                const bRoof = this.createStaticBox(posX, houseH + 0.15, posZ, houseW + 0.6, 0.4, houseD + 0.6, cx, cz);
                bRoof.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotationY);

                this.houses.push({
                    pos: { x: posX, z: posZ },
                    entrance: getRotVec(0, -houseD / 2 - 1.4),
                    insidePos: getRotVec(0, 0)
                });
            }

            update(deltaTime, playerPosition) {
                if (!playerPosition) return;
                const dt = Math.min(deltaTime, 0.1);
                for (let i = 0; i < this.doors.length; i++) {
                    const door = this.doors[i];
                    const dist = Math.hypot(playerPosition.x - door.pos.x, playerPosition.z - door.pos.z);
                    if (dist < door.openDist) {
                        door.targetAngle = door.maxAngle;
                    } else {
                        door.targetAngle = 0.0;
                    }
                    door.currentAngle += (door.targetAngle - door.currentAngle) * Math.min(dt * 7.0, 1.0);
                    door.pivot.rotation.y = door.currentAngle;
                }
            }

            updateNightLighting(nightFactor) {}
        }
