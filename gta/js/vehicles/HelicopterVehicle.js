/**
 * Вертолет Maverick / Buzzard с аэродинамической физикой полета,
 * вращающимися винтами, звуковым синтезатором и посадкой/высадкой игрока.
 */
class HelicopterVehicle {
    constructor(scene, world, physicsMaterials, posX = -3.5, posY = 93.0, posZ = 0, rotY = 0) {
        this.scene = scene;
        this.world = world;
        this.physicsMaterials = physicsMaterials;

        this.vehicleName = 'Maverick Helidrop';
        this.isPiloted = false;
        this.pilot = null;

        // Параметры мега-вертолета (Слияние 2 вертолетов в Cyber Stealth X4 со скоростью 2X)
        this.isMega = false;
        this.scaleMultiplier = 1.0;
        this.speedMultiplier = 1.0;
        this.isBeingMerged = false;
        this.isMerged = false;
        this.mergeState = 'IDLE'; // 'IDLE', 'MERGING', 'MEGA'
        this.mergeTimer = 0.0;
        this.mergeDuration = 0.85;
        this.mergePartner = null;

        // Физические параметры полета
        this.rotorRPM = 0.0;
        this.targetRotorRPM = 0.0;
        this.maxLiftForce = 21000.0; // Достаточно для подъема и маневров
        this.currentLift = 0.0;
        this.pitchAngle = 0.0;
        this.rollAngle = 0.0;
        this.yawAngle = rotY;

        this.pitchVelocity = 0.0;
        this.rollVelocity = 0.0;
        this.yawVelocity = 0.0;

        this.rotorAngle = 0.0;
        this.tailRotorAngle = 0.0;

        this.transitionState = 'IDLE';
        this.transitionTimer = 0.0;

        // Сетевая интерполяция и экстраполяция (Standoff-2 style entity smoothing)
        this.isRemotelyPiloted = false;
        this.netTargetPos = new THREE.Vector3(posX, posY, posZ);
        this.netTargetHeading = rotY;
        this.netTargetPitch = 0.0;
        this.netTargetRoll = 0.0;
        this.netVelocity = new THREE.Vector3();
        this.netLastPacketTime = 0;

        this._antiGravityForce = (typeof CANNON !== 'undefined') ? new CANNON.Vec3() : null;
        this._rayFrom = (typeof CANNON !== 'undefined') ? new CANNON.Vec3() : null;
        this._rayTo = (typeof CANNON !== 'undefined') ? new CANNON.Vec3() : null;
        this._rayResult = (typeof CANNON !== 'undefined') ? new CANNON.RaycastResult() : null;

        this.buildMaterials();
        this.buildMesh(posX, posY, posZ, rotY);
        this.initPhysics(posX, posY, posZ, rotY);
        this.initAudioSynth();
    }

    applyNetworkTransform(x, y, z, rotY, pitch = 0, roll = 0, vx = 0, vy = 0, vz = 0, isPiloted = true) {
        this.isRemotelyPiloted = !!isPiloted;
        this.netTargetPos.set(x, y, z);
        this.netTargetHeading = rotY;
        this.netTargetPitch = pitch;
        this.netTargetRoll = roll;
        this.netVelocity.set(vx, vy, vz);
        this.netLastPacketTime = performance.now();

        if (this.group.position.distanceTo(this.netTargetPos) > 28.0) {
            this.group.position.copy(this.netTargetPos);
            this.body.position.copy(this.netTargetPos);
            this.headingAngle = rotY;
            this.pitchAngle = pitch;
            this.rollAngle = roll;
            this.body.quaternion.setFromEuler(this.pitchAngle, this.headingAngle, this.rollAngle, 'YXZ');
            this.group.quaternion.copy(this.body.quaternion);
        }
    }

    buildMaterials() {
        this.matBody = new THREE.MeshStandardMaterial({
            color: 0x1a237e, // Насыщенный темно-синий глянец
            roughness: 0.25,
            metalness: 0.7
        });
        this.matAccent = new THREE.MeshStandardMaterial({
            color: 0xffb300, // Золотисто-желтая полоса
            roughness: 0.3,
            metalness: 0.5
        });
        this.matGlass = new THREE.MeshPhysicalMaterial({
            color: 0x81d4fa,
            transparent: true,
            opacity: 0.55,
            roughness: 0.1,
            metalness: 0.1,
            transmission: 0.6
        });
        this.matSkids = new THREE.MeshStandardMaterial({
            color: 0x37474f,
            roughness: 0.4,
            metalness: 0.8
        });
        this.matBlade = new THREE.MeshStandardMaterial({
            color: 0x212121,
            roughness: 0.5,
            metalness: 0.6
        });
        this.matInterior = new THREE.MeshLambertMaterial({
            color: 0x263238
        });
    }

