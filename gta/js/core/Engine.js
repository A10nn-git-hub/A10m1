/**
 * Главный игровой движок (GTAEngine)
 */
class GTAEngine {
    constructor() {
        this.canvas = document.getElementById('webgl-canvas');
        this.container = document.getElementById('game-container');
        this.uiLayer = document.getElementById('ui-layer');
        this.isHudVisible = true;
        window.gameEngine = this;

        this.progressTracker = new LoadingProgressTracker();
        this.fpsElement = document.getElementById('stat-fps');
        this.statChunkElement = document.getElementById('stat-chunk-lod');
        this.currentSectorId = null;

        this.scene = null;
        this.camera = null;
        this.renderer = null;

        this.sky = null;
        this.sunLight = null;
        this.hemiLight = null;
        this.ambientLight = null;
        this.cloudSystem = null;
        this.streetLampManager = null;
        this.dayNightCycle = null;
        this.pedestrianManager = null;
        this.vehicleManager = null;
        this.minimapRenderer = null;
        this.weatherManager = null;
        this.chunkManager = new WorldChunkManager(this.scene, this.world, this.physicsMaterials);
        this.terrainManager = null;
        this.districtGenerator = null;
        this.composer = null;
        this.fxaaPass = null;
        this.ssaoPass = null;
        this.bloomPass = null;
        this.multiplayerManager = null;
        this.multiplayerHUD = null;
        this.gamepadController = null;

        this.world = null;
        this.physicsMaterials = {};
        this.player = { mesh: null, body: null, limbs: {} };
        this.clock = new THREE.Clock();
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        this._allCarsCache = [];
        this.isPowerSavingMode = false;

        this.initAsync();
    }