    buildMesh(x, y, z, rotY) {
        this.group = new THREE.Group();
        this.group.position.set(x, y, z);
        this.group.rotation.y = rotY;

        // 1. Основной фюзеляж (кабина)
        const fuselageGeo = new THREE.BoxGeometry(1.85, 1.65, 3.8);
        const fuselage = new THREE.Mesh(fuselageGeo, this.matBody);
        fuselage.position.set(0, 0.85, 0);
        fuselage.castShadow = true;
        this.group.add(fuselage);

        // Носовой обтекатель
        const noseGeo = new THREE.ConeGeometry(0.92, 1.4, 16);
        const nose = new THREE.Mesh(noseGeo, this.matBody);
        nose.rotation.x = Math.PI / 2;
        nose.position.set(0, 0.82, 2.3);
        nose.castShadow = true;
        this.group.add(nose);

        // Просторное лобовое остекление кабины (без выпирания пилота)
        const glassGeo = new THREE.BoxGeometry(1.82, 1.25, 2.4);
        const glass = new THREE.Mesh(glassGeo, this.matGlass);
        glass.position.set(0, 1.15, 0.85);
        this.group.add(glass);

        // Декоративная полоса
        const stripeGeo = new THREE.BoxGeometry(1.88, 0.22, 3.6);
        const stripe = new THREE.Mesh(stripeGeo, this.matAccent);
        stripe.position.set(0, 0.8, 0);
        this.group.add(stripe);

        // Плоская посадочная площадка на крыше для стояния сверху
        const roofPlatGeo = new THREE.BoxGeometry(1.7, 0.1, 3.0);
        const roofPlat = new THREE.Mesh(roofPlatGeo, this.matAccent);
        roofPlat.position.set(0, 1.68, 0.1);
        roofPlat.receiveShadow = true;
        this.group.add(roofPlat);

        // 2 кресла в кабине (Место 0 = Пилот слева, Место 1 = Пассажир справа)
        const seatPilot = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.55), this.matInterior);
        seatPilot.position.set(-0.38, 0.45, 0.45);
        this.group.add(seatPilot);

        const seatCopilot = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.55), this.matInterior);
        seatCopilot.position.set(0.38, 0.45, 0.45);
        this.group.add(seatCopilot);

        // 2. Хвостовая балка и оперение
        const tailBoomGeo = new THREE.CylinderGeometry(0.22, 0.35, 4.6, 12);
        const tailBoom = new THREE.Mesh(tailBoomGeo, this.matBody);
        tailBoom.rotation.x = Math.PI / 2;
        tailBoom.position.set(0, 1.1, -3.8);
        tailBoom.castShadow = true;
        this.group.add(tailBoom);

        const vertFinGeo = new THREE.BoxGeometry(0.12, 1.3, 0.75);
        const vertFin = new THREE.Mesh(vertFinGeo, this.matAccent);
        vertFin.position.set(0, 1.5, -6.1);
        vertFin.castShadow = true;
        this.group.add(vertFin);

        const horizFinGeo = new THREE.BoxGeometry(1.5, 0.08, 0.45);
        const horizFin = new THREE.Mesh(horizFinGeo, this.matAccent);
        horizFin.position.set(0, 1.1, -5.7);
        this.group.add(horizFin);

        // 3. Шасси (полозья / лыжи)
        const skidGeo = new THREE.CylinderGeometry(0.065, 0.065, 4.4, 10);
        const skidLeft = new THREE.Mesh(skidGeo, this.matSkids);
        skidLeft.rotation.x = Math.PI / 2;
        skidLeft.position.set(-1.15, 0.08, 0.2);
        this.group.add(skidLeft);

        const skidRight = new THREE.Mesh(skidGeo, this.matSkids);
        skidRight.rotation.x = Math.PI / 2;
        skidRight.position.set(1.15, 0.08, 0.2);
        this.group.add(skidRight);

        // Стойки шасси
        const strutGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.85, 8);
        const struts = [
            { x: -0.9, y: 0.45, z: 1.1, rotZ: -0.35 },
            { x: -0.9, y: 0.45, z: -0.9, rotZ: -0.35 },
            { x: 0.9, y: 0.45, z: 1.1, rotZ: 0.35 },
            { x: 0.9, y: 0.45, z: -0.9, rotZ: 0.35 }
        ];
        for (const s of struts) {
            const strut = new THREE.Mesh(strutGeo, this.matSkids);
            strut.position.set(s.x, s.y, s.z);
            strut.rotation.z = s.rotZ;
            this.group.add(strut);
        }

        // 4. Главный несущий винт (Main Rotor)
        this.mainRotorHub = new THREE.Group();
        this.mainRotorHub.position.set(0, 2.05, 0.1);

        const mastGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.45, 12);
        const mast = new THREE.Mesh(mastGeo, this.matSkids);
        mast.position.y = -0.15;
        this.group.add(mast);

        const hubCenter = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.15, 12), this.matSkids);
        this.mainRotorHub.add(hubCenter);

        // 4 лопасти несущего винта (диаметр 7.2м)
        const bladeGeo = new THREE.BoxGeometry(0.22, 0.03, 3.4);
        for (let i = 0; i < 4; i++) {
            const blade = new THREE.Mesh(bladeGeo, this.matBlade);
            blade.position.set(0, 0, 1.7);
            const bladePivot = new THREE.Group();
            bladePivot.rotation.y = (i * Math.PI) / 2;
            bladePivot.add(blade);
            this.mainRotorHub.add(bladePivot);
        }
        this.group.add(this.mainRotorHub);

        // 5. Рулевой хвостовой винт (Tail Rotor)
        this.tailRotorHub = new THREE.Group();
        this.tailRotorHub.position.set(0.18, 1.6, -6.1);

        const tailBladeGeo = new THREE.BoxGeometry(0.08, 0.8, 0.02);
        const tailBlade1 = new THREE.Mesh(tailBladeGeo, this.matBlade);
        const tailBlade2 = new THREE.Mesh(tailBladeGeo, this.matBlade);
        tailBlade2.rotation.z = Math.PI / 2;
        this.tailRotorHub.add(tailBlade1);
        this.tailRotorHub.add(tailBlade2);
        this.group.add(this.tailRotorHub);

        // 6. Навигационные огни (Beacon & Strobes)
        const navLightRed = new THREE.PointLight(0xff1111, 0.8, 12);
        navLightRed.position.set(-1.1, 0.9, 0);
        this.group.add(navLightRed);

        const navLightGreen = new THREE.PointLight(0x00e676, 0.8, 12);
        navLightGreen.position.set(1.1, 0.9, 0);
        this.group.add(navLightGreen);

        const navBeacon = new THREE.PointLight(0xff1744, 1.5, 18);
        navBeacon.position.set(0, 2.15, -6.1);
        this.group.add(navBeacon);
        this.navBeacon = navBeacon;

        this.scene.add(this.group);
    }

    /**
     * Создание великолепной высокотехнологичной 3D модели Cyber Stealth Gunship для объединенного вертолета (Tier 2)
     */
    buildMegaStealthMesh() {
        while (this.group.children.length > 0) {
            const child = this.group.children[0];
            this.group.remove(child);
        }

        // Высокопроизводительные предварительно скомпилированные материалы (без тяжелых шейдерных лагов)
        const matStealthCarbon = new THREE.MeshStandardMaterial({
            color: 0x0c1424,
            roughness: 0.25,
            metalness: 0.85
        });
        const matStealthArmor = new THREE.MeshStandardMaterial({
            color: 0x1a2638,
            roughness: 0.35,
            metalness: 0.75
        });
        const matCyanNeon = new THREE.MeshBasicMaterial({
            color: 0x00f0ff
        });
        const matCockpitGlass = new THREE.MeshStandardMaterial({
            color: 0x002b3d,
            roughness: 0.12,
            metalness: 0.9,
            transparent: true,
            opacity: 0.65
        });
        const matCarbonBlade = new THREE.MeshStandardMaterial({
            color: 0x11161d,
            roughness: 0.3,
            metalness: 0.8
        });
        const matGoldTurbine = new THREE.MeshStandardMaterial({
            color: 0xffb300,
            roughness: 0.2,
            metalness: 0.9
        });
        const matPlasmaGlow = new THREE.MeshBasicMaterial({
            color: 0x00e5ff
        });
        const matDarkGun = new THREE.MeshStandardMaterial({
            color: 0x080b10,
            roughness: 0.2,
            metalness: 0.95
        });
        const matSkids = new THREE.MeshStandardMaterial({
            color: 0x1f2937,
            roughness: 0.3,
            metalness: 0.85
        });
        const matInterior = new THREE.MeshLambertMaterial({
            color: 0x0f172a
        });

        // 1. Основной аэродинамический стелс-фюзеляж
        const mainFuselage = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 4.6), matStealthCarbon);
        mainFuselage.position.set(0, 0.85, 0);
        mainFuselage.castShadow = true;
        this.group.add(mainFuselage);

        // Нижний бронированный поддон с расширителями
        const lowerHull = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 4.3), matStealthArmor);
        lowerHull.position.set(0, 0.28, 0);
        lowerHull.castShadow = true;
        this.group.add(lowerHull);

        // Острый носовой обтекатель (Chiseled Stealth Nose)
        const noseCone = new THREE.Mesh(new THREE.ConeGeometry(1.25, 2.2, 4), matStealthCarbon);
        noseCone.rotation.x = Math.PI / 2;
        noseCone.rotation.z = Math.PI / 4;
        noseCone.position.set(0, 0.8, 2.9);
        noseCone.castShadow = true;
        this.group.add(noseCone);

        // Оптико-электронная турель с синим лазерным сенсором
        const sensorTurret = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 14), matDarkGun);
        sensorTurret.position.set(0, 0.35, 3.6);
        this.group.add(sensorTurret);

        const sensorEye = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12), matCyanNeon);
        sensorEye.rotation.x = Math.PI / 2;
        sensorEye.position.set(0, 0.35, 3.85);
        this.group.add(sensorEye);

        // Неоновые линии по бортам фюзеляжа
        const sideStripeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 4.4), matCyanNeon);
        sideStripeL.position.set(-1.22, 0.95, 0.1);
        this.group.add(sideStripeL);

        const sideStripeR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 4.4), matCyanNeon);
        sideStripeR.position.set(1.22, 0.95, 0.1);
        this.group.add(sideStripeR);

        // Кабина пилота из тонированного кибер-стекла с обтекаемым фонарем
        const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.25, 2.8), matCockpitGlass);
        canopy.position.set(0, 1.2, 1.1);
        this.group.add(canopy);

        // Голографический HUD-дисплей приборной панели внутри кабины
        const hudDisplay = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), matCyanNeon);
        hudDisplay.rotation.x = -0.35;
        hudDisplay.position.set(0, 0.95, 1.95);
        this.group.add(hudDisplay);

        // Верхняя палуба-платформа для стояния
        const roofPlatform = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.12, 3.4), matStealthArmor);
        roofPlatform.position.set(0, 1.72, 0.1);
        this.group.add(roofPlatform);

        // Сиденья пилота и штурмана
        const seatL = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.6, 0.65), matInterior);
        seatL.position.set(-0.5, 0.45, 0.55);
        this.group.add(seatL);

        const seatR = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.6, 0.65), matInterior);
        seatR.position.set(0.5, 0.45, 0.55);
        this.group.add(seatR);

        // 2. Спаренные боковые реактивные турбины (Jet Turbofans)
        const nacelleGeo = new THREE.CylinderGeometry(0.44, 0.48, 3.8, 16);
        const nacelleL = new THREE.Mesh(nacelleGeo, matStealthArmor);
        nacelleL.rotation.x = Math.PI / 2;
        nacelleL.position.set(-1.3, 1.55, -0.1);
        nacelleL.castShadow = true;
        this.group.add(nacelleL);

        const nacelleR = new THREE.Mesh(nacelleGeo, matStealthArmor);
        nacelleR.rotation.x = Math.PI / 2;
        nacelleR.position.set(1.3, 1.55, -0.1);
        nacelleR.castShadow = true;
        this.group.add(nacelleR);

        // Золотые воздухозаборники турбин
        const intakeRimGeo = new THREE.TorusGeometry(0.44, 0.07, 8, 18);
        const intakeRimL = new THREE.Mesh(intakeRimGeo, matGoldTurbine);
        intakeRimL.position.set(-1.3, 1.55, 1.8);
        this.group.add(intakeRimL);

        const intakeRimR = new THREE.Mesh(intakeRimGeo, matGoldTurbine);
        intakeRimR.position.set(1.3, 1.55, 1.8);
        this.group.add(intakeRimR);

        // Плазменные сопла форсажа
        const exhaustGeo = new THREE.CylinderGeometry(0.38, 0.42, 0.4, 16);
        const exhaustL = new THREE.Mesh(exhaustGeo, matPlasmaGlow);
        exhaustL.rotation.x = Math.PI / 2;
        exhaustL.position.set(-1.3, 1.55, -2.05);
        this.group.add(exhaustL);

        const exhaustR = new THREE.Mesh(exhaustGeo, matPlasmaGlow);
        exhaustR.rotation.x = Math.PI / 2;
        exhaustR.position.set(1.3, 1.55, -2.05);
        this.group.add(exhaustR);

        // Неоновые факелы форсажа
        const flameGeo = new THREE.ConeGeometry(0.32, 0.8, 10);
        const flameL = new THREE.Mesh(flameGeo, matCyanNeon);
        flameL.rotation.x = -Math.PI / 2;
        flameL.position.set(-1.3, 1.55, -2.5);
        this.group.add(flameL);

        const flameR = new THREE.Mesh(flameGeo, matCyanNeon);
        flameR.rotation.x = -Math.PI / 2;
        flameR.position.set(1.3, 1.55, -2.5);
        this.group.add(flameR);

        // 3. Стреловидные тактические крылья с ракетными пилонами и пушками
        const wingGeo = new THREE.BoxGeometry(1.55, 0.12, 1.1);
        const wingL = new THREE.Mesh(wingGeo, matStealthCarbon);
        wingL.position.set(-2.0, 0.85, 0.3);
        this.group.add(wingL);

        const wingR = new THREE.Mesh(wingGeo, matStealthCarbon);
        wingR.position.set(2.0, 0.85, 0.3);
        this.group.add(wingR);

        // Вертикальные винглеты со светящимися стробоскопами
        const wingletGeo = new THREE.BoxGeometry(0.1, 0.6, 0.95);
        const wingletL = new THREE.Mesh(wingletGeo, matCyanNeon);
        wingletL.position.set(-2.8, 1.1, 0.3);
        this.group.add(wingletL);

        const wingletR = new THREE.Mesh(wingletGeo, matCyanNeon);
        wingletR.position.set(2.8, 1.1, 0.3);
        this.group.add(wingletR);

        // Ракетные блоки на крыльях (4 ракеты на каждом крыле)
        const podGeo = new THREE.CylinderGeometry(0.28, 0.28, 1.4, 12);
        const podL = new THREE.Mesh(podGeo, matDarkGun);
        podL.rotation.x = Math.PI / 2;
        podL.position.set(-2.2, 0.6, 0.3);
        this.group.add(podL);

        const podR = new THREE.Mesh(podGeo, matDarkGun);
        podR.rotation.x = Math.PI / 2;
        podR.position.set(2.2, 0.6, 0.3);
        this.group.add(podR);

        // Золотые боеголовки ракет
        for (let ox of [-0.08, 0.08]) {
            for (let oy of [-0.08, 0.08]) {
                const warheadL = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 8), matGoldTurbine);
                warheadL.rotation.x = Math.PI / 2;
                warheadL.position.set(-2.2 + ox, 0.6 + oy, 1.05);
                this.group.add(warheadL);

                const warheadR = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 8), matGoldTurbine);
                warheadR.rotation.x = Math.PI / 2;
                warheadR.position.set(2.2 + ox, 0.6 + oy, 1.05);
                this.group.add(warheadR);
            }
        }

        // Подкрыльевые автоматические скорострельные лазерные пушки
        const cannonGeo = new THREE.CylinderGeometry(0.04, 0.05, 1.8, 8);
        const cannonL = new THREE.Mesh(cannonGeo, matDarkGun);
        cannonL.rotation.x = Math.PI / 2;
        cannonL.position.set(-1.6, 0.52, 0.6);
        this.group.add(cannonL);

        const cannonR = new THREE.Mesh(cannonGeo, matDarkGun);
        cannonR.rotation.x = Math.PI / 2;
        cannonR.position.set(1.6, 0.52, 0.6);
        this.group.add(cannonR);

        // 4. Удлиненная хвостовая балка и V-образное оперение
        const tailBoom = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.58, 5.6), matStealthCarbon);
        tailBoom.position.set(0, 1.15, -4.3);
        tailBoom.castShadow = true;
        this.group.add(tailBoom);

        const dorsalStrip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 5.2), matCyanNeon);
        dorsalStrip.position.set(0, 1.46, -4.3);
        this.group.add(dorsalStrip);

        // Сдвоенное V-образное хвостовое оперение
        const vFinL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.95, 0.95), matStealthArmor);
        vFinL.position.set(-0.8, 1.95, -6.7);
        vFinL.rotation.z = -0.42;
        vFinL.castShadow = true;
        this.group.add(vFinL);

        const vEdgeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.95, 0.12), matCyanNeon);
        vEdgeL.position.set(-0.8, 1.95, -7.1);
        vEdgeL.rotation.z = -0.42;
        this.group.add(vEdgeL);

        const vFinR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.95, 0.95), matStealthArmor);
        vFinR.position.set(0.8, 1.95, -6.7);
        vFinR.rotation.z = 0.42;
        vFinR.castShadow = true;
        this.group.add(vFinR);

        const vEdgeR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.95, 0.12), matCyanNeon);
        vEdgeR.position.set(0.8, 1.95, -7.1);
        vEdgeR.rotation.z = 0.42;
        this.group.add(vEdgeR);

        // 5. Кольцевой аэродинамический фенестрон (Fenestron Shrouded Tail Rotor)
        const fenestronRing = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.14, 8, 20), matStealthArmor);
        fenestronRing.position.set(0, 1.42, -7.0);
        this.group.add(fenestronRing);

        this.tailRotorHub = new THREE.Group();
        this.tailRotorHub.position.set(0, 1.42, -7.0);

        const fenestronBladeGeo = new THREE.BoxGeometry(0.08, 1.3, 0.02);
        const fb1 = new THREE.Mesh(fenestronBladeGeo, matCyanNeon);
        const fb2 = new THREE.Mesh(fenestronBladeGeo, matCyanNeon);
        fb2.rotation.z = Math.PI / 2;
        const fb3 = new THREE.Mesh(fenestronBladeGeo, matCyanNeon);
        fb3.rotation.z = Math.PI / 4;
        const fb4 = new THREE.Mesh(fenestronBladeGeo, matCyanNeon);
        fb4.rotation.z = -Math.PI / 4;
        this.tailRotorHub.add(fb1);
        this.tailRotorHub.add(fb2);
        this.tailRotorHub.add(fb3);
        this.tailRotorHub.add(fb4);
        this.group.add(this.tailRotorHub);

        // 6. 6-лопастной высокоскоростной карбоновый несущий винт (X4 Gunship Rotor)
        this.mainRotorHub = new THREE.Group();
        this.mainRotorHub.position.set(0, 2.35, 0.1);

        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.6, 16), matDarkGun);
        mast.position.y = -0.15;
        this.group.add(mast);

        const hubCenter = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.32, 16), matStealthCarbon);
        hubCenter.position.y = 0.12;
        this.mainRotorHub.add(hubCenter);

        const hubRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 16), matCyanNeon);
        hubRing.rotation.x = Math.PI / 2;
        hubRing.position.y = 0.04;
        this.mainRotorHub.add(hubRing);

        const bladeGeo = new THREE.BoxGeometry(0.24, 0.035, 4.6);
        const tipGeo = new THREE.BoxGeometry(0.24, 0.036, 0.7);
        for (let i = 0; i < 6; i++) {
            const bladePivot = new THREE.Group();
            bladePivot.rotation.y = (i * Math.PI) / 3;

            const blade = new THREE.Mesh(bladeGeo, matCarbonBlade);
            blade.position.set(0, 0, 2.3);
            bladePivot.add(blade);

            const bladeTip = new THREE.Mesh(tipGeo, matCyanNeon);
            bladeTip.position.set(0, 0, 4.3);
            bladePivot.add(bladeTip);

            this.mainRotorHub.add(bladePivot);
        }
        this.group.add(this.mainRotorHub);

        // 7. Тактические усиленные полозья шасси с неоновой подсветкой
        const skidGeo = new THREE.CylinderGeometry(0.08, 0.08, 5.0, 12);
        const skidL = new THREE.Mesh(skidGeo, matSkids);
        skidL.rotation.x = Math.PI / 2;
        skidL.position.set(-1.5, 0.08, 0.1);
        this.group.add(skidL);

        const skidR = new THREE.Mesh(skidGeo, matSkids);
        skidR.rotation.x = Math.PI / 2;
        skidR.position.set(1.5, 0.08, 0.1);
        this.group.add(skidR);

        // Неоновые полосы подсветки на полозьях (Underglow)
        const underglowL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 4.8), matCyanNeon);
        underglowL.position.set(-1.5, 0.02, 0.1);
        this.group.add(underglowL);

        const underglowR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 4.8), matCyanNeon);
        underglowR.position.set(1.5, 0.02, 0.1);
        this.group.add(underglowR);

        const strutGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.95, 8);
        const stealthStruts = [
            { x: -1.2, y: 0.45, z: 1.3, rotZ: -0.35 },
            { x: -1.2, y: 0.45, z: -1.1, rotZ: -0.35 },
            { x: 1.2, y: 0.45, z: 1.3, rotZ: 0.35 },
            { x: 1.2, y: 0.45, z: -1.1, rotZ: 0.35 }
        ];
        for (const s of stealthStruts) {
            const strut = new THREE.Mesh(strutGeo, matSkids);
            strut.position.set(s.x, s.y, s.z);
            strut.rotation.z = s.rotZ;
            this.group.add(strut);
        }
    }

    initPhysics(x, y, z, rotY) {
        this.body = new CANNON.Body({
            mass: 1250,
            material: this.physicsMaterials.wall,
            position: new CANNON.Vec3(x, y + 0.85, z),
            linearDamping: 0.45,
            angularDamping: 0.75
        });

        // 1. Основной фюзеляж хитбокс
        const fuselageShape = new CANNON.Box(new CANNON.Vec3(1.15, 0.9, 2.0));
        this.body.addShape(fuselageShape, new CANNON.Vec3(0, 0.85, 0));

        // 2. Носовой хитбокс (полностью защищает носовой обтекатель и кабину до Z = +3.1м)
        const noseShape = new CANNON.Box(new CANNON.Vec3(0.95, 0.75, 0.85));
        this.body.addShape(noseShape, new CANNON.Vec3(0, 0.82, 2.25));

        // 3. Плоская крыша-платформа для стояния/полетов на крыше
        const roofPlatform = new CANNON.Box(new CANNON.Vec3(0.95, 0.15, 1.6));
        this.body.addShape(roofPlatform, new CANNON.Vec3(0, 1.68, 0.1));

        // 4. Хвостовая балка хитбокс (от Z = -2.0 до Z = -5.6м)
        const tailShape = new CANNON.Box(new CANNON.Vec3(0.35, 0.35, 1.8));
        this.body.addShape(tailShape, new CANNON.Vec3(0, 0.8, -3.8));

        // 5. Хвостовой винт и оперение (защита до Z = -7.1м)
        const tailFinShape = new CANNON.Box(new CANNON.Vec3(0.35, 0.85, 0.75));
        this.body.addShape(tailFinShape, new CANNON.Vec3(0, 1.4, -6.35));

        // 6. Полозья шасси (Skids)
        const skidsShape = new CANNON.Box(new CANNON.Vec3(1.2, 0.12, 2.2));
        this.body.addShape(skidsShape, new CANNON.Vec3(0, 0.08, 0.1));

        this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotY);
        this.world.addBody(this.body);
    }

    initAudioSynth() {
        this.audioCtx = null;
        this.osc1 = null;
        this.osc2 = null;
        this.gainNode = null;
    }

    startAudio() {
        try {
            const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtxClass) return;
            if (!this.audioCtx) this.audioCtx = new AudioCtxClass();
            if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

            if (this.gainNode) return;

            this.gainNode = this.audioCtx.createGain();
            this.gainNode.gain.setValueAtTime(0.01, this.audioCtx.currentTime);
            this.gainNode.connect(this.audioCtx.destination);

            // Низкочастотный рокочущий звук лопастей (Chopper chop)
            this.osc1 = this.audioCtx.createOscillator();
            this.osc1.type = 'sawtooth';
            this.osc1.frequency.setValueAtTime(28, this.audioCtx.currentTime);

            this.osc2 = this.audioCtx.createOscillator();
            this.osc2.type = 'triangle';
            this.osc2.frequency.setValueAtTime(84, this.audioCtx.currentTime);

            // Модулятор чоппера (LFO)
            this.lfo = this.audioCtx.createOscillator();
            this.lfo.frequency.setValueAtTime(14, this.audioCtx.currentTime);
            this.lfoGain = this.audioCtx.createGain();
            this.lfoGain.gain.setValueAtTime(0.6, this.audioCtx.currentTime);
            this.lfo.connect(this.lfoGain.gain);

            this.osc1.connect(this.gainNode);
            this.osc2.connect(this.gainNode);

            this.osc1.start();
            this.osc2.start();
            this.lfo.start();
        } catch (e) {
            console.warn('[Helicopter] Audio init warning:', e);
        }
    }

    stopAudio() {
        if (this.gainNode && this.audioCtx) {
            try {
                this.gainNode.gain.setTargetAtTime(0.0, this.audioCtx.currentTime, 0.1);
                setTimeout(() => {
                    if (this.osc1) { try { this.osc1.stop(); this.osc1.disconnect(); } catch (e) {} this.osc1 = null; }
                    if (this.osc2) { try { this.osc2.stop(); this.osc2.disconnect(); } catch (e) {} this.osc2 = null; }
                    if (this.lfo) { try { this.lfo.stop(); this.lfo.disconnect(); } catch (e) {} this.lfo = null; }
                    this.gainNode = null;
                }, 150);
            } catch (e) {}
        }
    }

    updateAudio(rpm) {
        if (!this.audioCtx || !this.gainNode) return;
        const now = this.audioCtx.currentTime;
        const volMultiplier = this.isMega ? 1.3 : 1.0;
        const targetVol = Math.min(0.38, rpm * 0.28 * volMultiplier);
        this.gainNode.gain.setTargetAtTime(targetVol, now, 0.1);

        const freqOffset = this.isMega ? -4 : 0;
        const highPitch = this.isMega ? 110 : 75;
        if (this.osc1) this.osc1.frequency.setTargetAtTime(Math.max(12, 20 + freqOffset + rpm * (this.isMega ? 32 : 26)), now, 0.1);
        if (this.osc2) this.osc2.frequency.setTargetAtTime(60 + rpm * highPitch, now, 0.1);
        if (this.lfo) this.lfo.frequency.setTargetAtTime((this.isMega ? 14 : 8) + rpm * (this.isMega ? 28 : 18), now, 0.1);
    }

    startMergeWith(otherHeli, isRemote = false) {
        if (this.mergeState === 'MERGING' || this.isBeingMerged || !otherHeli || otherHeli.isMerged || otherHeli.isBeingMerged) return;

        this.mergeState = 'MERGING';
        this.mergeTimer = 0.0;
        this.mergeDuration = 0.85;
        this.mergePartner = otherHeli;
        otherHeli.isBeingMerged = true;

        if (otherHeli.body) {
            otherHeli.body.collisionResponse = false;
            otherHeli.body.velocity.set(0, 0, 0);
            otherHeli.body.angularVelocity.set(0, 0, 0);
            otherHeli.body.sleep();
        }

        this.playQuickMergeSound();

        const isLevel3 = this.isMega;
        if (window.gameEngine && window.gameEngine.multiplayerHUD) {
            if (isLevel3) {
                window.gameEngine.multiplayerHUD.addSystemMessage('🔴 СВЕРХ-СЛИЯНИЕ 3-ГО УРОВНЯ! ТРАНСФОРМАЦИЯ В CYBER CRIMSON TITAN X8...');
            } else {
                window.gameEngine.multiplayerHUD.addSystemMessage('⚡ СЛИЯНИЕ ВЕРТОЛЕТОВ! ТРАНСФОРМАЦИЯ В CYBER GHOST X4...');
            }
        }

        const promptElement = document.getElementById('vehicle-prompt');
        if (promptElement) promptElement.style.display = 'none';

        // Синхронизация слияния вертолетов для всех игроков сессии
        if (!isRemote && window.gameEngine && window.gameEngine.multiplayerManager) {
            const masterIdx = (this.heliIndex !== undefined && !isNaN(this.heliIndex)) ? this.heliIndex : 0;
            const partnerIdx = (otherHeli.heliIndex !== undefined && !isNaN(otherHeli.heliIndex)) ? otherHeli.heliIndex : 1;
            window.gameEngine.multiplayerManager.broadcastHeliMerge(masterIdx, partnerIdx);
        }
    }

    playQuickMergeSound() {
        try {
            const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtxClass) return;
            if (!this.audioCtx) this.audioCtx = new AudioCtxClass();
            if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

            const now = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.exponentialRampToValueAtTime(760, now + 0.8);

            gain.gain.setValueAtTime(0.01, now);
            gain.gain.linearRampToValueAtTime(0.28, now + 0.4);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.88);
        } catch (e) {}
    }

    updateMerge(dt) {
        if (this.mergeState !== 'MERGING') return;
        this.mergeTimer += dt;
        const progress = Math.min(1.0, this.mergeTimer / this.mergeDuration);
        const ease = THREE.MathUtils.smoothstep(progress, 0, 1);

        if (this.mergePartner && this.mergePartner.group) {
            const partnerGroup = this.mergePartner.group;
            partnerGroup.position.lerp(this.group.position, Math.min(1.0, dt * 6.5));
            partnerGroup.quaternion.slerp(this.group.quaternion, Math.min(1.0, dt * 6.5));
            partnerGroup.scale.setScalar(Math.max(0.01, (1.0 - ease) * 1.0));
            if (this.mergePartner.body) {
                this.mergePartner.body.position.copy(partnerGroup.position);
            }
        }

        if (progress >= 1.0) {
            if (this.isMega) {
                this.upgradeToCrimsonTitanHelicopter();
            } else {
                this.upgradeToMegaHelicopter();
            }
        }
    }

    upgradeToMegaHelicopter() {
        this.mergeState = 'MEGA';
        this.isMega = true;
        this.tier = 2;
        this.vehicleName = '⚡ CYBER GHOST X4 ⚡';
        this.speedMultiplier = 2.0;

        // Удаление и деактивация поглощенного вертолета
        if (this.mergePartner) {
            this.mergePartner.isMerged = true;
            this.mergePartner.isBeingMerged = false;
            if (this.mergePartner.group) {
                this.scene.remove(this.mergePartner.group);
            }
            if (this.mergePartner.body && this.world) {
                this.world.removeBody(this.mergePartner.body);
            }
            this.mergePartner = null;
        }

        this.scaleMultiplier = 1.0;
        this.group.scale.setScalar(1.0);
        this.buildMegaStealthMesh();

        // Безопасное обновление физических коллизий Cannon под пропорции Gunship
        if (this.body && this.world) {
            this.world.removeBody(this.body);
            while (this.body.shapes.length > 0) {
                this.body.shapes.pop();
                this.body.shapeOffsets.pop();
                this.body.shapeOrientations.pop();
            }

            this.body.mass = 3500;

            // Фюзеляж
            this.body.addShape(new CANNON.Box(new CANNON.Vec3(1.3, 0.95, 2.3)), new CANNON.Vec3(0, 0.85, 0));
            // Нос
            this.body.addShape(new CANNON.Box(new CANNON.Vec3(1.15, 0.8, 1.2)), new CANNON.Vec3(0, 0.8, 2.7));
            // Крыша
            this.body.addShape(new CANNON.Box(new CANNON.Vec3(1.1, 0.15, 1.7)), new CANNON.Vec3(0, 1.72, 0.1));
            // Хвостовая балка
            this.body.addShape(new CANNON.Box(new CANNON.Vec3(0.45, 0.45, 2.4)), new CANNON.Vec3(0, 0.8, -4.2));
            // Хвостовое оперение и фенестрон
            this.body.addShape(new CANNON.Box(new CANNON.Vec3(0.85, 0.95, 0.9)), new CANNON.Vec3(0, 1.4, -6.8));
            // Крылья
            this.body.addShape(new CANNON.Box(new CANNON.Vec3(2.5, 0.15, 0.6)), new CANNON.Vec3(0, 0.85, 0.3));

            this.body.updateMassProperties();
            this.body.updateBoundingRadius();
            this.body.aabbNeedsUpdate = true;
            this.world.addBody(this.body);
            this.body.wakeUp();
        }

        // Всплывающее уведомление
        let toast = document.getElementById('mega-heli-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'mega-heli-toast';
            toast.className = 'opt-toast';
            document.body.appendChild(toast);
        }
        toast.innerHTML = '⚡ <b>ВЕРТОЛЕТЫ ОБЪЕДИНЕНЫ!</b> АКТИВИРОВАН CYBER GHOST X4: СКОРОСТЬ X2, ПИКИРОВАНИЕ X2! 🚁';
        toast.style.borderColor = '#00f0ff';
        toast.style.background = 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(6, 182, 212, 0.4))';
        toast.style.boxShadow = '0 10px 40px rgba(0, 240, 255, 0.6)';
        toast.style.display = 'block';
        setTimeout(() => { if (toast) toast.style.display = 'none'; }, 4500);

        if (window.gameEngine && window.gameEngine.multiplayerHUD) {
            window.gameEngine.multiplayerHUD.addSystemMessage('🔥 CYBER GHOST X4 АКТИВИРОВАН! СКОРОСТЬ ПОЛЕТА И ПИКИРОВАНИЯ УДВОЕНЫ!');
        }

        const titleElem = document.getElementById('hud-mode-title');
        if (titleElem && this.isPiloted) {
            titleElem.innerText = '⚡ CYBER GHOST X4 ⚡';
            titleElem.style.color = '#00f0ff';
            titleElem.style.textShadow = '0 0 10px rgba(0, 240, 255, 0.8)';
        }
    }

    buildTitanCrimsonMesh() {
        while (this.group.children.length > 0) {
            const child = this.group.children[0];
            this.group.remove(child);
        }

        const matCrimsonBody = new THREE.MeshStandardMaterial({
            color: 0x990011,
            roughness: 0.28,
            metalness: 0.85
        });
        const matCrimsonArmor = new THREE.MeshStandardMaterial({
            color: 0x59000a,
            roughness: 0.38,
            metalness: 0.75
        });
        const matRedNeon = new THREE.MeshBasicMaterial({
            color: 0xff0033
        });
        const matCockpitRed = new THREE.MeshStandardMaterial({
            color: 0x220005,
            roughness: 0.15,
            metalness: 0.9,
            transparent: true,
            opacity: 0.75
        });
        const matCarbonBlade = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.25,
            metalness: 0.85
        });
        const matDarkTitanGun = new THREE.MeshStandardMaterial({
            color: 0x151518,
            roughness: 0.18,
            metalness: 0.95
        });
        const matPlasmaCrimson = new THREE.MeshBasicMaterial({
            color: 0xff1744
        });
        const matSkids = new THREE.MeshStandardMaterial({
            color: 0x261417,
            roughness: 0.3,
            metalness: 0.85
        });

        // 1. Тяжелый фюзеляж Титана
        const mainFuselage = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 5.0), matCrimsonBody);
        mainFuselage.position.set(0, 0.95, 0);
        mainFuselage.castShadow = true;
        this.group.add(mainFuselage);

        const lowerHull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 4.6), matCrimsonArmor);
        lowerHull.position.set(0, 0.32, 0);
        lowerHull.castShadow = true;
        this.group.add(lowerHull);

        const noseCone = new THREE.Mesh(new THREE.ConeGeometry(1.35, 2.4, 4), matCrimsonBody);
        noseCone.rotation.x = Math.PI / 2;
        noseCone.rotation.z = Math.PI / 4;
        noseCone.position.set(0, 0.9, 3.2);
        noseCone.castShadow = true;
        this.group.add(noseCone);

        // Тяжелая сдвоенная носовая пушка Гатлинга
        const noseTurret = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.6, 12), matDarkTitanGun);
        noseTurret.rotation.x = Math.PI / 2;
        noseTurret.position.set(0, 0.35, 3.8);
        this.group.add(noseTurret);

        // Неоновые полосы Титана
        const sideStripeL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 4.8), matRedNeon);
        sideStripeL.position.set(-1.32, 1.05, 0.1);
        this.group.add(sideStripeL);

        const sideStripeR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 4.8), matRedNeon);
        sideStripeR.position.set(1.32, 1.05, 0.1);
        this.group.add(sideStripeR);

        // Бронированный фонарь кабины
        const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.35, 3.0), matCockpitRed);
        canopy.position.set(0, 1.3, 1.2);
        this.group.add(canopy);

        // 2. Тройные реактивные турбины Титана
        const thrusters = [
            { x: -1.35, y: 1.6, z: -0.2 },
            { x: 1.35, y: 1.6, z: -0.2 },
            { x: 0.0, y: 2.15, z: -0.8 }
        ];

        for (let tp of thrusters) {
            const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.52, 3.8, 16), matCrimsonArmor);
            nacelle.rotation.x = Math.PI / 2;
            nacelle.position.set(tp.x, tp.y, tp.z);
            nacelle.castShadow = true;
            this.group.add(nacelle);

            const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 0.5, 16), matDarkTitanGun);
            nozzle.rotation.x = Math.PI / 2;
            nozzle.position.set(tp.x, tp.y, tp.z - 2.1);
            this.group.add(nozzle);

            const flame = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.1, 10), matPlasmaCrimson);
            flame.rotation.x = -Math.PI / 2;
            flame.position.set(tp.x, tp.y, tp.z - 2.8);
            this.group.add(flame);
        }

        // 3. Тяжелые крылья с 4 пушками и 2 тяжелыми блоками РСЗО
        const wingL = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.16, 1.3), matCrimsonBody);
        wingL.position.set(-2.25, 0.9, 0.3);
        this.group.add(wingL);

        const wingR = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.16, 1.3), matCrimsonBody);
        wingR.position.set(2.25, 0.9, 0.3);
        this.group.add(wingR);

        const wingletL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.75, 1.1), matRedNeon);
        wingletL.position.set(-3.25, 1.25, 0.3);
        this.group.add(wingletL);

        const wingletR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.75, 1.1), matRedNeon);
        wingletR.position.set(3.25, 1.25, 0.3);
        this.group.add(wingletR);

        // 4. Сдвоенная балка хвоста Титана
        const tailBoom = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.65, 6.0), matCrimsonBody);
        tailBoom.position.set(0, 1.2, -4.6);
        tailBoom.castShadow = true;
        this.group.add(tailBoom);

        const vFinL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.2, 1.1), matCrimsonArmor);
        vFinL.position.set(-0.95, 2.1, -7.2);
        vFinL.rotation.z = -0.4;
        this.group.add(vFinL);

        const vFinR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.2, 1.1), matCrimsonArmor);
        vFinR.position.set(0.95, 2.1, -7.2);
        vFinR.rotation.z = 0.4;
        this.group.add(vFinR);

        // Фенестрон Титана
        const fenestronRing = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.16, 8, 20), matCrimsonArmor);
        fenestronRing.position.set(0, 1.5, -7.5);
        this.group.add(fenestronRing);

        this.tailRotorHub = new THREE.Group();
        this.tailRotorHub.position.set(0, 1.5, -7.5);
        const fbGeo = new THREE.BoxGeometry(0.1, 1.5, 0.03);
        const fb1 = new THREE.Mesh(fbGeo, matRedNeon);
        const fb2 = new THREE.Mesh(fbGeo, matRedNeon); fb2.rotation.z = Math.PI / 2;
        this.tailRotorHub.add(fb1); this.tailRotorHub.add(fb2);
        this.group.add(this.tailRotorHub);

        // 5. 8-лопастной несущий винт Титана (X8 Titan Rotor)
        this.mainRotorHub = new THREE.Group();
        this.mainRotorHub.position.set(0, 2.5, 0.1);

        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.7, 16), matDarkTitanGun);
        mast.position.y = -0.15;
        this.group.add(mast);

        const hubCenter = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.4, 16), matCrimsonBody);
        hubCenter.position.y = 0.15;
        this.mainRotorHub.add(hubCenter);

        const bladeGeo = new THREE.BoxGeometry(0.28, 0.04, 5.0);
        const tipGeo = new THREE.BoxGeometry(0.28, 0.042, 0.8);
        for (let i = 0; i < 8; i++) {
            const bladePivot = new THREE.Group();
            bladePivot.rotation.y = (i * Math.PI) / 4;

            const blade = new THREE.Mesh(bladeGeo, matCarbonBlade);
            blade.position.set(0, 0, 2.5);
            bladePivot.add(blade);

            const bladeTip = new THREE.Mesh(tipGeo, matRedNeon);
            bladeTip.position.set(0, 0, 4.6);
            bladePivot.add(bladeTip);

            this.mainRotorHub.add(bladePivot);
        }
        this.group.add(this.mainRotorHub);

        // 6. Шасси Титана
        const skidL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5.4, 12), matSkids);
        skidL.rotation.x = Math.PI / 2;
        skidL.position.set(-1.65, 0.1, 0.1);
        this.group.add(skidL);

        const skidR = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5.4, 12), matSkids);
        skidR.rotation.x = Math.PI / 2;
        skidR.position.set(1.65, 0.1, 0.1);
        this.group.add(skidR);

        const underglowL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 5.2), matRedNeon);
        underglowL.position.set(-1.65, 0.03, 0.1);
        this.group.add(underglowL);

        const underglowR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 5.2), matRedNeon);
        underglowR.position.set(1.65, 0.03, 0.1);
        this.group.add(underglowR);
    }

    upgradeToCrimsonTitanHelicopter() {
        this.mergeState = 'TITAN';
        this.isTitan = true;
        this.tier = 3;
        this.vehicleName = '🔴 CYBER CRIMSON TITAN X8 🔴';
        this.speedMultiplier = 4.0;
        this.scaleMultiplier = 3.0;

        // Удаление и деактивация 3-го поглощенного вертолета
        if (this.mergePartner) {
            this.mergePartner.isMerged = true;
            this.mergePartner.isBeingMerged = false;
            if (this.mergePartner.group) {
                this.scene.remove(this.mergePartner.group);
            }
            if (this.mergePartner.body && this.world) {
                this.world.removeBody(this.mergePartner.body);
            }
            this.mergePartner = null;
        }

        // Построение красивой 3D модели Титана
        this.buildTitanCrimsonMesh();
        this.group.scale.setScalar(3.0);

        // Безопасное обновление физических коллизий Cannon под пропорции 3X Титана
        if (this.body && this.world) {
            this.world.removeBody(this.body);
            while (this.body.shapes.length > 0) {
                this.body.shapes.pop();
                this.body.shapeOffsets.pop();
                this.body.shapeOrientations.pop();
            }

            this.body.mass = 8500;

            // Фюзеляж 3X
            this.body.addShape(new CANNON.Box(new CANNON.Vec3(3.9, 2.85, 6.9)), new CANNON.Vec3(0, 2.55, 0));
            // Нос 3X
            this.body.addShape(new CANNON.Box(new CANNON.Vec3(3.45, 2.4, 3.6)), new CANNON.Vec3(0, 2.4, 8.1));
            // Крыша 3X
            this.body.addShape(new CANNON.Box(new CANNON.Vec3(3.3, 0.45, 5.1)), new CANNON.Vec3(0, 5.16, 0.3));
            // Хвостовая балка 3X
            this.body.addShape(new CANNON.Box(new CANNON.Vec3(1.35, 1.35, 7.2)), new CANNON.Vec3(0, 2.4, -12.6));

            this.body.updateMassProperties();
            this.body.updateBoundingRadius();
            this.body.aabbNeedsUpdate = true;
            this.world.addBody(this.body);
            this.body.wakeUp();
        }

        // Всплывающее уведомление
        let toast = document.getElementById('mega-heli-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'mega-heli-toast';
            toast.className = 'opt-toast';
            document.body.appendChild(toast);
        }
        toast.innerHTML = '🔴 <b>СВЕРХ-СЛИЯНИЕ 3-ГО УРОВНЯ!</b> CYBER CRIMSON TITAN X8: СКОРОСТЬ 500 КМ/Ч, ТРОЙНОЙ РАЗМЕР И 8 ЛОПАСТЕЙ! 🚁🔥';
        toast.style.borderColor = '#ff0033';
        toast.style.background = 'linear-gradient(135deg, rgba(30, 5, 10, 0.95), rgba(220, 20, 60, 0.6))';
        toast.style.boxShadow = '0 10px 50px rgba(255, 0, 51, 0.85)';
        toast.style.display = 'block';
        setTimeout(() => { if (toast) toast.style.display = 'none'; }, 5500);

        if (window.gameEngine && window.gameEngine.multiplayerHUD) {
            window.gameEngine.multiplayerHUD.addSystemMessage('🔥 CYBER CRIMSON TITAN X8 АКТИВИРОВАН! СКОРОСТЬ 500 КМ/Ч, В 3 РАЗА БОЛЬШЕ, 8 ЛОПАСТЕЙ!');
        }

        const titleElem = document.getElementById('hud-mode-title');
        if (titleElem && this.isPiloted) {
            titleElem.innerText = '🔴 CYBER CRIMSON TITAN X8 🔴';
            titleElem.style.color = '#ff0033';
            titleElem.style.textShadow = '0 0 15px rgba(255, 0, 51, 0.9)';
        }
    }

    getSeatOffset(seatIndex = 0) {
        if (this.isMega) {
            return (seatIndex === 1)
                ? new THREE.Vector3(0.48, 0.25, 0.55)
                : new THREE.Vector3(-0.48, 0.25, 0.55);
        }
        // Место 0 = Пилот (слева), Место 1 = Пассажир (справа)
        return (seatIndex === 1)
            ? new THREE.Vector3(0.38, 0.12, 0.45)
            : new THREE.Vector3(-0.38, 0.12, 0.45);
    }

    getFirstAvailableSeat() {
        if (!this.occupants) this.occupants = [null, null];
        if (!this.occupants[0]) return 0;
        if (!this.occupants[1]) return 1;
        return -1;
    }

    setOccupant(seatIndex, playerId) {
        if (!this.occupants) this.occupants = [null, null];
        if (seatIndex >= 0 && seatIndex < 2) {
            this.occupants[seatIndex] = playerId;
        }
    }

    removeOccupant(playerId) {
        if (!this.occupants) return;
        for (let i = 0; i < 2; i++) {
            if (this.occupants[i] === playerId) {
                this.occupants[i] = null;
            }
        }
    }

    toggleEnterExit(player) {
        if (this.isPiloted || this.isPassenger) {
            // =========================================================================
            // ВЫХОД ИЗ ВЕРТОЛЕТА: Игрок и вертолет СРАЗУ начинают синхронно падать
            // =========================================================================
            const wasPilot = this.isPiloted;
            const curHeliVel = this.body.velocity.clone();

            this.isPiloted = false;
            this.isPassenger = false;
            this.seatIndex = 0;
            this.removeOccupant('local');

            this.targetRotorRPM = 0.0;
            this.rotorRPM = 0.0;
            this.stopAudio();

            player.mesh.scale.set(1, 1, 1);
            player.mesh.visible = true;
            const exitPos = new THREE.Vector3(-2.4 * this.scaleMultiplier, 0, 0).applyQuaternion(this.group.quaternion).add(this.group.position);
            const groundY = (window.gameEngine && window.gameEngine.terrainManager)
                ? window.gameEngine.terrainManager.getTerrainHeight(exitPos.x, exitPos.z)
                : 0.0;
            const spawnY = Math.max(groundY + 0.82, this.group.position.y - 0.15);

            player.mesh.position.set(exitPos.x, spawnY - 0.815, exitPos.z);
            if (player.body) {
                player.body.position.set(exitPos.x, spawnY, exitPos.z);
                player.body.velocity.set(0, 0, 0);
                player.body.wakeUp();
            }

            // Физика падения вертолета быстрее человека при выходе в воздухе
            const isAirExit = (this.group.position.y > groundY + 3.0);
            if (isAirExit) {
                this.body.linearDamping = 0.01;
                this.body.angularDamping = 0.15;
                const curVy = this.body.velocity.y;
                this.body.velocity.y = Math.min(curVy - 12.0, -18.0);
                this.pitchAngle = -0.55; // нос вертолета наклоняется вниз в пике
                this.body.quaternion.setFromEuler(this.pitchAngle, this.headingAngle || 0, this.rollAngle || 0, 'YXZ');
                this.targetRotorRPM = 0.0;
                this.body.wakeUp();
            } else {
                this.body.linearDamping = 0.45;
                this.body.angularDamping = 0.75;
            }

            const modeElem = document.getElementById('stat-player-mode');
            const titleElem = document.getElementById('hud-mode-title');
            if (modeElem) modeElem.innerText = 'Пешком';
            if (titleElem) titleElem.innerText = 'ПРОТАГОНИСТ';

            if (window.gameEngine && window.gameEngine.multiplayerHUD) {
                window.gameEngine.multiplayerHUD.addSystemMessage(`🚁 Вы покинули вертолет ${this.vehicleName}`);
            }
            if (window.gameEngine && window.gameEngine.multiplayerManager) {
                window.gameEngine.multiplayerManager.sendLocalStateNow();
                if (wasPilot) {
                    window.gameEngine.multiplayerManager.broadcastHeliSync(
                        this.body.position.x,
                        this.body.position.y,
                        this.body.position.z,
                        this.headingAngle || 0,
                        0,
                        0,
                        false
                    );
                }
            }
        } else {
            // Посадка в вертолет (Пилот или Пассажир)
            const seatIdx = this.getFirstAvailableSeat();
            if (seatIdx === -1) {
                if (window.gameEngine && window.gameEngine.multiplayerHUD) {
                    window.gameEngine.multiplayerHUD.addSystemMessage('❌ Вертолет полностью заполнен (2/2 мест)!');
                }
                return;
            }

            this.seatIndex = seatIdx;
            this.isPiloted = (seatIdx === 0);
            this.isPassenger = (seatIdx === 1);
            this.setOccupant(seatIdx, 'local');

            // Восстановление нормального демпфирования при посадке
            this.body.linearDamping = 0.45;
            this.body.angularDamping = 0.75;

            // Изоляция физического тела игрока от коллизий с фюзеляжем вертолета
            if (player && player.body) {
                player.body.position.set(0, -500, 0);
                player.body.velocity.set(0, 0, 0);
                player.body.sleep();
            }

            if (this.isPiloted) {
                this.body.velocity.set(0, 0, 0);
                this.body.angularVelocity.set(0, 0, 0);
                this.pitchAngle = 0.0;
                this.rollAngle = 0.0;
                this.rotorRPM = 1.0;
                this.targetRotorRPM = 1.0;
                this.body.wakeUp();
                this.startAudio();
            }

            player.mesh.visible = true;

            const modeElem = document.getElementById('stat-player-mode');
            const titleElem = document.getElementById('hud-mode-title');
            if (modeElem) modeElem.innerText = this.isPiloted ? `Пилот (${this.vehicleName})` : `Пассажир (${this.vehicleName})`;
            if (titleElem) titleElem.innerText = this.vehicleName.toUpperCase();

            if (window.gameEngine && window.gameEngine.multiplayerHUD) {
                if (this.isPiloted) {
                    window.gameEngine.multiplayerHUD.addSystemMessage(`🚁 Вы сели за штурвал ${this.vehicleName}! [Space] Взлет | [Shift] Спуск | [W] Вперед | [S] Назад | [A/D] Поворот`);
                } else {
                    window.gameEngine.multiplayerHUD.addSystemMessage(`🚁 Вы сели на пассажирское место ${this.vehicleName}! [F] Выйти`);
                }
            }
            if (window.gameEngine && window.gameEngine.multiplayerManager) {
                window.gameEngine.multiplayerManager.sendLocalStateNow();
            }
        }
    }

    applyFlightControls(inputKeys, dt) {
        if (!this.isPiloted) return;
        this.body.wakeUp();

        if (this.headingAngle === undefined) {
            this.headingAngle = 0;
        }

        const groundY = (window.gameEngine && window.gameEngine.terrainManager)
            ? window.gameEngine.terrainManager.getTerrainHeight(this.body.position.x, this.body.position.z)
            : 0.0;
        const isGrounded = (this.body.position.y <= groundY + 1.05 * this.scaleMultiplier);

        // 1. Вертикальный подъем, зависание и спуск
        const isAscending = !!(inputKeys.jump || (window.gameEngine && window.gameEngine.inputController && window.gameEngine.inputController.keys && window.gameEngine.inputController.keys.jump));
        const isDescending = !!(inputKeys.sprint || (window.gameEngine && window.gameEngine.inputController && window.gameEngine.inputController.keys && window.gameEngine.inputController.keys.sprint));

        // Скорости масштабируются в зависимости от уровня слияния (Tier 3 = до 500 км/ч)
        let maxAscend = 16.0;
        let maxDescend = -7.5;
        let baseForward = 35.0; // ~125 км/ч
        let baseBackward = -18.0;
        let yawRateCoeff = 1.75;

        if (this.tier === 2) {
            maxAscend = 26.0;
            maxDescend = -12.0;
            baseForward = 70.0; // ~250 км/ч
            baseBackward = -32.0;
            yawRateCoeff = 2.4;
        } else if (this.tier === 3) {
            maxAscend = 42.0;
            maxDescend = -18.0;
            baseForward = 139.0; // ~500 км/ч (CYBER CRIMSON TITAN X8)
            baseBackward = -55.0;
            yawRateCoeff = 3.2;
        }

        const sm = this.speedMultiplier || 1.0;
        const curScale = this.scaleMultiplier || 1.0;

        if (isAscending) {
            this.body.velocity.y += (maxAscend - this.body.velocity.y) * Math.min(1.0, dt * 8.0);
        } else if (isDescending) {
            this.body.velocity.y += (maxDescend - this.body.velocity.y) * Math.min(1.0, dt * 8.0);
        } else if (isGrounded) {
            this.body.velocity.y = 0;
        } else {
            // Идеальное зависание на текущей высоте с компенсацией гравитации
            this.body.velocity.y += (0.0 - this.body.velocity.y) * Math.min(1.0, dt * 6.0);
            if (this._antiGravityForce) {
                this._antiGravityForce.set(0, this.body.mass * 9.82, 0);
                this.body.applyForce(this._antiGravityForce, this.body.position);
            }
        }

        // 2. Управление курсом (Поворот носа влево / вправо)
        let yawRate = 0.0;
        let targetRoll = 0.0;
        if (inputKeys.left) {
            yawRate = yawRateCoeff;
            targetRoll = -0.26;
        }
        if (inputKeys.right) {
            yawRate = -yawRateCoeff;
            targetRoll = 0.26;
        }
        this.headingAngle += yawRate * dt;

        // 3. Тангаж (Pitch / Вперед-Назад / Пикирование носом вниз)
        let targetForwardVel = 0.0;
        let targetPitch = 0.0;

        if (this.isNoseDiving) {
            if (altitudeAboveGround > (6.5 * curScale)) {
                targetPitch = 0.85; // Нос наклонен строго вниз к земле
                targetForwardVel = 4.0 * sm; // Плавное чистое движение вперед
            } else {
                targetPitch = 0.0;
                targetForwardVel = 1.0 * sm;
            }
        } else if (inputKeys.forward) {
            targetForwardVel = baseForward; // Вперед (в зависимости от уровня вертолета)
            targetPitch = 0.24;
        } else if (inputKeys.backward) {
            targetForwardVel = baseBackward; // Назад / торможение
            targetPitch = -0.22;
        }

        this.pitchAngle = THREE.MathUtils.lerp(this.pitchAngle, targetPitch, Math.min(1.0, dt * 5.5));
        this.rollAngle = THREE.MathUtils.lerp(this.rollAngle, targetRoll, Math.min(1.0, dt * 5.5));

        // 4. Стабилизированная аэродинамика движения (без заносов и рывков)
        const fwdX = Math.sin(this.headingAngle);
        const fwdZ = Math.cos(this.headingAngle);
        const rightX = Math.cos(this.headingAngle);
        const rightZ = -Math.sin(this.headingAngle);

        // Упреждающая лучевая защита от туннелирования сквозь стены и фасады зданий на высоких скоростях
        if (this.world && typeof this.world.raycastClosest === 'function' && Math.abs(targetForwardVel) > 0.1 && this._rayResult) {
            const raySign = targetForwardVel > 0 ? 1 : -1;
            const rayDist = (this.isMega ? 4.8 : 3.8) * curScale;
            const from = this._rayFrom.set(this.body.position.x, this.body.position.y, this.body.position.z);
            const to = this._rayTo.set(
                this.body.position.x + fwdX * rayDist * raySign,
                this.body.position.y,
                this.body.position.z + fwdZ * rayDist * raySign
            );
            const rayResult = this._rayResult;
            rayResult.reset();
            this.world.raycastClosest(from, to, { skipBackfaces: true }, rayResult);
            if (rayResult.hasHit && rayResult.body && rayResult.body !== this.body) {
                const safeDist = (this.isMega ? 3.6 : 2.9) * curScale;
                if (rayResult.distance < safeDist) {
                    targetForwardVel = 0;
                }
            }
        }

        if (isGrounded && targetForwardVel === 0) {
            this.body.velocity.x = 0;
            this.body.velocity.z = 0;
        } else {
            const currentForward = this.body.velocity.x * fwdX + this.body.velocity.z * fwdZ;
            const currentLateral = this.body.velocity.x * rightX + this.body.velocity.z * rightZ;

            const newForward = THREE.MathUtils.lerp(currentForward, targetForwardVel, Math.min(1.0, dt * 5.2 * sm));
            const newLateral = this.isNoseDiving ? 0 : (currentLateral * Math.exp(-7.5 * dt));

            this.body.velocity.x = fwdX * newForward + rightX * newLateral;
            this.body.velocity.z = fwdZ * newForward + rightZ * newLateral;
        }

        // Проверка и обработка физических контактов со стенами/зданиями (устраняет эффект погружения внутрь стен)
        if (this.world && this.world.contacts) {
            let obstacleNx = 0;
            let obstacleNz = 0;
            let hasWallHit = false;

            for (let i = 0; i < this.world.contacts.length; i++) {
                const c = this.world.contacts[i];
                if (c.bi === this.body || c.bj === this.body) {
                    const sign = (c.bi === this.body) ? 1 : -1;
                    const nx = c.ni.x * sign;
                    const ny = c.ni.y * sign;
                    const nz = c.ni.z * sign;

                    if (Math.abs(ny) < 0.75) {
                        const len = Math.hypot(nx, nz);
                        if (len > 0.001) {
                            obstacleNx += nx / len;
                            obstacleNz += nz / len;
                            hasWallHit = true;
                        }
                    }
                }
            }

            if (hasWallHit) {
                const nLen = Math.hypot(obstacleNx, obstacleNz);
                if (nLen > 0.001) {
                    obstacleNx /= nLen;
                    obstacleNz /= nLen;

                    const vDot = this.body.velocity.x * obstacleNx + this.body.velocity.z * obstacleNz;
                    if (vDot < 0) {
                        this.body.velocity.x -= vDot * obstacleNx * 1.3;
                        this.body.velocity.z -= vDot * obstacleNz * 1.3;
                    }
                }
            }
        }

        // 5. Ориентация вертолета
        this.body.quaternion.setFromEuler(this.pitchAngle, this.headingAngle, this.rollAngle, 'YXZ');
        this.body.angularVelocity.set(0, 0, 0);

        // Предотвращение проваливания под рельеф с учетом 4X масштаба
        const minHeight = groundY + (0.95 * curScale);
        if (this.body.position.y < minHeight) {
            this.body.position.y = minHeight;
            if (this.body.velocity.y < 0) this.body.velocity.y = 0;
        }
    }

    update(deltaTime, player, inputKeys) {
        const dt = Math.min(deltaTime, 0.1);

        // Обновление процесса слияния двух вертолетов
        if (this.mergeState === 'MERGING') {
            this.updateMerge(dt);
        }

        // 1. Раскрутка / остановка винтов (RPM 0..1)
        if (this.rotorRPM < this.targetRotorRPM) {
            this.rotorRPM = Math.min(1.0, this.rotorRPM + dt * 0.65);
        } else if (this.rotorRPM > this.targetRotorRPM) {
            this.rotorRPM = Math.max(0.0, this.rotorRPM - dt * 0.45);
        }

        // Вращение 3D лопастей (в Мега-Вертолете вращаются еще быстрее и мощнее)
        if (this.rotorRPM > 0.001) {
            const rotSpeed = this.rotorRPM * (this.isMega ? 58.0 : 42.0);
            this.rotorAngle += dt * rotSpeed;
            if (this.mainRotorHub) this.mainRotorHub.rotation.y = this.rotorAngle;

            this.tailRotorAngle += dt * rotSpeed * 1.8;
            if (this.tailRotorHub) this.tailRotorHub.rotation.x = this.tailRotorAngle;

            this.updateAudio(this.rotorRPM);
        }

        // Мигающий маяк на хвосте
        if (this.navBeacon) {
            this.navBeacon.intensity = (Math.sin(Date.now() * 0.008) > 0.6) ? (this.isMega ? 4.5 : 2.5) : 0.2;
        }

        // 2. Управление полетом
        if (this.isPiloted) {
            this.applyFlightControls(inputKeys, dt);
        } else if (this.isRemotelyPiloted) {
            const elapsedSec = Math.min(0.2, (performance.now() - (this.netLastPacketTime || performance.now())) / 1000);
            const predictedPos = this.netTargetPos.clone().addScaledVector(this.netVelocity, elapsedSec);

            const lerpFactor = 1.0 - Math.exp(-22.0 * dt);
            this.body.position.x += (predictedPos.x - this.body.position.x) * lerpFactor;
            this.body.position.y += (predictedPos.y - this.body.position.y) * lerpFactor;
            this.body.position.z += (predictedPos.z - this.body.position.z) * lerpFactor;
            this.body.velocity.copy(this.netVelocity);
            this.group.position.copy(this.body.position);

            let diffYaw = this.netTargetHeading - this.headingAngle;
            while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
            while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
            this.headingAngle += diffYaw * lerpFactor;
            this.pitchAngle += (this.netTargetPitch - this.pitchAngle) * lerpFactor;
            this.rollAngle += (this.netTargetRoll - this.rollAngle) * lerpFactor;

            this.body.quaternion.setFromEuler(this.pitchAngle, this.headingAngle, this.rollAngle, 'YXZ');
            this.group.quaternion.copy(this.body.quaternion);

            this.targetRotorRPM = 1.0;
            if (this.rotorRPM < 0.9) this.rotorRPM = 1.0;
        } else {
            // Неуправляемый вертолет: быстрое аэродинамическое затухание горизонтальной скорости в воздухе (не улетает за горизонт)
            this.body.velocity.x *= Math.exp(-3.2 * dt);
            this.body.velocity.z *= Math.exp(-3.2 * dt);

            // Фиксация на грунте при падении
            const groundY = (window.gameEngine && window.gameEngine.terrainManager)
                ? window.gameEngine.terrainManager.getTerrainHeight(this.body.position.x, this.body.position.z)
                : 0.0;
            const minGroundY = groundY + (this.isMega ? 0.85 : 0.75);
            if (this.body.position.y <= minGroundY) {
                this.body.position.y = minGroundY;
                if (this.body.velocity.y < 0) {
                    this.body.velocity.y = 0;
                    this.body.velocity.x *= 0.5;
                    this.body.velocity.z *= 0.5;
                }
            }
        }

        // 3. Позиционирование локального персонажа внутри кабины (Пилот или Пассажир)
        if (this.isPiloted || this.isPassenger) {
            const seatOffset = this.getSeatOffset(this.seatIndex || 0);
            const worldSeat = seatOffset.clone().applyQuaternion(this.group.quaternion).add(this.group.position);
            if (player && player.mesh) {
                player.mesh.position.copy(worldSeat);
                player.mesh.quaternion.copy(this.group.quaternion);
                player.mesh.scale.set(1.0, 1.0, 1.0);

                const l = player.limbs;
                if (l && l.torso) {
                    l.torso.position.y = 0.38;
                    l.leftLeg.pivot.rotation.x = -1.45;
                    l.rightLeg.pivot.rotation.x = -1.45;
                    l.leftLeg.knee.rotation.x = 1.45;
                    l.rightLeg.knee.rotation.x = 1.45;
                    l.leftArm.pivot.rotation.set(-0.55, 0.15, 0.2);
                    l.rightArm.pivot.rotation.set(-0.55, -0.15, -0.2);
                }
            }

            // Обновление HUD
            const speedKmh = Math.hypot(this.body.velocity.x, this.body.velocity.y, this.body.velocity.z) * 3.6;
            const speedElem = document.getElementById('hud-speed');
            const gearElem = document.getElementById('hud-gear');
            if (speedElem) speedElem.innerText = speedKmh.toFixed(1);
            if (gearElem) {
                if (this.mergeState === 'MERGING') {
                    gearElem.innerText = `⚡ СЛИЯНИЕ: ${Math.round(this.mergeTimer / this.mergeDuration * 100)}%`;
                } else if (this.isPassenger) {
                    gearElem.innerText = `[ПАССАЖИР 2/2]`;
                } else if (this.isNoseDiving) {
                    gearElem.innerText = this.isMega ? `⚡ МЕГА-ПИКИРОВАНИЕ: 100 КМ/Ч` : `⚡ ПИКИРОВАНИЕ: 50 КМ/Ч`;
                } else if (this.isMega) {
                    gearElem.innerText = `⚡ X4 ALT: ${Math.max(0, Math.round(this.body.position.y))}m`;
                } else {
                    gearElem.innerText = `ALT: ${Math.max(0, Math.round(this.body.position.y))}m`;
                }
            }
        }

        // 4. Синхронизация 3D группы с физическим телом Cannon
        this.group.position.copy(this.body.position);
        this.group.quaternion.copy(this.body.quaternion);
    }
}

window.HelicopterVehicle = HelicopterVehicle;