    async initAsync() {
        const timeoutWatchdog = setTimeout(() => {
            this.progressTracker.showError('Превышено время ожидания сборки игрового мира (60 сек).', 'ERR_TIMEOUT_EXCEEDED');
        }, 60000);

        try {
            await this.progressTracker.setProgress(10, 'Инициализация WebGL 2.0 рендера и сцены...');
            this.initScene();
            this.initCamera();
            this.initRenderer();

            await this.progressTracker.setProgress(20, 'Генерация атмосферного неба Sky Shader и динамического Солнца...');
            this.initDynamicSkyAndSun();

            await this.progressTracker.setProgress(30, 'Создание процедурного 3D-ландшафта и Heightfield-физики Cannon.js...');
            this.initPhysicsWorld();
            this.initGround();

            await this.progressTracker.setProgress(35, 'Создание бескрайнего океана и атмосферы...');
            this.oceanManager = new InfiniteOceanManager(this.scene);
            this.mountainManager = null;

            // Классический режим: все объекты добавляются напрямую в сцену в 100% High-LOD
            this.chunkManager = null;

            await this.progressTracker.setProgress(42, 'Генерация городской дорожной сети и перекрестков...');
            this.roadNetwork = new CityRoadNetwork(this.scene, this.world, this.physicsMaterials, null);

            await this.progressTracker.setProgress(54, 'Строительство жилого сектора, коммерческих и индустриальных районов...');
            this.initResidentialHouses();
            this.orgBuildingBuilder = new OrganizationBuildingBuilder(this.scene, this.world, this.physicsMaterials);
            this.districtGenerator = new DistrictGenerator(this.scene, this.world, this.physicsMaterials, null);

            await this.progressTracker.setProgress(58, 'Посадка сельхозполей, кустарников и деревьев (InstancedMesh + Wind Shader)...');
            this.vegetationManager = new VegetationAndCropsManager(this.scene, this.world, this.terrainManager, this.physicsMaterials);

            await this.progressTracker.setProgress(60, 'Монтаж лифтовой системы небоскреба Maze Bank (10 этажей)...');
            this.elevatorSystem = new SkyscraperElevatorSystem(this.scene, this.world, this.physicsMaterials);

            await this.progressTracker.setProgress(66, 'Монтаж уличных фонарей со сплошными коллайдерами...');
            this.streetLampManager = new StreetLampManager(this.scene, this.world, this.physicsMaterials);

            await this.progressTracker.setProgress(76, 'Инициализация автомобильного освещения (Spot Shadows, стоп-сигналы)...');
            this.vehicleManager = new VehicleManager(this.scene, this.world, this.physicsMaterials);

            // Спавн 1 управляемого вертолета в случайном месте на карте (вертолетная площадка Maze Bank, крыша госпиталя, LSPD или стоянка)
            const heliSpawns = [
                { x: -3.5, y: 93.0, z: 0.0, rot: 0 },
                { x: 45.0, y: 7.2, z: -45.0, rot: Math.PI / 2 },
                { x: 0.0, y: 7.0, z: 25.0, rot: Math.PI },
                { x: -60.0, y: 0.8, z: -60.0, rot: -Math.PI / 4 }
            ];
            const spawnPoint = heliSpawns[Math.floor(Math.random() * heliSpawns.length)];
            this.helicopter = new HelicopterVehicle(this.scene, this.world, this.physicsMaterials, spawnPoint.x, spawnPoint.y, spawnPoint.z, spawnPoint.rot);

            await this.progressTracker.setProgress(80, 'Инициализация AI-системы автономного ambient-трафика (24 авто)...');
            this.ambientTrafficManager = new AmbientTrafficManager(
                this.scene, this.world, this.physicsMaterials, this.terrainManager, this.roadNetwork
            );

            await this.progressTracker.setProgress(84, 'Инициализация интерактивных футболистов, обхода авто и нокдауна...');
            this.pedestrianManager = new PedestrianNPCManager(this.scene, this.world, this.physicsMaterials, this.camera);
            this.dayNightCycle = new DayNightCycleManager(
                this.scene, this.sky, this.sunLight, this.hemiLight, this.ambientLight,
                this.streetLampManager, this.houseBuilder, this.orgBuildingBuilder
            );
            this.cloudSystem = new DynamicCloudSystem(this.scene);

            await this.progressTracker.setProgress(90, 'Создание динамической погоды (частицы дождя, туман, мокрый асфальт)...');
            this.weatherManager = new DynamicWeatherManager(this.scene, this.roadNetwork, this.dayNightCycle);
            this.minimapRenderer = new MinimapRenderer();

            await this.progressTracker.setProgress(92, 'Настройка триггерных зон районов карты (12 районов, GTA-HUD)...');
            this.districtManager = new NeighborhoodDistrictManager();

            await this.progressTracker.setProgress(94, 'Настройка пост-процессинга AAA-уровня (FXAA, SSAO, Bloom)...');
            this.initPostProcessing();

            await this.progressTracker.setProgress(96, 'Инициализация 3D Spatial Audio Engine (Web Audio API, Foley, Ambience)...');
            window.soundEngine = new SpatialSoundEngine();
            this.soundEngine = window.soundEngine;

            await this.progressTracker.setProgress(98, 'Сборка высокодетализированной модели протагониста и горячих клавиш...');
            this.initPlayer();
            this.initControllers();
            this.initEvents();

            // Инициализация сетевого мультиплеера на базе Firebase Realtime Database
            this.multiplayerManager = new MultiplayerManager(this.scene);
            this.multiplayerHUD = new MultiplayerHUD(this.multiplayerManager);
            this.multiplayerManager.connect();

            clearTimeout(timeoutWatchdog);
            await this.progressTracker.complete();

            this.animate = this.animate.bind(this);
            requestAnimationFrame(this.animate);
        } catch (err) {
            clearTimeout(timeoutWatchdog);
            console.error('Критическая ошибка сборки движка:', err);
            this.progressTracker.showError(`Произошла ошибка: ${err.message || err}`, 'ERR_INIT_CRASH');
        }
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x5c9ce6);
        this.scene.fog = new THREE.Fog(0x5c9ce6, 280, 850);
    }

    initCamera() {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(65, aspect, 0.2, 1400);
        this.camera.position.set(0, 3.2, 19.5);
        this.camera.lookAt(0, 1.5, 15.0);
    }

    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas, antialias: true, powerPreference: "high-performance", precision: "highp"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
    }

    initPostProcessing() {
        // Прямой высокопроизводительный WebGL2 рендеринг без затемняющего SSAO
        // гарантирует стабильные 60 FPS и сочную оригинальную цветовую гамму
    }

    initDynamicSkyAndSun() {
        this.sky = null;

        this.sunLight = new THREE.DirectionalLight(0xfffaea, 2.0);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 1024;
        this.sunLight.shadow.mapSize.height = 1024;
        this.sunLight.shadow.camera.near = 10;
        this.sunLight.shadow.camera.far = 200;
        const shadowExtent = 42;
        this.sunLight.shadow.camera.left = -shadowExtent;
        this.sunLight.shadow.camera.right = shadowExtent;
        this.sunLight.shadow.camera.top = shadowExtent;
        this.sunLight.shadow.camera.bottom = -shadowExtent;
        this.sunLight.shadow.bias = -0.0001;
        this.sunLight.shadow.normalBias = 0.02;

        this.scene.add(this.sunLight);
        this.scene.add(this.sunLight.target);

        this.hemiLight = new THREE.HemisphereLight(0xdfeeff, 0x42382e, 0.65);
        this.hemiLight.position.set(0, 200, 0);
        this.scene.add(this.hemiLight);

        this.ambientLight = new THREE.AmbientLight(0xfffaed, 0.45);
        this.scene.add(this.ambientLight);
    }

    initPhysicsWorld() {
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.82, 0);
        this.world.broadphase = new CANNON.SAPBroadphase(this.world);
        this.world.solver.iterations = this.isMobileDevice ? 3 : 6;

        this.physicsMaterials.ground = new CANNON.Material('ground');
        this.physicsMaterials.wall = new CANNON.Material('wall');
        this.physicsMaterials.player = new CANNON.Material('player');
        this.physicsMaterials.ball = new CANNON.Material('ball');

        // Невидимые физические границы по краю мира (предотвращают падение за карту)
        const boundH = 60.0; const boundThick = 2.0; const boundSize = 580.0; const boundDist = 285.0;
        const bounds = [
            { x: 0, y: boundH / 2, z: -boundDist, w: boundSize, h: boundH, d: boundThick },
            { x: 0, y: boundH / 2, z: boundDist, w: boundSize, h: boundH, d: boundThick },
            { x: boundDist, y: boundH / 2, z: 0, w: boundThick, h: boundH, d: boundSize },
            { x: -boundDist, y: boundH / 2, z: 0, w: boundThick, h: boundH, d: boundSize }
        ];
        for (const b of bounds) {
            const bBody = new CANNON.Body({ mass: 0, material: this.physicsMaterials.wall, position: new CANNON.Vec3(b.x, b.y, b.z) });
            bBody.addShape(new CANNON.Box(new CANNON.Vec3(b.w / 2, b.h / 2, b.d / 2)));
            this.world.addBody(bBody);
        }

        this.world.addContactMaterial(new CANNON.ContactMaterial(
            this.physicsMaterials.ground, this.physicsMaterials.player, { friction: 0.05, restitution: 0.0 }
        ));
        this.world.addContactMaterial(new CANNON.ContactMaterial(
            this.physicsMaterials.wall, this.physicsMaterials.player, { friction: 0.0, restitution: 0.0 }
        ));
        this.world.addContactMaterial(new CANNON.ContactMaterial(
            this.physicsMaterials.ground, this.physicsMaterials.ball, { friction: 0.35, restitution: 0.78 }
        ));
        this.world.addContactMaterial(new CANNON.ContactMaterial(
            this.physicsMaterials.wall, this.physicsMaterials.ball, { friction: 0.3, restitution: 0.82 }
        ));

        // Базовая нерушимая физическая плоскость на уровне Y = 0 (гарантия защиты от падения сквозь пол)
        const groundBody = new CANNON.Body({ mass: 0, material: this.physicsMaterials.ground });
        groundBody.allowSleep = true;
        groundBody.sleep();
        groundBody.addShape(new CANNON.Plane());
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        this.world.addBody(groundBody);
    }

    initGround() {
        // STEP 31: Создание процедурного 3D-ландшафта с биомами (Город, Холмы, Сельские равнины) и физикой Heightfield
        this.terrainManager = new ProceduralTerrainManager(this.scene, this.world, this.physicsMaterials);
    }

    initResidentialHouses() {
        this.houseBuilder = new SuburbanHouseBuilder(this.scene, this.world, this.physicsMaterials, this.chunkManager);
        // Полноценные жилые дома с открывающимися дверьми, мебелью и интерьером
        const housePlacements = [
            // Квадрант NW
            { x: -90, z: -90, rot: 0, s: 0 },
            { x: -90, z: -150, rot: 0, s: 1 },
            { x: -150, z: -90, rot: Math.PI / 2, s: 2 },
            
            // Квадрант NE
            { x: 90, z: -90, rot: 0, s: 1 },
            { x: 90, z: -150, rot: 0, s: 2 },
            { x: 150, z: -90, rot: -Math.PI / 2, s: 0 },

            // Квадрант SW
            { x: -90, z: 90, rot: Math.PI, s: 2 },
            { x: -90, z: 150, rot: Math.PI, s: 0 },
            { x: -150, z: 90, rot: Math.PI / 2, s: 1 },

            // Квадрант SE
            { x: 90, z: 90, rot: Math.PI, s: 3 },
            { x: 90, z: 150, rot: Math.PI, s: 1 },
            { x: 150, z: 90, rot: -Math.PI / 2, s: 0 }
        ];
        for (let i = 0; i < housePlacements.length; i++) {
            const hp = housePlacements[i];
            this.houseBuilder.createHouse(hp.x, hp.z, hp.rot, hp.s);
        }
    }

    initPlayer() {
        const playerGroup = new THREE.Group();
        const limbs = {};

        const matSkin = new THREE.MeshLambertMaterial({ color: 0xdca17a });
        const matJacket = new THREE.MeshLambertMaterial({ color: 0x1f2a38 });
        const matShirt = new THREE.MeshLambertMaterial({ color: 0xeaeaea });
        const matPants = new THREE.MeshLambertMaterial({ color: 0x2b333e });
        const matShoes = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const matSole = new THREE.MeshLambertMaterial({ color: 0xdddddd });
        const matGlasses = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
        const matGlassesFrame = new THREE.MeshBasicMaterial({ color: 0xd4af37 });
        const matBelt = new THREE.MeshLambertMaterial({ color: 0x151515 });
        const matBuckle = new THREE.MeshLambertMaterial({ color: 0xcccccc });

        const torsoGroup = new THREE.Group();
        torsoGroup.position.set(0, 1.15, 0);

        const chestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.45, 0.28), matJacket);
        chestMesh.position.set(0, 0.1, 0);
        chestMesh.castShadow = true; chestMesh.receiveShadow = true;
        torsoGroup.add(chestMesh);

        const innerShirtMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.35, 0.05), matShirt);
        innerShirtMesh.position.set(0, 0.12, 0.12);
        torsoGroup.add(innerShirtMesh);

        const bellyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.25), matJacket);
        bellyMesh.position.set(0, -0.18, 0); bellyMesh.castShadow = true;
        torsoGroup.add(bellyMesh);

        const beltMesh = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 0.27), matBelt);
        beltMesh.position.set(0, -0.28, 0);
        torsoGroup.add(beltMesh);

        const buckleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.04), matBuckle);
        buckleMesh.position.set(0, -0.28, 0.14);
        torsoGroup.add(buckleMesh);

        const holsterMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.12), matBelt);
        holsterMesh.position.set(0.26, -0.28, 0);
        torsoGroup.add(holsterMesh);

        playerGroup.add(torsoGroup);
        limbs.torso = torsoGroup;

        const headGroup = new THREE.Group();
        headGroup.position.set(0, 0.38, 0);

        const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.12, 12), matSkin);
        neckMesh.position.set(0, -0.02, 0); neckMesh.castShadow = true;
        headGroup.add(neckMesh);

        const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.28, 0.26), matSkin);
        headMesh.position.set(0, 0.16, 0); headMesh.castShadow = true;
        headGroup.add(headMesh);

        const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.1, 0.28), new THREE.MeshStandardMaterial({ color: 0x221811, roughness: 0.9 }));
        hairMesh.position.set(0, 0.27, -0.01);
        headGroup.add(hairMesh);

        const glassesMesh = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.07, 0.04), matGlasses);
        glassesMesh.position.set(0, 0.17, 0.14);
        headGroup.add(glassesMesh);

        const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, 0.05), matGlassesFrame);
        frameMesh.position.set(0, 0.2, 0.14);
        headGroup.add(frameMesh);

        torsoGroup.add(headGroup);
        limbs.head = headGroup;

        const createArm = (isLeft) => {
            const side = isLeft ? 1 : -1;
            const armPivot = new THREE.Group();
            armPivot.position.set(side * 0.32, 0.26, 0);

            const shoulderMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.16), matJacket);
            shoulderMesh.position.set(0, -0.12, 0); shoulderMesh.castShadow = true;
            armPivot.add(shoulderMesh);

            const forearmPivot = new THREE.Group();
            forearmPivot.position.set(0, -0.26, 0);

            const forearmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.26, 0.13), matSkin);
            forearmMesh.position.set(0, -0.11, 0); forearmMesh.castShadow = true;
            forearmPivot.add(forearmMesh);

            const handMesh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.08), matSkin);
            handMesh.position.set(0, -0.26, 0); handMesh.castShadow = true;
            forearmPivot.add(handMesh);

            if (isLeft) {
                const watchMesh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.04, 0.14), matGlassesFrame);
                watchMesh.position.set(0, -0.21, 0);
                forearmPivot.add(watchMesh);
            }

            armPivot.add(forearmPivot);
            torsoGroup.add(armPivot);
            return { pivot: armPivot, forearm: forearmPivot };
        };

        limbs.leftArm = createArm(true);
        limbs.rightArm = createArm(false);

        const createLeg = (isLeft) => {
            const side = isLeft ? 1 : -1;
            const hipPivot = new THREE.Group();
            hipPivot.position.set(side * 0.14, 0.88, 0);

            const thighMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, 0.2), matPants);
            thighMesh.position.set(0, -0.2, 0); thighMesh.castShadow = true;
            hipPivot.add(thighMesh);

            const kneePivot = new THREE.Group();
            kneePivot.position.set(0, -0.42, 0);

            const calfMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, 0.18), matPants);
            calfMesh.position.set(0, -0.18, 0); calfMesh.castShadow = true;
            kneePivot.add(calfMesh);

            const shoePivot = new THREE.Group();
            shoePivot.position.set(0, -0.38, 0);

            const shoeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.28), matShoes);
            shoeMesh.position.set(0, 0.04, 0.04); shoeMesh.castShadow = true;
            shoePivot.add(shoeMesh);

            const soleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.04, 0.29), matSole);
            soleMesh.position.set(0, -0.01, 0.04);
            shoePivot.add(soleMesh);

            kneePivot.add(shoePivot);
            hipPivot.add(kneePivot);
            playerGroup.add(hipPivot);
            return { pivot: hipPivot, knee: kneePivot };
        };

        limbs.leftLeg = createLeg(true);
        limbs.rightLeg = createLeg(false);

        this.scene.add(playerGroup);
        this.player.mesh = playerGroup;
        this.player.limbs = limbs;

        const capsuleRadius = 0.36;
        const capsuleHeight = 0.96;
        const spawnOffset = (Math.random() - 0.5) * 3.0;
        const playerBody = new CANNON.Body({
            mass: 75,
            material: this.physicsMaterials.player,
            position: new CANNON.Vec3(spawnOffset, 1.5, 15.0),
            linearDamping: 0.05,
            fixedRotation: true
        });

        const cylinderShape = new CANNON.Cylinder(capsuleRadius, capsuleRadius, capsuleHeight, 16);
        const qCyl = new CANNON.Quaternion();
        qCyl.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
        playerBody.addShape(cylinderShape, new CANNON.Vec3(0, 0, 0), qCyl);
        playerBody.addShape(new CANNON.Sphere(capsuleRadius), new CANNON.Vec3(0, capsuleHeight / 2, 0));
        playerBody.addShape(new CANNON.Sphere(capsuleRadius), new CANNON.Vec3(0, -capsuleHeight / 2, 0));

        this.world.addBody(playerBody);
        this.player.body = playerBody;
    }

    initControllers() {
        this.inputController = new InputController();
        this.mainMenuManager = new MainMenuManager(this.inputController);
        this.thirdPersonCamera = new ThirdPersonCameraController(this.camera, this.player.mesh, this.container);
        this.playerController = new PlayerController(this.player, this.thirdPersonCamera, this.inputController, this.world);
        this.mobileTouchController = new MobileTouchController(this);
        this.gamepadController = new GamepadController(this.inputController, this.thirdPersonCamera);

        this.inputController.onTimeAdvance = (hrs) => { if (this.dayNightCycle) this.dayNightCycle.advanceTime(hrs); };
        this.inputController.onSeasonChange = () => { if (this.dayNightCycle) this.dayNightCycle.changeSeason(); };

        this.inputController.onToggleVehicle = () => {
            if (this.helicopter && (this.helicopter.isPiloted || this.helicopter.isPassenger)) {
                this.helicopter.toggleEnterExit(this.player);
                return;
            }
            if (this.helicopter && !this.helicopter.isPiloted && !this.helicopter.isPassenger && this.player && this.player.body && (!this.vehicleManager || !this.vehicleManager.activeDrivenCar)) {
                const distToHeli = Math.hypot(this.player.body.position.x - this.helicopter.group.position.x, this.player.body.position.z - this.helicopter.group.position.z);
                const dy = Math.abs(this.player.body.position.y - this.helicopter.group.position.y);
                if (distToHeli < 4.5 && dy < 3.5) {
                    this.helicopter.toggleEnterExit(this.player);
                    return;
                }
            }
            if (this.vehicleManager) {
                this.vehicleManager.toggleEnterExitVehicle(this.player);
            }
        };

        this.inputController.onToggleHeadlights = () => {
            if (this.vehicleManager && this.vehicleManager.activeDrivenCar) {
                const state = this.vehicleManager.toggleActiveCarHeadlights();
                const el = document.getElementById('stat-car-lights');
                if (el) {
                    el.innerText = state ? 'ВКЛ [L]' : 'ВЫКЛ [L]';
                    el.style.color = state ? '#00e5ff' : '#8fa3b7';
                }
            }
        };

        // STEP 24: Переключение погоды (Ясно / Морось / Дождь / Ливень) клавишей U
        this.inputController.onToggleWeather = () => {
            if (this.weatherManager) {
                this.weatherManager.cycleWeather();
            }
        };

        // STEP 28: Обработка клавиш 1-9 и 0 для перемещения лифта Maze Bank
        this.inputController.onSelectFloor = (floorNum) => {
            if (this.elevatorSystem) {
                this.elevatorSystem.selectFloor(floorNum);
            }
        };

        // Взаимодействие [E] (Залезть / слезть с дерева)
        this.inputController.onInteract = () => {
            if (this.playerController) {
                this.playerController.toggleClimbTree();
            }
        };

        this.inputController.onToggleHud = () => {
            this.isHudVisible = !this.isHudVisible;
            if (this.uiLayer) {
                if (this.isHudVisible) {
                    this.uiLayer.classList.remove('hud-hidden');
                } else {
                    this.uiLayer.classList.add('hud-hidden');
                }
            }
        };

        if (this.mainMenuManager && this.mainMenuManager.isPowerSavingMode) {
            this.setPowerSavingMode(true, false);
        }
    }

    initEvents() {
        window.addEventListener('resize', () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);

            if (this.composer) {
                this.composer.setSize(width, height);
                const pixelRatio = this.renderer.getPixelRatio();
                if (this.fxaaPass) {
                    this.fxaaPass.material.uniforms['resolution'].value.x = 1 / (width * pixelRatio);
                    this.fxaaPass.material.uniforms['resolution'].value.y = 1 / (height * pixelRatio);
                }
                if (this.ssaoPass) {
                    this.ssaoPass.setSize(width, height);
                }
            }
        });
    }

    updatePhysics(deltaTime) {
        if (this.isPowerSavingMode) {
            this.world.step(1 / 60, Math.min(deltaTime, 0.04), 1);
        } else {
            this.world.step(1 / 60, Math.min(deltaTime, 0.1), 3);
        }

        const isDriving = this.vehicleManager && this.vehicleManager.activeDrivenCar !== null;
        const isTransitioning = this.vehicleManager && (this.vehicleManager.transitionState === 'ENTERING_VEHICLE' || this.vehicleManager.transitionState === 'EXITING_VEHICLE');
        const isInsideElevator = this.elevatorSystem && this.elevatorSystem.isPlayerInside;

        if (!isDriving && !isTransitioning && this.player.mesh && this.player.body) {
            const groundY = (this.terrainManager) ? this.terrainManager.getTerrainHeight(this.player.body.position.x, this.player.body.position.z) : 0.0;
            if (!isInsideElevator && this.playerController && this.playerController.isGrounded && this.player.body.position.y <= groundY + 1.2) {
                this.player.body.position.y = groundY + 0.815;
                this.player.body.velocity.y = 0;
            }
            this.player.mesh.position.set(
                this.player.body.position.x,
                this.player.body.position.y - 0.815,
                this.player.body.position.z
            );
        }

        if (this.sunLight && this.dayNightCycle && this.player.mesh) {
            const focusPos = isDriving
                ? this.vehicleManager.activeDrivenCar.chassisBody.position
                : this.player.mesh.position;

            this.sunLight.position.set(focusPos.x, focusPos.y + 140.0, focusPos.z);
            this.sunLight.target.position.copy(focusPos);
            this.sunLight.target.updateMatrixWorld();
        }
    }

    setPowerSavingMode(enabled, showToast = true) {
        this.isPowerSavingMode = !!enabled;

        // 1. Скрытие/отображение пешеходов и физических мячей
        if (this.pedestrianManager) {
            const peds = this.pedestrianManager.pedestrians || [];
            for (let i = 0; i < peds.length; i++) {
                const p = peds[i];
                if (p.group) p.group.visible = !this.isPowerSavingMode;
                if (p.body) {
                    if (this.isPowerSavingMode) {
                        p.body.velocity.set(0, 0, 0);
                        p.body.angularVelocity.set(0, 0, 0);
                        p.body.sleep();
                    } else {
                        p.body.wakeUp();
                    }
                }
            }
            const balls = this.pedestrianManager.soccerBalls || [];
            for (let i = 0; i < balls.length; i++) {
                const b = balls[i];
                if (b.mesh) b.mesh.visible = !this.isPowerSavingMode;
                if (b.body) {
                    if (this.isPowerSavingMode) {
                        b.body.velocity.set(0, 0, 0);
                        b.body.sleep();
                    } else {
                        b.body.wakeUp();
                    }
                }
            }
        }

        // 2. Скрытие/отображение автономного ambient-трафика
        if (this.ambientTrafficManager) {
            const cars = this.ambientTrafficManager.vehicles || [];
            for (let i = 0; i < cars.length; i++) {
                const c = cars[i];
                if (c.group) c.group.visible = !this.isPowerSavingMode;
                if (c.chassisBody) {
                    if (this.isPowerSavingMode) {
                        c.chassisBody.velocity.set(0, 0, 0);
                        c.chassisBody.angularVelocity.set(0, 0, 0);
                        c.chassisBody.sleep();
                    } else {
                        c.chassisBody.wakeUp();
                    }
                }
            }
        }

        // 3. Очистка полицейских машин
        if (this.policeManager && this.isPowerSavingMode) {
            this.policeManager.clearAllPolice();
        }

        // 4. Оптимизация машин в автопарке (отключение фар/точечных источников и сон)
        if (this.vehicleManager && typeof this.vehicleManager.setPowerSavingMode === 'function') {
            this.vehicleManager.setPowerSavingMode(this.isPowerSavingMode);
        }

        // 5. Оптимизация уличных фонарей (отключение точечных источников света)
        if (this.streetLampManager && this.streetLampManager.activeDynamicLights) {
            if (this.isPowerSavingMode) {
                for (let i = 0; i < this.streetLampManager.activeDynamicLights.length; i++) {
                    this.streetLampManager.activeDynamicLights[i].intensity = 0.0;
                }
            }
        }

        // 6. Оптимизация погоды (отключение тяжелых частиц дождя)
        if (this.weatherManager && this.isPowerSavingMode) {
            this.weatherManager.rainIntensity = 0.0;
            this.weatherManager.wetness = 0.0;
            if (this.weatherManager.rainLines) this.weatherManager.rainLines.visible = false;
        }

        // 7. Оптимизация рендерера и графики для 30-60 FPS на слабых устройствах
        if (this.renderer) {
            if (this.isPowerSavingMode) {
                // Отключаем тени полностью (минус 50% нагрузки на GPU)
                this.renderer.shadowMap.enabled = false;
                this.renderer.shadowMap.autoUpdate = false;
                if (this.sunLight) this.sunLight.castShadow = false;
                // Снижаем разрешение рендеринга для слабого мобильного GPU
                this.renderer.setPixelRatio(Math.min(window.devicePixelRatio * 0.55, 0.65));
                if (this.camera) this.camera.far = 280;
                if (this.scene && this.scene.fog) {
                    this.scene.fog.near = 90;
                    this.scene.fog.far = 270;
                }
                if (this.world) this.world.solver.iterations = 2;
            } else {
                // Возврат к стандартным настройкам
                this.renderer.shadowMap.enabled = true;
                this.renderer.shadowMap.autoUpdate = true;
                if (this.sunLight) this.sunLight.castShadow = true;
                this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
                if (this.camera) this.camera.far = 1400;
                if (this.scene && this.scene.fog) {
                    this.scene.fog.near = 280;
                    this.scene.fog.far = 850;
                }
                if (this.world) this.world.solver.iterations = this.isMobileDevice ? 3 : 6;
            }

            if (this.camera) this.camera.updateProjectionMatrix();
        }

        // 8. Обновление индикатора режима в статусе
        const modeEl = document.getElementById('stat-player-mode');
        if (modeEl) {
            const isDriving = this.vehicleManager && this.vehicleManager.activeDrivenCar !== null;
            const modeBase = isDriving ? 'За рулем' : 'Пешком';
            modeEl.innerText = this.isPowerSavingMode ? `${modeBase} [ЭКО ⚡]` : modeBase;
        }

        if (showToast) {
            this.showPowerSavingToast(this.isPowerSavingMode);
        }
    }

    showPowerSavingToast(enabled) {
        let toast = document.getElementById('opt-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'opt-toast';
            toast.className = 'opt-toast';
            document.body.appendChild(toast);
        }
        if (enabled) {
            toast.innerHTML = '⚡ <b>Энергосбережение:</b> Все боты отключены, тени выключены, максимальный FPS';
            toast.style.borderColor = '#10b981';
            toast.style.boxShadow = '0 10px 30px rgba(16, 185, 129, 0.4)';
        } else {
            toast.innerHTML = '🔋 <b>Стандартный режим:</b> Боты и трафик включены, стандартная графика';
            toast.style.borderColor = '#00e5ff';
            toast.style.boxShadow = '0 10px 30px rgba(0, 229, 255, 0.4)';
        }
        toast.style.display = 'block';
        setTimeout(() => { if (toast) toast.style.display = 'none'; }, 3500);
    }

    setQualityMode(mode = 'LOW', showToast = false) {
        this.qualityMode = mode;
        if (!this.renderer) return;

        if (mode === 'LOW') {
            // Режим 60 FPS для планшетов и мобильных
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio * 0.7, 0.85));
            this.renderer.shadowMap.enabled = false;
            if (this.sunLight) this.sunLight.castShadow = false;
            if (this.camera) this.camera.far = 450;
            if (this.scene && this.scene.fog) { this.scene.fog.near = 140; this.scene.fog.far = 420; }
            if (this.world) this.world.solver.iterations = 3;
        } else if (mode === 'MEDIUM') {
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio * 0.85, 1.0));
            this.renderer.shadowMap.enabled = true;
            if (this.sunLight) this.sunLight.castShadow = true;
            if (this.camera) this.camera.far = 700;
            if (this.scene && this.scene.fog) { this.scene.fog.near = 200; this.scene.fog.far = 650; }
            if (this.world) this.world.solver.iterations = 5;
        } else {
            // HIGH (ПК)
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
            this.renderer.shadowMap.enabled = true;
            if (this.sunLight) this.sunLight.castShadow = true;
            if (this.camera) this.camera.far = 1400;
            if (this.scene && this.scene.fog) { this.scene.fog.near = 280; this.scene.fog.far = 850; }
            if (this.world) this.world.solver.iterations = 7;
        }

        if (this.camera) this.camera.updateProjectionMatrix();

        if (showToast) {
            this.showOptimizationToast();
        }
    }

    showOptimizationToast() {
        let toast = document.getElementById('opt-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'opt-toast';
            toast.className = 'opt-toast';
            toast.innerHTML = '⚡ <b>Оптимизация:</b> Включен режим 60 FPS для планшета';
            document.body.appendChild(toast);
        }
        toast.style.display = 'block';
        setTimeout(() => { if (toast) toast.style.display = 'none'; }, 4000);
    }

    updateSectorHUD(focusPos) {
        if (!focusPos || !this.statChunkElement) return;
        const pCol = Math.max(0, Math.min(4, Math.floor((focusPos.x + 150) / 60.0)));
        const pRow = Math.max(0, Math.min(3, Math.floor((focusPos.z + 120) / 60.0)));
        const sId = pRow * 5 + pCol + 1;
        if (this.currentSectorId !== sId) {
            this.currentSectorId = sId;
            const sStr = String(sId).padStart(2, '0');
            this.statChunkElement.innerText = `СЕКТОР ${sStr}`;
        }
    }

    animate() {
        requestAnimationFrame(this.animate);

        // Если открыто главное меню — игра полностью на паузе, фоновая симуляция заморожена
        if (this.mainMenuManager && this.mainMenuManager.isMenuOpen) {
            return;
        }

        const delta = this.clock.getDelta();
        const elapsedTime = this.clock.getElapsedTime();

        // Опрос физического геймпада / контроллера (Gamepad API)
        if (this.gamepadController) {
            this.gamepadController.update(delta);
        }

        const isDriving = this.vehicleManager && this.vehicleManager.activeDrivenCar !== null;
        const isTransitioning = this.vehicleManager && (this.vehicleManager.transitionState === 'ENTERING_VEHICLE' || this.vehicleManager.transitionState === 'EXITING_VEHICLE');

        const balls = (this.pedestrianManager && !this.isPowerSavingMode) ? this.pedestrianManager.soccerBalls : [];
        const activeCar = (this.vehicleManager && this.vehicleManager.activeDrivenCar)
            ? this.vehicleManager.activeDrivenCar
            : null;
        const showcaseCars = (this.vehicleManager && this.vehicleManager.cars) ? this.vehicleManager.cars : [];
        const ambientCars = (this.ambientTrafficManager && this.ambientTrafficManager.vehicles && !this.isPowerSavingMode) ? this.ambientTrafficManager.vehicles : [];
        this._allCarsCache.length = 0;
        for (let i = 0; i < showcaseCars.length; i++) this._allCarsCache.push(showcaseCars[i]);
        for (let i = 0; i < ambientCars.length; i++) this._allCarsCache.push(ambientCars[i]);
        const allCars = this._allCarsCache;

        const focusPos = isDriving
            ? this.vehicleManager.activeDrivenCar.chassisBody.position
            : (this.player.mesh ? this.player.mesh.position : (this.player.body ? this.player.body.position : null));

        this.updateSectorHUD(focusPos);

        if (this.sky && this.camera) {
            this.sky.position.copy(this.camera.position);
        }

        if (this.dayNightCycle) {
            this.dayNightCycle.update(delta, focusPos);
        }

        if (this.playerController) {
            this.playerController.update(delta, isDriving || isTransitioning, balls);
        }

        if (this.vehicleManager) {
            this.vehicleManager.update(delta, this.player, this.inputController ? this.inputController.keys : {});
        }

        // Обновление физики и анимации вертолета
        if (this.helicopter) {
            this.helicopter.update(delta, this.player, this.inputController ? this.inputController.keys : {});

            if (!this.helicopter.isPiloted && !this.helicopter.isPassenger && this.player && this.player.body && (!this.vehicleManager || !this.vehicleManager.activeDrivenCar)) {
                const distToHeli = Math.hypot(this.player.body.position.x - this.helicopter.group.position.x, this.player.body.position.z - this.helicopter.group.position.z);
                const dy = Math.abs(this.player.body.position.y - this.helicopter.group.position.y);
                const promptElement = document.getElementById('vehicle-prompt');
                const promptActionText = document.getElementById('prompt-action-text');
                const promptCarName = document.getElementById('prompt-car-name');
                if (distToHeli < 4.5 && dy < 3.5) {
                    if (promptElement) {
                        promptElement.style.display = 'block';
                        if (promptCarName) promptCarName.innerText = this.helicopter.vehicleName;
                        const seatIdx = this.helicopter.getFirstAvailableSeat();
                        if (promptActionText) {
                            if (seatIdx === 0) {
                                promptActionText.innerText = 'Сесть за штурвал вертолета (Пилот 1/2) [F]';
                            } else if (seatIdx === 1) {
                                promptActionText.innerText = 'Сесть пассажиром в вертолет (Пассажир 2/2) [F]';
                            } else {
                                promptActionText.innerText = 'Вертолет полон (2/2 мест)';
                            }
                        }
                    }
                }
            }
        }

        // Подсказка для лазанья по деревьям
        if (this.playerController && this.player && this.player.body && !isDriving && (!this.helicopter || (!this.helicopter.isPiloted && !this.helicopter.isPassenger))) {
            const promptElement = document.getElementById('vehicle-prompt');
            const promptActionText = document.getElementById('prompt-action-text');
            const promptCarName = document.getElementById('prompt-car-name');

            if (this.playerController.isClimbingTree) {
                if (promptElement) {
                    promptElement.style.display = 'block';
                    if (promptCarName) promptCarName.innerText = 'Густая листва дерева';
                    if (promptActionText) promptActionText.innerText = 'Слезть [E] / Спрыгнуть [Space]';
                }
            } else {
                const nearestTree = this.playerController.findNearestTree(2.8);
                if (nearestTree && (!promptElement || promptElement.style.display === 'none')) {
                    if (promptElement) {
                        promptElement.style.display = 'block';
                        if (promptCarName) promptCarName.innerText = 'Дерево (Укрытие)';
                        if (promptActionText) promptActionText.innerText = 'Залезть и спрятаться в листве [E]';
                    }
                }
            }
        }

        if (this.mobileTouchController) {
            this.mobileTouchController.update(delta);
        }

        // STEP 35: Обновление AI-автомобилей автономного ambient-трафика (маршруты, дистанция, торможение, объезд пешеходов)
        if (this.ambientTrafficManager && !this.isPowerSavingMode) {
            const pedestriansList = (this.pedestrianManager && this.pedestrianManager.pedestrians) ? this.pedestrianManager.pedestrians : [];
            this.ambientTrafficManager.update(delta, focusPos, activeCar, this.dayNightCycle, pedestriansList);
        }

        this.updatePhysics(delta);

        if (this.thirdPersonCamera) {
            const camTargetCar = activeCar || ((this.vehicleManager && this.vehicleManager.transitionCar) ? this.vehicleManager.transitionCar : null);
            this.thirdPersonCamera.update(delta, isDriving ? camTargetCar : null, this.helicopter);
        }

        if (this.pedestrianManager && !this.isPowerSavingMode) {
            this.pedestrianManager.update(delta, focusPos, activeCar, allCars);
        }

        if (this.cloudSystem) this.cloudSystem.update(delta);

        // STEP 24: Обновление динамической погоды (дождь, туман, мокрый зеркальный асфальт)
        if (this.weatherManager) {
            this.weatherManager.update(delta, focusPos);
        }

        // STEP 30: Обновление пространственной сетки чанков и LOD (динамическое управление геометрией и физикой)
        if (this.chunkManager) {
            this.chunkManager.update(focusPos);
        }

        // STEP 34: Обновление покачивания растительности и крон деревьев на ветру (в режиме ЭКО пропускаем для разгрузки GPU/CPU)
        if (!this.isPowerSavingMode && this.vegetationManager) {
            this.vegetationManager.update(delta);
        }

        // STEP 36: Обновление процедурного океана (волны, блики солнца, отражения)
        if (!this.isPowerSavingMode && this.oceanManager) {
            const sunPos = this.dayNightCycle ? this.dayNightCycle.sunPosition : new THREE.Vector3(0, 1, 0);
            const sunCol = (this.dayNightCycle && this.dayNightCycle.sunLight) ? this.dayNightCycle.sunLight.color : new THREE.Color(0xfffaea);
            const fogCol = (this.scene && this.scene.fog) ? this.scene.fog.color : new THREE.Color(0xa6cbe8);
            const nightF = this.dayNightCycle ? this.dayNightCycle.nightFactor : 0.0;
            this.oceanManager.update(delta, sunPos, sunCol, fogCol, nightF);
        }

        // STEP 37: Обновление интерактивных разрушаемых пропсов (в режиме ЭКО проверяем раз в 6 кадров)
        if (this.streetLampManager) {
            if (!this.isPowerSavingMode || (this.frameCount % 6 === 0)) {
                this.streetLampManager.update(delta, focusPos, activeCar, allCars);
            }
        }

        // STEP 38: Обновление триггерных зон районов (GTA-Style Neighborhood HUD Banner)
        if (this.districtManager) {
            this.districtManager.update(delta, focusPos);
        }

        // STEP 26: Обновление интерактивных дверей зданий и жилых домов (в режиме ЭКО раз в 12 кадров)
        const pPos = (this.player && this.player.body) ? this.player.body.position : null;
        if (!this.isPowerSavingMode || (this.frameCount % 12 === 0)) {
            if (this.orgBuildingBuilder) {
                this.orgBuildingBuilder.update(delta, pPos);
            }
            if (this.houseBuilder) {
                this.houseBuilder.update(delta, pPos);
            }
        }

        // STEP 28: Обновление интерактивного лифта небоскреба Maze Bank (10 этажей)
        if (this.elevatorSystem) {
            this.elevatorSystem.update(delta, this.player);
        }

        // STEP 29 & STEP 39: Обновление пространственного звука, дождя, ночных цикад и районного эмбиента
        if (this.soundEngine) {
            this.soundEngine.updateListener(this.camera.position);
            const wType = this.weatherManager ? this.weatherManager.currentWeather : 'CLEAR';
            const nFactor = this.dayNightCycle ? this.dayNightCycle.nightFactor : 0.0;
            const isIndoor = this.playerController ? this.playerController.checkIfIndoor(this.camera.position.x, this.camera.position.y, this.camera.position.z) : false;
            this.soundEngine.updateWeatherAndAmbience(delta, wType, nFactor, isIndoor);

            const curDistId = (this.districtManager && this.districtManager.currentDistrictId) ? this.districtManager.currentDistrictId : 'downtown';
            this.soundEngine.updateDistrictAmbience(delta, curDistId, isIndoor);
        }

        // Синхронизация сетевого мультиплеера (Firebase Realtime Database)
        if (this.multiplayerManager) {
            this.multiplayerManager.update(delta, this.player, this.playerController, this.vehicleManager);
        }

        // Отрисовка круглой миникарты в реальном времени (60 FPS)
        if (this.minimapRenderer) {
            const focusPosMini = isDriving
                ? this.vehicleManager.activeDrivenCar.chassisBody.position
                : (this.player.body ? this.player.body.position : null);
            const cameraYaw = this.thirdPersonCamera ? this.thirdPersonCamera.yaw : 0;
            const npcs = (this.pedestrianManager && !this.isPowerSavingMode) ? this.pedestrianManager.pedestrians : [];
            const carsList = (!this.isPowerSavingMode) ? allCars : (activeCar ? [activeCar] : []);
            const ballsList = (this.pedestrianManager && !this.isPowerSavingMode) ? this.pedestrianManager.soccerBalls : [];
            const remotePlayers = this.multiplayerManager ? this.multiplayerManager.getRemotePlayersArray() : [];

            this.minimapRenderer.render(focusPosMini, cameraYaw, carsList, npcs, ballsList, remotePlayers);
        }

        // Отрисовка интерактивной полноэкранной карты, если она открыта
        if (this.mainMenuManager && this.mainMenuManager.fullMapRenderer && this.mainMenuManager.fullMapRenderer.isOpen) {
            this.mainMenuManager.fullMapRenderer.render();
        }

        this.frameCount++;
        if (elapsedTime - this.lastFpsUpdate >= 0.5) {
            if (this.fpsElement) this.fpsElement.innerText = Math.round(this.frameCount / (elapsedTime - this.lastFpsUpdate));
            this.frameCount = 0;
            this.lastFpsUpdate = elapsedTime;
        }

        // Высокопроизводительный прямой рендеринг с оригинальной контрастностью (60 FPS)
        this.renderer.render(this.scene, this.camera);
    }
}
