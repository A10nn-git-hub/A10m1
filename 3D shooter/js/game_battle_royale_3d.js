/**
 * =========================================================================================
 * 3D SHOOTER ENGINE - THREE.JS WEBGL TACTICAL SHOOTER (STANDOFF 2 / CS:GO STYLE 3D REWORK)
 * =========================================================================================
 * Fully reworked 3D gameplay, 3D characters, physics, ballistics, AI, and Pointer Lock controls
 * Preserves 100% compatibility with Firebase RTDB, economy, inventory, lobbies, and UI.
 */

// Global 3D game state
var br3D = {
    active: false,
    renderer: null,
    scene: null,
    camera: null,
    clock: null,
    canvas: null,
    animFrameId: null,
    
    // Scene objects
    mapGroup: null,
    walls: [],
    wallMeshes: [],
    smokeZones: [],
    smokeMeshes: [],
    playerMeshes: {},
    botMeshes: {},
    bulletMeshes: [],
    particleSystems: [],
    bloodDecals: [],
    floatingTexts: [],
    
    // Base zones & Map config
    mapSize: 350, // 350m in 3D
    mode: 'tdm_5v5',
    baseRects: { ct: null, t: null },
    
    // Local player state
    myP: null,
    selectedTeam: 'Counter-Terrorists',
    keys: {},
    mouse: { x: 0, y: 0, worldX: 0, worldZ: 0, isDown: false, rightDown: false, midDown: false, aimDownSights: false },
    isPointerLocked: false,
    sensitivity: parseFloat(localStorage.getItem('br3d_sens') || '0.0024'),
    touch: {
        joystickActive: false,
        joystickId: null,
        startX: 0, startY: 0,
        curX: 0, curY: 0,
        dx: 0, dy: 0,
        shootActive: false,
        shootId: null,
        camActive: false,
        camId: null,
        camStartX: 0, camStartY: 0,
        camLastX: 0, camLastY: 0,
        pinchDist: 0
    },
    
    // Tactical Over-the-Shoulder Camera
    cameraCtrl: {
        distance: 5.5,
        targetDistance: 5.5,
        minDistance: 2.2,
        maxDistance: 25,
        yaw: 0,                 // Horizontal orbit angle (radians)
        targetYaw: 0,
        pitch: 0.15,            // Vertical elevation angle (radians)
        targetPitch: 0.15,
        minPitch: -0.65,        // Looking high up
        maxPitch: 0.95,         // Looking down
        shoulderOffset: 0.45,   // Over the right shoulder
        heightOffset: 1.45,
        panOffset: { x: 0, z: 0 },
        targetPanOffset: { x: 0, z: 0 },
        mode: 'tactical'        // 'tactical', 'topdown', 'free'
    },
    cameraTarget: null,
    
    // Combat & Weapon
    ammo: 30,
    maxAmmo: 30,
    isReloading: false,
    lastShotTime: 0,
    fireRate: 0.1, // 10 rounds/sec
    damagePerHit: 25,
    damageTaken: 0,
    kills: 0,
    damageDealt: 0,
    isSpectator: false,
    spectatorTargetId: null,
    
    // Match state
    matchActive: false,
    matchGameplayStarted: false,
    teamInitialized: false,
    spawningBotsStarted: false,
    matchStartTime: 0,
    matchDuration: 180, // 3 mins in TDM
    ctScore: 0,
    tScore: 0,
    ctRounds: 0,
    tRounds: 0,
    currentRound: 1,
    roundEnding: false,
    roundWinner: null,
    roundStartCountdownUntil: 0,
    respawnTimerUntil: 0,
    
    // Bots & Multiplayer Networking
    bots: [],
    remotePlayers: {},
    remoteShotSeqs: {},
    damageByPlayer: {},
    syncTimer: null,
    hostBotTimer: null,
    lastSyncX: 0,
    lastSyncZ: 0,
    lastSyncAt: 0,
    
    // Firebase listeners
    teamSelectListener: null,
    matchGameplayStartedListener: null,
    matchActiveListener: null,
    playersListener: null,
    shotsListener: null,
    damageListener: null,
    botsListener: null,
    roundsListener: null,
    
    // Audio Context
    audioCtx: null,
    sounds: {}
};

function brNormalizeTeam(team) {
    if (!team) return 'Counter-Terrorists';
    return (team === 'Counter-Terrorists' || team === 'CT') ? 'Counter-Terrorists' : 'Terrorists';
}
window.brNormalizeTeam = brNormalizeTeam;

function brNormalizeSpeed(val) {
    let s = parseFloat(val);
    if (isNaN(s) || s <= 0) return 12;
    return Math.min(25, Math.max(6, s * 4));
}
window.brNormalizeSpeed = brNormalizeSpeed;

// Aliases for 2D core compatibility
var br = br3D;
var BR_SIZE = 3500;
var BR_DEFAULT_HP = 100;
var isShooting = false;
var brKeys = br3D.keys;

// -----------------------------------------------------------------------------
// AUDIO ENGINE (Synthesized procedural tactical SFX + Voice lines)
// -----------------------------------------------------------------------------
function init3DAudio() {
    if (!br3D.audioCtx) {
        const AudioClass = window.AudioContext || window.webkitAudioContext;
        if (AudioClass) {
            br3D.audioCtx = new AudioClass();
        }
    }
    if (br3D.audioCtx && br3D.audioCtx.state === 'suspended') {
        br3D.audioCtx.resume().catch(() => {});
    }
}

function play3DSound(type, pos) {
    init3DAudio();
    if (!br3D.audioCtx) return;
    const ctx = br3D.audioCtx;
    const now = ctx.currentTime;

    try {
        if (type === 'gunshot') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.exponentialRampToValueAtTime(30, now + 0.08);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(3000, now);
            filter.frequency.exponentialRampToValueAtTime(400, now + 0.09);

            gain.gain.setValueAtTime(0.45, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.12);

            // Noise burst for gunshot punch
            const bufferSize = ctx.sampleRate * 0.06;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.35, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
            noise.connect(noiseGain);
            noiseGain.connect(ctx.destination);
            noise.start(now);

        } else if (type === 'hit') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(260, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);

            gain.gain.setValueAtTime(0.4, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.08);

        } else if (type === 'ricochet') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1600 + Math.random() * 800, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.15);

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.15);

        } else if (type === 'reload') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(450, now);
            osc.frequency.setValueAtTime(650, now + 0.1);

            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.25);

        } else if (type === 'headshot') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1800, now);
            osc.frequency.exponentialRampToValueAtTime(2400, now + 0.12);

            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.15);

        } else if (type === 'switch') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.setValueAtTime(800, now + 0.04);

            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.08);

        } else if (type === 'throw') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(250, now);
            osc.frequency.exponentialRampToValueAtTime(120, now + 0.15);

            gain.gain.setValueAtTime(0.35, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.15);

        } else if (type === 'explosion') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120, now);
            osc.frequency.exponentialRampToValueAtTime(25, now + 0.4);

            gain.gain.setValueAtTime(0.7, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.5);

            // Explosion sub-noise
            const bufferSize = ctx.sampleRate * 0.4;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.6, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            noise.connect(noiseGain);
            noiseGain.connect(ctx.destination);
            noise.start(now);

        } else if (type === 'scope_zoom') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.09);

        } else if (type === 'smoke_hiss') {
            const bufferSize = ctx.sampleRate * 1.5;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1800, now);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            noise.start(now);

        } else if (type === 'step') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(110, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.07);

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.07);

        } else if (type === 'pickup') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(520, now);
            osc.frequency.setValueAtTime(780, now + 0.06);

            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.14);

        } else if (type === 'inspect') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.setValueAtTime(900, now + 0.05);
            osc.frequency.setValueAtTime(1200, now + 0.1);

            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.2);

        } else if (type === 'ping') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.exponentialRampToValueAtTime(440, now + 0.3);

            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.3);
        }
    } catch (e) {}
}

function playTeamWinSound(team) {
    const filename = (team === 'Counter-Terrorists' || team === 'CT') ? 'counter-terrorists-win.mp3' : 'terrorist-wins.mp3';
    try {
        const audio = new Audio(filename);
        audio.volume = 0.85;
        audio.play().catch(() => {});
    } catch (e) {}
}

// -----------------------------------------------------------------------------
// THREE.JS INITIALIZATION & SCENE SETUP (OPTIMIZED FOR 60 FPS WEBGL)
// -----------------------------------------------------------------------------
function init3DEngine() {
    const container = document.getElementById('br-container');
    if (!container) return;

    const isMobileDev = (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) || ('ontouchstart' in window);
    br3D.isMobile = isMobileDev;

    const oldCanvas = document.getElementById('br-canvas-3d');
    if (oldCanvas) oldCanvas.remove();

    const canvas = document.createElement('canvas');
    canvas.id = 'br-canvas-3d';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '1';
    canvas.style.touchAction = 'none';
    container.prepend(canvas);
    br3D.canvas = canvas;

    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: !isMobileDev,
        powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobileDev ? 1.5 : 2.0));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = !isMobileDev;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    br3D.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e1118);
    scene.fog = new THREE.FogExp2(0x0e1118, 0.007);
    br3D.scene = scene;
    br3D.playerMeshes = {};
    br3D.botMeshes = {};
    br3D.bulletMeshes = [];
    br3D.particleSystems = [];
    br3D.bloodDecals = [];
    _muzzleFlashLight = null;

    const aspect = container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 350);
    br3D.camera = camera;
    br3D.clock = new THREE.Clock();

    setup3DLights();

    window.removeEventListener('resize', on3DResize);
    window.addEventListener('resize', on3DResize);
}

function setup3DLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    br3D.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x223344, 0.45);
    br3D.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffaed, 0.95);
    dirLight.position.set(70, 110, 50);
    dirLight.castShadow = !br3D.isMobile;
    if (dirLight.castShadow) {
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        dirLight.shadow.camera.near = 10;
        dirLight.shadow.camera.far = 250;
        const d = 100;
        dirLight.shadow.camera.left = -d;
        dirLight.shadow.camera.right = d;
        dirLight.shadow.camera.top = d;
        dirLight.shadow.camera.bottom = -d;
        dirLight.shadow.bias = -0.0005;
    }
    br3D.scene.add(dirLight);

    const ctBaseLight = new THREE.PointLight(0x32ade6, 1.8, 45);
    ctBaseLight.position.set(-100, 8, 0);
    br3D.scene.add(ctBaseLight);

    const tBaseLight = new THREE.PointLight(0xff9f0a, 1.8, 45);
    tBaseLight.position.set(100, 8, 0);
    br3D.scene.add(tBaseLight);
}

function on3DResize() {
    const container = document.getElementById('br-container');
    if (!container || !br3D.renderer || !br3D.camera) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    br3D.camera.aspect = w / h;
    br3D.camera.updateProjectionMatrix();
    br3D.renderer.setSize(w, h);
}

// -----------------------------------------------------------------------------
// 3D MAP GENERATION (STANDOFF 2 TACTICAL ENVIRONMENT)
// -----------------------------------------------------------------------------
function generate3DMap(mode) {
    if (br3D.mapGroup) {
        br3D.scene.remove(br3D.mapGroup);
    }
    br3D.mapGroup = new THREE.Group();
    br3D.walls = [];
    br3D.wallMeshes = [];
    br3D.smokeZones = [];
    br3D.smokeMeshes = [];
    br3D.bulletMeshes = [];
    br3D.bloodDecals = [];
    br3D.particleSystems = [];

    const mapSize = (mode === 'duel_1v1' || mode === 'duel_2v2') ? 140 : 260;
    br3D.mapSize = mapSize;
    const half = mapSize / 2;

    // 1. Tactical Ground Floor
    const groundGeo = new THREE.PlaneGeometry(mapSize, mapSize, 16, 16);
    const groundMat = new THREE.MeshStandardMaterial({
        color: 0x1a2130,
        roughness: 0.85,
        metalness: 0.15
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    br3D.mapGroup.add(ground);

    // Floor Grid Texture & Tactical Lines
    const gridHelper = new THREE.GridHelper(mapSize, Math.floor(mapSize / 10), 0x334466, 0x223048);
    gridHelper.position.y = 0.02;
    br3D.mapGroup.add(gridHelper);

    // 2. Outer Border Walls
    const wallHeight = 7.0;
    const wallThick = 4.0;
    add3DWallBlock(0, -half - wallThick / 2, mapSize + wallThick * 2, wallThick, wallHeight);
    add3DWallBlock(0, half + wallThick / 2, mapSize + wallThick * 2, wallThick, wallHeight);
    add3DWallBlock(-half - wallThick / 2, 0, wallThick, mapSize, wallHeight);
    add3DWallBlock(half + wallThick / 2, 0, wallThick, mapSize, wallHeight);

    // 3. Bases (CT: Left, T: Right)
    setup3DSpawnBases(mode, mapSize);

    // 4. Tactical Cover, Corridors & Buildings
    if (mode === 'duel_1v1' || mode === 'duel_2v2') {
        add3DWallBlock(0, 0, 8, 28, 4.5);
        add3DWallBlock(-25, -20, 18, 5, 3.8);
        add3DWallBlock(25, 20, 18, 5, 3.8);
        add3DWallBlock(-25, 20, 5, 18, 3.8);
        add3DWallBlock(25, -20, 5, 18, 3.8);
        add3DWallBlock(-40, 0, 4, 16, 3.2);
        add3DWallBlock(40, 0, 4, 16, 3.2);
    } else {
        // TDM 5v5 Standoff Map
        add3DWallBlock(0, 0, 14, 36, 5.5);
        add3DWallBlock(0, -45, 36, 10, 4.8);
        add3DWallBlock(0, 45, 36, 10, 4.8);

        add3DWallBlock(-55, -25, 24, 6, 4.0);
        add3DWallBlock(-55, 25, 24, 6, 4.0);
        add3DWallBlock(-35, -55, 6, 24, 4.0);
        add3DWallBlock(-35, 55, 6, 24, 4.0);

        add3DWallBlock(55, -25, 24, 6, 4.0);
        add3DWallBlock(55, 25, 24, 6, 4.0);
        add3DWallBlock(35, -55, 6, 24, 4.0);
        add3DWallBlock(35, 55, 6, 24, 4.0);

        add3DWallBlock(-80, 0, 8, 35, 3.6);
        add3DWallBlock(80, 0, 8, 35, 3.6);

        // Small Tactical Boxes & Barriers
        const crateCoords = [
            [-20, -15], [-20, 15], [20, -15], [20, 15],
            [-65, -60], [-65, 60], [65, -60], [65, 60],
            [-10, -70], [10, -70], [-10, 70], [10, 70]
        ];
        crateCoords.forEach(([cx, cz]) => {
            add3DWallBlock(cx, cz, 4.5, 4.5, 2.8);
        });
    }

    generate3DSmokeZones(mode);
    br3D.scene.add(br3D.mapGroup);
    buildRadarBackground();
}

let _cachedWallMat = null;
function getSharedWallMaterial() {
    if (!_cachedWallMat) {
        _cachedWallMat = new THREE.MeshStandardMaterial({
            color: 0x3b485d,
            roughness: 0.7,
            metalness: 0.2
        });
    }
    return _cachedWallMat;
}

function add3DWallBlock(x, z, w, d, h) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, getSharedWallMaterial());
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = !br3D.isMobile;
    mesh.receiveShadow = true;

    br3D.mapGroup.add(mesh);
    br3D.wallMeshes.push(mesh);

    br3D.walls.push({
        x: x, z: z, w: w, d: d, h: h,
        minX: x - w / 2, maxX: x + w / 2,
        minZ: z - d / 2, maxZ: z + d / 2
    });
}

function setup3DSpawnBases(mode, mapSize) {
    const baseSpan = (mode === 'duel_1v1' || mode === 'duel_2v2') ? 25 : 35;
    const baseOffset = mapSize / 2 - baseSpan / 2 - 8;

    br3D.baseRects.ct = {
        minX: -baseOffset - baseSpan / 2,
        maxX: -baseOffset + baseSpan / 2,
        minZ: -baseSpan / 2,
        maxZ: baseSpan / 2,
        x: -baseOffset,
        z: 0
    };

    br3D.baseRects.t = {
        minX: baseOffset - baseSpan / 2,
        maxX: baseOffset + baseSpan / 2,
        minZ: -baseSpan / 2,
        maxZ: baseSpan / 2,
        x: baseOffset,
        z: 0
    };

    create3DBasePad(br3D.baseRects.ct.x, 0, baseSpan, 0x32ade6, 'CT BASE');
    create3DBasePad(br3D.baseRects.t.x, 0, baseSpan, 0xff9f0a, 'T BASE');
}

function create3DBasePad(x, z, size, colorHex, label) {
    const padGeo = new THREE.PlaneGeometry(size, size);
    const padMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide
    });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(x, 0.05, z);
    br3D.mapGroup.add(pad);

    const borderGeo = new THREE.RingGeometry(size * 0.45, size * 0.47, 32);
    const borderMat = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(borderGeo, borderMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.06, z);
    br3D.mapGroup.add(ring);
}

function generate3DSmokeZones(mode) {
    const count = (mode === 'duel_1v1' || mode === 'duel_2v2') ? 2 : 4;
    const r = 12;

    for (let i = 0; i < count; i++) {
        const sx = (Math.random() - 0.5) * (br3D.mapSize * 0.5);
        const sz = (Math.random() - 0.5) * (br3D.mapSize * 0.5);

        const smokeGeo = new THREE.SphereGeometry(r, 12, 12);
        const smokeMat = new THREE.MeshBasicMaterial({
            color: 0x8899aa,
            transparent: true,
            opacity: 0.28,
            wireframe: false
        });
        const smoke = new THREE.Mesh(smokeGeo, smokeMat);
        smoke.position.set(sx, r * 0.4, sz);
        br3D.mapGroup.add(smoke);
        br3D.smokeMeshes.push(smoke);
        br3D.smokeZones.push({ x: sx, z: sz, r: r });
    }
}

// -----------------------------------------------------------------------------
// 3D CHARACTER MODELS (TACTICAL SOLDIERS FOR CT & T)
// -----------------------------------------------------------------------------
let _charRes = null;
function getSharedCharResources() {
    if (!_charRes) {
        _charRes = {
            ctBodyMat: new THREE.MeshStandardMaterial({ color: 0x1f3c64, roughness: 0.6 }),
            ctVestMat: new THREE.MeshStandardMaterial({ color: 0x12243d, roughness: 0.8 }),
            ctHelmetMat: new THREE.MeshStandardMaterial({ color: 0x0e1b2f, roughness: 0.5 }),
            ctVisorMat: new THREE.MeshStandardMaterial({ color: 0x32ade6, roughness: 0.2, metalness: 0.8 }),

            tBodyMat: new THREE.MeshStandardMaterial({ color: 0x6e3c16, roughness: 0.7 }),
            tVestMat: new THREE.MeshStandardMaterial({ color: 0x3a2211, roughness: 0.9 }),
            tMaskMat: new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.6 }),
            tGogglesMat: new THREE.MeshStandardMaterial({ color: 0xff9f0a, roughness: 0.2, metalness: 0.8 }),

            skinMat: new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.8 }),
            weaponMat: new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.2 }),
            barrelMat: new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.3 }),

            headGeo: new THREE.SphereGeometry(0.38, 12, 10),
            helmetGeo: new THREE.SphereGeometry(0.42, 12, 10),
            visorGeo: new THREE.BoxGeometry(0.38, 0.12, 0.22),
            torsoGeo: new THREE.BoxGeometry(0.85, 1.15, 0.48),
            vestGeo: new THREE.BoxGeometry(0.92, 0.85, 0.56),
            limbGeo: new THREE.CylinderGeometry(0.14, 0.14, 0.85, 8),
            weaponGeo: new THREE.BoxGeometry(0.16, 0.18, 1.1),
            barrelGeo: new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6),
            magGeo: new THREE.BoxGeometry(0.1, 0.35, 0.2),
            shieldGeo: new THREE.SphereGeometry(1.6, 16, 12),
            ctShieldMat: new THREE.MeshBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.35, wireframe: true }),
            tShieldMat: new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.35, wireframe: true })
        };
    }
    return _charRes;
}

function create3DCharacterModel(team) {
    const isCT = (team === 'Counter-Terrorists' || team === 'CT');
    const res = getSharedCharResources();
    const group = new THREE.Group();

    // 1. Torso & Tactical Vest
    const torso = new THREE.Mesh(res.torsoGeo, isCT ? res.ctBodyMat : res.tBodyMat);
    torso.position.y = 1.25;
    torso.castShadow = !br3D.isMobile;
    group.add(torso);

    const vest = new THREE.Mesh(res.vestGeo, isCT ? res.ctVestMat : res.tVestMat);
    vest.position.y = 1.32;
    vest.castShadow = !br3D.isMobile;
    group.add(vest);

    // 2. Head & Helmet / Balaclava Mask
    const headNode = new THREE.Group();
    headNode.position.y = 2.05;

    const head = new THREE.Mesh(res.headGeo, res.skinMat);
    headNode.add(head);

    if (isCT) {
        const helmet = new THREE.Mesh(res.helmetGeo, res.ctHelmetMat);
        headNode.add(helmet);
        const visor = new THREE.Mesh(res.visorGeo, res.ctVisorMat);
        visor.position.set(0, 0.05, 0.32);
        headNode.add(visor);
    } else {
        const mask = new THREE.Mesh(res.helmetGeo, res.tMaskMat);
        headNode.add(mask);
        const goggles = new THREE.Mesh(res.visorGeo, res.tGogglesMat);
        goggles.position.set(0, 0.05, 0.32);
        headNode.add(goggles);
    }
    group.add(headNode);
    group.headNode = headNode;

    // 3. Legs
    const leftLeg = new THREE.Mesh(res.limbGeo, isCT ? res.ctBodyMat : res.tBodyMat);
    leftLeg.position.set(-0.24, 0.45, 0);
    leftLeg.castShadow = !br3D.isMobile;
    group.add(leftLeg);
    group.leftLegNode = leftLeg;

    const rightLeg = new THREE.Mesh(res.limbGeo, isCT ? res.ctBodyMat : res.tBodyMat);
    rightLeg.position.set(0.24, 0.45, 0);
    rightLeg.castShadow = !br3D.isMobile;
    group.add(rightLeg);
    group.rightLegNode = rightLeg;

    // 4. Arms holding Weapon (AK-47 / M4A1 Tactical Rifle)
    const leftArm = new THREE.Mesh(res.limbGeo, isCT ? res.ctBodyMat : res.tBodyMat);
    leftArm.position.set(-0.52, 1.35, 0.25);
    leftArm.rotation.x = Math.PI / 3;
    leftArm.rotation.z = -Math.PI / 10;
    group.add(leftArm);
    group.leftArmNode = leftArm;

    const rightArm = new THREE.Mesh(res.limbGeo, isCT ? res.ctBodyMat : res.tBodyMat);
    rightArm.position.set(0.52, 1.35, 0.25);
    rightArm.rotation.x = Math.PI / 3;
    rightArm.rotation.z = Math.PI / 10;
    group.add(rightArm);
    group.rightArmNode = rightArm;

    const weaponGroup = create3DWeaponMesh(isCT, res);
    weaponGroup.position.set(0.22, 1.25, 0.65);
    weaponGroup.rotation.y = 0;
    group.add(weaponGroup);
    group.weaponNode = weaponGroup;

    // 5. Shield / Invulnerability Hologram (Tactical Spawn Shield)
    const shield = new THREE.Mesh(res.shieldGeo, isCT ? res.ctShieldMat : res.tShieldMat);
    shield.position.y = 1.2;
    shield.visible = false;
    group.add(shield);
    group.shieldNode = shield;

    return group;
}

function create3DWeaponMesh(isCT, res) {
    const wGroup = new THREE.Group();
    const body = new THREE.Mesh(res.weaponGeo, res.weaponMat);
    wGroup.add(body);

    const barrel = new THREE.Mesh(res.barrelGeo, res.barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.04, 0.7);
    wGroup.add(barrel);

    const mag = new THREE.Mesh(res.magGeo, res.barrelMat);
    mag.position.set(0, -0.22, 0.1);
    mag.rotation.x = 0.2;
    wGroup.add(mag);

    return wGroup;
}

// -----------------------------------------------------------------------------
// POINTER LOCK & SENSITIVITY SYSTEM (FPS/TPS MOUSE CONTROLS)
// -----------------------------------------------------------------------------
function request3DPointerLock() {
    const canvas = br3D.canvas;
    if (!canvas || br3D.isMobile) return;
    try {
        canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock || canvas.webkitRequestPointerLock;
        if (canvas.requestPointerLock) {
            canvas.requestPointerLock();
        }
    } catch (e) {}
}

function exit3DPointerLock() {
    if (document.exitPointerLock) {
        document.exitPointerLock();
    }
}

function showSensitivityToast(sens) {
    const container = document.getElementById('br-container');
    if (!container) return;
    let toast = document.getElementById('br-sens-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'br-sens-toast';
        toast.style.position = 'absolute';
        toast.style.top = '70px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.padding = '8px 18px';
        toast.style.background = 'rgba(0, 0, 0, 0.75)';
        toast.style.border = '1px solid #00ffcc';
        toast.style.borderRadius = '20px';
        toast.style.color = '#00ffcc';
        toast.style.fontSize = '14px';
        toast.style.fontWeight = 'bold';
        toast.style.zIndex = '1010';
        toast.style.pointerEvents = 'none';
        toast.style.transition = 'opacity 0.3s';
        container.appendChild(toast);
    }
    toast.innerText = `Чувствительность мыши: ${(sens * 1000).toFixed(1)}`;
    toast.style.opacity = '1';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.style.opacity = '0';
    }, 1500);
}

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// CONTROLS & CAMERA SYSTEM (PC KEYBOARD/MOUSE + MOBILE TOUCH VIRTUAL JOYSTICK)
// -----------------------------------------------------------------------------
function bind3DControls() {
    if (br3D._controlsBound) return;
    br3D._controlsBound = true;

    window.addEventListener('keydown', e => {
        if (e.code) br3D.keys[e.code] = true;
        if (e.key) br3D.keys[e.key.toLowerCase()] = true;
        if (typeof brKeys !== 'undefined') {
            if (e.code) brKeys[e.code] = true;
            if (e.key) brKeys[e.key.toLowerCase()] = true;
        }

        if (e.code === 'KeyR' || e.key === 'r' || e.key === 'к' || e.key === 'К') reload3DWeapon();
        if (e.code === 'Space') jumpOrDash3D();
        if (e.code === 'KeyC' || e.key === 'c' || e.key === 'с' || e.key === 'С') toggle3DCameraMode();
        if (e.code === 'KeyV' || e.key === 'v' || e.key === 'м' || e.key === 'М') reset3DCameraBehind();

        // Weapon Slots & Grenades
        if (e.code === 'Digit1' || e.code === 'Numpad1') select3DWeapon(1);
        if (e.code === 'Digit2' || e.code === 'Numpad2') select3DWeapon(2);
        if (e.code === 'Digit3' || e.code === 'Numpad3') select3DWeapon(3);
        if (e.code === 'Digit4' || e.code === 'Numpad4') select3DWeapon(4);
        if (e.code === 'KeyG' || e.key === 'g' || e.key === 'п' || e.key === 'П') throw3DGrenade();
        if (e.code === 'KeyX' || e.key === 'x' || e.key === 'ч' || e.key === 'Ч') throw3DSmokeGrenade();
        if (e.code === 'KeyE' || e.key === 'e' || e.key === 'у' || e.key === 'У') tryPickupNearbyWeapon();
        if (e.code === 'KeyF' || e.key === 'f' || e.key === 'а' || e.key === 'А') inspect3DWeapon();

        // Sensitivity Hotkeys [ and ]
        if (e.code === 'BracketLeft') {
            br3D.sensitivity = Math.max(0.0006, (br3D.sensitivity || 0.0024) - 0.0004);
            localStorage.setItem('br3d_sens', br3D.sensitivity.toString());
            showSensitivityToast(br3D.sensitivity);
        } else if (e.code === 'BracketRight') {
            br3D.sensitivity = Math.min(0.008, (br3D.sensitivity || 0.0024) + 0.0004);
            localStorage.setItem('br3d_sens', br3D.sensitivity.toString());
            showSensitivityToast(br3D.sensitivity);
        }
    });

    window.addEventListener('wheel', e => {
        if (!br3D.active || !br3D.myP || !br3D.myP.alive) return;
        if (e.deltaY > 0) {
            let nextSlot = (br3D.currentWeaponSlot || 1) + 1;
            if (nextSlot > 4) nextSlot = 1;
            select3DWeapon(nextSlot);
        } else if (e.deltaY < 0) {
            let prevSlot = (br3D.currentWeaponSlot || 1) - 1;
            if (prevSlot < 1) prevSlot = 4;
            select3DWeapon(prevSlot);
        }
    }, { passive: true });

    window.addEventListener('keyup', e => {
        if (e.code) br3D.keys[e.code] = false;
        if (e.key) br3D.keys[e.key.toLowerCase()] = false;
        if (typeof brKeys !== 'undefined') {
            if (e.code) brKeys[e.code] = false;
            if (e.key) brKeys[e.key.toLowerCase()] = false;
        }
    });

    window.addEventListener('blur', () => {
        br3D.keys = {};
        if (typeof brKeys !== 'undefined') {
            Object.keys(brKeys).forEach(k => delete brKeys[k]);
        }
        br3D.mouse.isDown = false;
        br3D.mouse.rightDown = false;
    });

    const canvas = br3D.canvas;
    if (!canvas) return;

    // Pointer Lock state listeners
    const onPointerLockChange = () => {
        const locked = (document.pointerLockElement === canvas || document.mozPointerLockElement === canvas || document.webkitPointerLockElement === canvas);
        br3D.isPointerLocked = !!locked;
        if (!locked) {
            br3D.mouse.isDown = false;
            br3D.mouse.aimDownSights = false;
            if (br3D.isScoped) toggle3DScope();
            if (br3D.camera) {
                br3D.camera.fov = 55;
                br3D.camera.updateProjectionMatrix();
            }
        }
    };
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('mozpointerlockchange', onPointerLockChange);
    document.addEventListener('webkitpointerlockchange', onPointerLockChange);

    // Mouse Controls
    canvas.addEventListener('mousedown', e => {
        if (!br3D.isPointerLocked && !br3D.isMobile) {
            request3DPointerLock();
        }

        br3D._lastMouseX = e.clientX;
        br3D._lastMouseY = e.clientY;

        if (e.button === 0) {
            br3D.mouse.isDown = true;
            tryFire3DWeapon();
        } else if (e.button === 2) {
            e.preventDefault();
            if (br3D.currentWeaponSlot === 4) {
                toggle3DScope();
            } else {
                br3D.mouse.rightDown = true;
                br3D.mouse.aimDownSights = true;
                br3D.cameraCtrl.targetDistance = 3.2;
                if (br3D.camera) {
                    br3D.camera.fov = 42;
                    br3D.camera.updateProjectionMatrix();
                }
            }
        }
    });

    window.addEventListener('mouseup', e => {
        if (e.button === 0) {
            br3D.mouse.isDown = false;
        } else if (e.button === 2) {
            if (br3D.currentWeaponSlot !== 4) {
                br3D.mouse.rightDown = false;
                br3D.mouse.aimDownSights = false;
                br3D.cameraCtrl.targetDistance = 5.5;
                if (br3D.camera) {
                    br3D.camera.fov = 55;
                    br3D.camera.updateProjectionMatrix();
                }
            }
        }
    });

    // Mouse Move with Pointer Lock or Drag
    window.addEventListener('mousemove', e => {
        let movementX = 0, movementY = 0;
        if (br3D.isPointerLocked) {
            movementX = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
            movementY = e.movementY || e.mozMovementY || e.webkitMovementY || 0;
        } else if (br3D.mouse.isDown || br3D.mouse.rightDown) {
            if (br3D._lastMouseX !== undefined && br3D._lastMouseY !== undefined) {
                movementX = e.clientX - br3D._lastMouseX;
                movementY = e.clientY - br3D._lastMouseY;
            }
            br3D._lastMouseX = e.clientX;
            br3D._lastMouseY = e.clientY;
        } else {
            br3D._lastMouseX = e.clientX;
            br3D._lastMouseY = e.clientY;
            return;
        }

        const baseSens = br3D.sensitivity || 0.0024;
        const adsMultiplier = br3D.mouse.aimDownSights ? 0.6 : 1.0;
        const sens = baseSens * adsMultiplier;

        // Rotate camera horizontally (yaw) and vertically (pitch)
        br3D.cameraCtrl.targetYaw += movementX * sens;
        br3D.cameraCtrl.targetPitch = Math.min(
            0.85,
            Math.max(-0.65, br3D.cameraCtrl.targetPitch - movementY * sens)
        );

        // Orient local player to always aim forward with the mouse
        if (br3D.myP && br3D.myP.alive) {
            br3D.myP.rotY = br3D.cameraCtrl.targetYaw;
        }
    });

    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        zoom3DCamera(e.deltaY * 0.015);
    }, { passive: false });

    canvas.addEventListener('contextmenu', e => e.preventDefault());

    bind3DMobileControls();
}

function bind3DMobileControls() {
    const jBox = document.getElementById('br-joystick');
    const jStick = document.getElementById('br-stick');
    const shootBtn = document.getElementById('br-shoot-btn');
    const canvas = br3D.canvas;
    if (!jBox || !jStick || !canvas) return;

    // Movement Joystick Touch
    jBox.addEventListener('touchstart', e => {
        e.preventDefault();
        const t = e.changedTouches[0];
        br3D.touch.joystickActive = true;
        br3D.touch.joystickId = t.identifier;
        const rect = jBox.getBoundingClientRect();
        br3D.touch.startX = rect.left + rect.width / 2;
        br3D.touch.startY = rect.top + rect.height / 2;
        updateJoystickPos(t.clientX, t.clientY);
    }, { passive: false });

    window.addEventListener('touchmove', e => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (br3D.touch.joystickActive && t.identifier === br3D.touch.joystickId) {
                updateJoystickPos(t.clientX, t.clientY);
            }
            if (br3D.touch.camActive && t.identifier === br3D.touch.camId) {
                const dx = t.clientX - br3D.touch.camLastX;
                const dy = t.clientY - br3D.touch.camLastY;
                br3D.touch.camLastX = t.clientX;
                br3D.touch.camLastY = t.clientY;
                rotate3DCamera(dx * 0.008, -dy * 0.006);
            }
        }
    }, { passive: false });

    window.addEventListener('touchend', e => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (br3D.touch.joystickActive && t.identifier === br3D.touch.joystickId) {
                br3D.touch.joystickActive = false;
                br3D.touch.dx = 0;
                br3D.touch.dy = 0;
                jStick.style.transform = 'translate(0px, 0px)';
            }
            if (br3D.touch.camActive && t.identifier === br3D.touch.camId) {
                br3D.touch.camActive = false;
            }
            if (br3D.touch.shootActive && t.identifier === br3D.touch.shootId) {
                br3D.touch.shootActive = false;
            }
        }
    });

    // Touch Drag Camera (right half of screen)
    canvas.addEventListener('touchstart', e => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (t.clientX > window.innerWidth * 0.35 && !br3D.touch.camActive) {
                br3D.touch.camActive = true;
                br3D.touch.camId = t.identifier;
                br3D.touch.camStartX = t.clientX;
                br3D.touch.camStartY = t.clientY;
                br3D.touch.camLastX = t.clientX;
                br3D.touch.camLastY = t.clientY;
            }
        }
    });

    if (shootBtn) {
        shootBtn.addEventListener('touchstart', e => {
            e.preventDefault();
            const t = e.changedTouches[0];
            br3D.touch.shootActive = true;
            br3D.touch.shootId = t.identifier;
            tryFire3DWeapon();
        }, { passive: false });
    }

    function updateJoystickPos(cx, cy) {
        const maxDist = 45;
        let dx = cx - br3D.touch.startX;
        let dy = cy - br3D.touch.startY;
        const dist = Math.hypot(dx, dy);
        if (dist > maxDist) {
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
        }
        jStick.style.transform = `translate(${dx}px, ${dy}px)`;
        br3D.touch.dx = dx / maxDist;
        br3D.touch.dy = dy / maxDist;
    }
}

function zoom3DCamera(delta) {
    br3D.cameraCtrl.targetDistance = Math.min(
        br3D.cameraCtrl.maxDistance,
        Math.max(br3D.cameraCtrl.minDistance, br3D.cameraCtrl.targetDistance + delta)
    );
}

function rotate3DCamera(yawDelta, pitchDelta) {
    br3D.cameraCtrl.targetYaw += yawDelta;
    br3D.cameraCtrl.targetPitch = Math.min(
        br3D.cameraCtrl.maxPitch,
        Math.max(br3D.cameraCtrl.minPitch, br3D.cameraCtrl.targetPitch + pitchDelta)
    );
    if (br3D.myP && br3D.myP.alive) {
        br3D.myP.rotY = br3D.cameraCtrl.targetYaw;
    }
}

function reset3DCameraBehind() {
    if (br3D.myP) {
        br3D.cameraCtrl.targetYaw = br3D.myP.rotY;
        br3D.cameraCtrl.targetPitch = 0.15;
        br3D.cameraCtrl.targetDistance = 5.5;
        br3D.cameraCtrl.targetPanOffset = { x: 0, z: 0 };
    }
}

function toggle3DCameraMode() {
    if (br3D.cameraCtrl.mode === 'tactical') {
        br3D.cameraCtrl.mode = 'topdown';
        br3D.cameraCtrl.targetPitch = 0.92;
        br3D.cameraCtrl.targetDistance = 18;
    } else if (br3D.cameraCtrl.mode === 'topdown') {
        br3D.cameraCtrl.mode = 'free';
        br3D.cameraCtrl.targetPitch = 0.15;
        br3D.cameraCtrl.targetDistance = 5.5;
    } else {
        br3D.cameraCtrl.mode = 'tactical';
        br3D.cameraCtrl.targetPitch = 0.15;
        br3D.cameraCtrl.targetDistance = 5.5;
    }
    updateCameraModeUI();
}

function updateCameraModeUI() {
    const btn = document.getElementById('br-cam-mode-btn');
    if (btn) {
        const modeLabels = { tactical: '3D ТАКТИК', topdown: '2.5D ВИД', free: 'СВОБОДНАЯ' };
        btn.innerText = modeLabels[br3D.cameraCtrl.mode] || 'КАМЕРА';
    }
}

// -----------------------------------------------------------------------------
// WEAPON ARSENAL, HITMARKERS, KILLFEED & GRENADES SYSTEM
// -----------------------------------------------------------------------------
// WEAPON ARSENAL, HITMARKERS, KILLFEED, AWP SCOPE & GRENADES SYSTEM
// -----------------------------------------------------------------------------
const WEAPONS_CONFIG = {
    1: { id: 'rifle', name: 'AK-47', ctName: 'M4A1', damage: 28, fireRate: 0.11, maxAmmo: 30, speedMult: 1.0, icon: '🔫', reloadTime: 1200 },
    2: { id: 'pistol', name: 'DEAGLE', ctName: 'DEAGLE', damage: 55, fireRate: 0.28, maxAmmo: 7, speedMult: 1.08, icon: '🎯', reloadTime: 1000 },
    3: { id: 'knife', name: 'KNIFE', ctName: 'KNIFE', damage: 65, backstabDamage: 125, fireRate: 0.45, maxAmmo: Infinity, speedMult: 1.25, icon: '🔪', reloadTime: 0 },
    4: { id: 'awp', name: 'AWP', ctName: 'AWP', damage: 115, fireRate: 1.15, maxAmmo: 5, speedMult: 0.88, icon: '🔭', reloadTime: 2200, hasScope: true }
};

br3D.currentWeaponSlot = 1;
br3D.currentWeapon = WEAPONS_CONFIG[1];
br3D.grenades = 1;
br3D.smokeGrenades = 1;
br3D.killstreak = 0;
br3D.lastKillTime = 0;
br3D.grenadesList = [];
br3D.smokeGrenadesList = [];
br3D.smokeClouds = [];
br3D.weaponDrops = [];
br3D.isScoped = false;

function select3DWeapon(slot) {
    if (!WEAPONS_CONFIG[slot]) return;
    if (br3D.currentWeaponSlot === slot) return;
    if (br3D.isScoped && slot !== 4) {
        toggle3DScope();
    }
    br3D.currentWeaponSlot = slot;
    const w = WEAPONS_CONFIG[slot];
    br3D.currentWeapon = w;
    br3D.fireRate = w.fireRate;
    br3D.damagePerHit = w.damage;
    br3D.maxAmmo = w.maxAmmo;
    br3D.ammo = (w.maxAmmo === Infinity) ? Infinity : Math.min(br3D.ammo, w.maxAmmo);
    if (w.maxAmmo !== Infinity && (br3D.ammo === 0 || isNaN(br3D.ammo))) br3D.ammo = w.maxAmmo;
    br3D.isReloading = false;

    play3DSound('switch');

    // Update player movement speed modifier
    if (br3D.myP) {
        br3D.myP.speed = (br3D.myBaseSpeed || 12) * (w.speedMult || 1.0);
    }

    updateWeaponSlotsUI();
    update3DHUD();
}
window.select3DWeapon = select3DWeapon;

function updateWeaponSlotsUI() {
    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById(`wslot-${i}`);
        if (el) el.classList.toggle('active', br3D.currentWeaponSlot === i);
    }
    const gBadge = document.getElementById('wslot-grenades-count');
    if (gBadge) gBadge.innerText = br3D.grenades || 0;
    const sBadge = document.getElementById('wslot-smokes-count');
    if (sBadge) sBadge.innerText = br3D.smokeGrenades || 0;

    const ammoMaxEl = document.getElementById('br-ammo-max');
    if (ammoMaxEl) {
        ammoMaxEl.innerText = (br3D.maxAmmo === Infinity) ? '∞' : `/ ${br3D.maxAmmo}`;
    }
    const slot1Name = document.getElementById('wslot-1-name');
    if (slot1Name && br3D.myP) {
        const isCT = (br3D.myP.team === 'Counter-Terrorists' || br3D.myP.team === 'CT');
        slot1Name.innerText = isCT ? 'M4A1' : 'AK-47';
    }
}

function toggle3DScope() {
    if (!br3D.active || !br3D.myP || !br3D.myP.alive) return;
    if (br3D.currentWeaponSlot !== 4) return;

    br3D.isScoped = !br3D.isScoped;
    const scopeEl = document.getElementById('br-sniper-scope');
    const dot = document.querySelector('.hud-crosshair-dot');

    if (br3D.isScoped) {
        play3DSound('scope_zoom');
        if (scopeEl) scopeEl.classList.remove('hidden');
        if (dot) dot.style.display = 'none';
        if (br3D.camera) {
            br3D.camera.fov = 18;
            br3D.camera.updateProjectionMatrix();
        }
    } else {
        play3DSound('scope_zoom');
        if (scopeEl) scopeEl.classList.add('hidden');
        if (dot) dot.style.display = 'block';
        if (br3D.camera) {
            br3D.camera.fov = 55;
            br3D.camera.updateProjectionMatrix();
        }
    }
}
window.toggle3DScope = toggle3DScope;

function throw3DSmokeGrenade() {
    if (!br3D.active || !br3D.myP || !br3D.myP.alive) return;
    if ((br3D.smokeGrenades || 0) <= 0) return;
    br3D.smokeGrenades--;
    updateWeaponSlotsUI();

    play3DSound('throw');
    const yaw = br3D.cameraCtrl.targetYaw;
    const pitch = br3D.cameraCtrl.targetPitch;
    const dir = new THREE.Vector3(
        Math.sin(yaw) * Math.cos(pitch),
        -Math.sin(pitch) + 0.22,
        Math.cos(yaw) * Math.cos(pitch)
    ).normalize();

    const gGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.3, 8);
    const gMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.4, metalness: 0.6 });
    const gMesh = new THREE.Mesh(gGeo, gMat);
    const fromPos = new THREE.Vector3(br3D.myP.x, 1.4, br3D.myP.z).addScaledVector(dir, 0.8);
    gMesh.position.copy(fromPos);
    br3D.scene.add(gMesh);

    br3D.smokeGrenadesList.push({
        mesh: gMesh,
        pos: fromPos,
        vel: dir.multiplyScalar(22),
        timer: 1.8,
        team: br3D.myP.team
    });
}
window.throw3DSmokeGrenade = throw3DSmokeGrenade;

function update3DSmokeGrenades(dt) {
    for (let i = br3D.smokeGrenadesList.length - 1; i >= 0; i--) {
        const g = br3D.smokeGrenadesList[i];
        g.timer -= dt;
        g.vel.y -= 22 * dt;

        const nextX = g.pos.x + g.vel.x * dt;
        const nextY = g.pos.y + g.vel.y * dt;
        const nextZ = g.pos.z + g.vel.z * dt;

        if (checkBulletWallCollision3D(nextX, g.pos.z)) g.vel.x *= -0.55;
        else g.pos.x = nextX;

        if (checkBulletWallCollision3D(g.pos.x, nextZ)) g.vel.z *= -0.55;
        else g.pos.z = nextZ;

        if (nextY <= 0.15) {
            g.pos.y = 0.15;
            g.vel.y = Math.abs(g.vel.y) * 0.4;
            g.vel.x *= 0.8;
            g.vel.z *= 0.8;
        } else {
            g.pos.y = nextY;
        }

        g.mesh.position.copy(g.pos);

        if (g.timer <= 0) {
            spawn3DSmokeCloud(g.pos);
            br3D.scene.remove(g.mesh);
            br3D.smokeGrenadesList.splice(i, 1);
        }
    }
}

function spawn3DSmokeCloud(pos) {
    play3DSound('smoke_hiss');
    const cloudParticles = [];
    const pGeo = new THREE.DodecahedronGeometry(1.2, 1);
    
    for (let i = 0; i < 28; i++) {
        const pMat = new THREE.MeshLambertMaterial({
            color: 0xcccccc,
            transparent: true,
            opacity: 0.65,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(pGeo, pMat);
        const offset = new THREE.Vector3(
            (Math.random() - 0.5) * 3.5,
            Math.random() * 2.2 + 0.4,
            (Math.random() - 0.5) * 3.5
        );
        mesh.position.copy(pos).add(offset);
        mesh.scale.set(0.4, 0.4, 0.4);
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        br3D.scene.add(mesh);

        cloudParticles.push({
            mesh: mesh,
            targetScale: Math.random() * 2.2 + 2.0,
            basePos: mesh.position.clone()
        });
    }

    br3D.smokeClouds.push({
        pos: pos.clone(),
        particles: cloudParticles,
        life: 14.0,
        maxLife: 14.0
    });
}

function update3DSmokeClouds(dt) {
    for (let i = br3D.smokeClouds.length - 1; i >= 0; i--) {
        const cloud = br3D.smokeClouds[i];
        cloud.life -= dt;
        const progress = 1 - (cloud.life / cloud.maxLife);

        cloud.particles.forEach(p => {
            if (progress < 0.2) {
                const factor = progress / 0.2;
                p.mesh.scale.setScalar(p.targetScale * factor);
            } else if (progress > 0.75) {
                const fadeFactor = (1 - progress) / 0.25;
                p.mesh.material.opacity = 0.65 * Math.max(0, fadeFactor);
            }
            p.mesh.rotation.y += 0.2 * dt;
        });

        if (cloud.life <= 0) {
            cloud.particles.forEach(p => br3D.scene.remove(p.mesh));
            br3D.smokeClouds.splice(i, 1);
        }
    }
}

function spawn3DWeaponDrop(pos, slot, weaponName) {
    const isAwp = (slot === 4);
    const gGeo = isAwp ? new THREE.BoxGeometry(0.18, 0.2, 1.8) : new THREE.BoxGeometry(0.18, 0.25, 1.2);
    const gMat = new THREE.MeshStandardMaterial({
        color: isAwp ? 0x228833 : 0xcc8833,
        roughness: 0.4,
        metalness: 0.8
    });
    const mesh = new THREE.Mesh(gGeo, gMat);
    mesh.position.set(pos.x, 0.4, pos.z);
    br3D.scene.add(mesh);

    const ringGeo = new THREE.RingGeometry(0.5, 0.7, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(pos.x, 0.05, pos.z);
    br3D.scene.add(ringMesh);

    br3D.weaponDrops.push({
        slot: slot,
        name: weaponName,
        mesh: mesh,
        ring: ringMesh,
        pos: pos.clone(),
        time: 0
    });
}

function update3DWeaponPickups(dt) {
    let nearestDrop = null;
    let minDist = 3.0;

    for (let i = br3D.weaponDrops.length - 1; i >= 0; i--) {
        const drop = br3D.weaponDrops[i];
        drop.time += dt;
        drop.mesh.rotation.y += 2.0 * dt;
        drop.mesh.position.y = 0.4 + Math.sin(drop.time * 3) * 0.1;
        drop.ring.rotation.z += 1.5 * dt;

        if (br3D.myP && br3D.myP.alive) {
            const d = Math.hypot(br3D.myP.x - drop.pos.x, br3D.myP.z - drop.pos.z);
            if (d < minDist) {
                minDist = d;
                nearestDrop = drop;
            }
        }
    }

    br3D.nearestWeaponDrop = nearestDrop;
    const prompt = document.getElementById('br-pickup-prompt');
    const promptText = document.getElementById('br-pickup-text');

    if (nearestDrop) {
        if (prompt) prompt.classList.remove('hidden');
        if (promptText) promptText.innerText = `Подобрать ${nearestDrop.name}`;
    } else {
        if (prompt) prompt.classList.add('hidden');
    }
}

function tryPickupNearbyWeapon() {
    if (!br3D.nearestWeaponDrop || !br3D.myP || !br3D.myP.alive) return;
    const drop = br3D.nearestWeaponDrop;
    play3DSound('pickup');

    br3D.scene.remove(drop.mesh);
    br3D.scene.remove(drop.ring);
    br3D.weaponDrops = br3D.weaponDrops.filter(d => d !== drop);
    br3D.nearestWeaponDrop = null;

    const prompt = document.getElementById('br-pickup-prompt');
    if (prompt) prompt.classList.add('hidden');

    select3DWeapon(drop.slot);
    br3D.ammo = br3D.maxAmmo;
    update3DHUD();
}
window.tryPickupNearbyWeapon = tryPickupNearbyWeapon;

let _footstepPhase = 0;
function update3DFootsteps(isMoving, isSilent, dt) {
    if (!isMoving || isSilent) return;
    _footstepPhase += 14 * dt;
    if (_footstepPhase >= Math.PI) {
        _footstepPhase -= Math.PI;
        play3DSound('step');
    }
}

let _inspectTimer = null;
function inspect3DWeapon() {
    if (!br3D.active || !br3D.myP || !br3D.myP.alive) return;
    play3DSound('inspect');
    const mesh = br3D.localPlayerMesh;
    if (mesh && mesh.rightArmNode) {
        mesh.rightArmNode.rotation.z += 0.6;
        mesh.rightArmNode.rotation.y -= 0.4;
        if (_inspectTimer) clearTimeout(_inspectTimer);
        _inspectTimer = setTimeout(() => {
            if (mesh && mesh.rightArmNode) {
                mesh.rightArmNode.rotation.z = 0;
                mesh.rightArmNode.rotation.y = 0;
            }
        }, 1100);
    }
}
window.inspect3DWeapon = inspect3DWeapon;

let _hitmarkerTimer = null;
function trigger3DHitmarker(isHeadshot = false) {
    const hm = document.getElementById('hud-hitmarker');
    if (!hm) return;
    hm.className = 'hud-hitmarker active' + (isHeadshot ? ' headshot' : '');
    play3DSound(isHeadshot ? 'headshot' : 'hit');
    if (_hitmarkerTimer) clearTimeout(_hitmarkerTimer);
    _hitmarkerTimer = setTimeout(() => {
        if (hm) hm.className = 'hud-hitmarker';
    }, 160);
}

function add3DKillFeed(killerName, victimName, killerTeam, victimTeam, weaponName = 'AK-47', isHeadshot = false) {
    const feed = document.getElementById('br-killfeed');
    if (!feed) return;

    const item = document.createElement('div');
    item.className = 'killfeed-item';
    const kClass = (killerTeam === 'Counter-Terrorists' || killerTeam === 'CT') ? 'ct' : 't';
    const vClass = (victimTeam === 'Counter-Terrorists' || victimTeam === 'CT') ? 'ct' : 't';
    const hsIcon = isHeadshot ? '<span class="killfeed-headshot">🎯</span>' : '';

    item.innerHTML = `
        <span class="killfeed-killer ${kClass}">${killerName || 'Игрок'}</span>
        <span class="killfeed-weapon">[${weaponName}]</span>
        ${hsIcon}
        <span class="killfeed-victim ${vClass}">${victimName || 'Бот'}</span>
    `;

    feed.prepend(item);
    if (feed.children.length > 5) {
        feed.lastElementChild.remove();
    }
    setTimeout(() => {
        if (item.parentNode) item.remove();
    }, 4500);
}

let _streakBannerTimer = null;
function record3DKill(victimName, isHeadshot = false) {
    const now = Date.now();
    if (now - (br3D.lastKillTime || 0) < 6500) {
        br3D.killstreak = (br3D.killstreak || 0) + 1;
    } else {
        br3D.killstreak = 1;
    }
    br3D.lastKillTime = now;

    const streak = br3D.killstreak;
    let bannerText = '';
    let bonus = 0;

    if (streak === 2) { bannerText = '🔥 DOUBLE KILL! +50 🪙'; bonus = 50; }
    else if (streak === 3) { bannerText = '⚡ TRIPLE KILL! +100 🪙'; bonus = 100; }
    else if (streak === 4) { bannerText = '💀 ULTRA KILL! +150 🪙'; bonus = 150; }
    else if (streak >= 5) { bannerText = '👑 RAMPAGE! +200 🪙'; bonus = 200; }
    else if (isHeadshot) { bannerText = '🎯 HEADSHOT! +25 🪙'; bonus = 25; }

    if (bonus > 0 && typeof addCoins === 'function') {
        addCoins(bonus);
    }

    if (bannerText) {
        const banner = document.getElementById('br-killstreak-banner');
        if (banner) {
            banner.innerText = bannerText;
            banner.classList.remove('hidden');
            if (_streakBannerTimer) clearTimeout(_streakBannerTimer);
            _streakBannerTimer = setTimeout(() => {
                if (banner) banner.classList.add('hidden');
            }, 2400);
        }
    }
}

function throw3DGrenade() {
    if (!br3D.active || !br3D.myP || !br3D.myP.alive) return;
    if ((br3D.grenades || 0) <= 0) return;
    br3D.grenades--;
    updateWeaponSlotsUI();

    play3DSound('throw');
    const yaw = br3D.cameraCtrl.targetYaw;
    const pitch = br3D.cameraCtrl.targetPitch;
    const dir = new THREE.Vector3(
        Math.sin(yaw) * Math.cos(pitch),
        -Math.sin(pitch) + 0.22,
        Math.cos(yaw) * Math.cos(pitch)
    ).normalize();

    const gGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const gMat = new THREE.MeshStandardMaterial({ color: 0x334422, roughness: 0.5, metalness: 0.8 });
    const gMesh = new THREE.Mesh(gGeo, gMat);
    const fromPos = new THREE.Vector3(br3D.myP.x, 1.4, br3D.myP.z).addScaledVector(dir, 0.8);
    gMesh.position.copy(fromPos);
    br3D.scene.add(gMesh);

    br3D.grenadesList.push({
        mesh: gMesh,
        pos: fromPos,
        vel: dir.multiplyScalar(24),
        timer: 2.0,
        shooterId: myId,
        team: br3D.myP.team
    });
}
window.throw3DGrenade = throw3DGrenade;

function update3DGrenades(dt) {
    for (let i = br3D.grenadesList.length - 1; i >= 0; i--) {
        const g = br3D.grenadesList[i];
        g.timer -= dt;
        g.vel.y -= 22 * dt;

        const nextX = g.pos.x + g.vel.x * dt;
        const nextY = g.pos.y + g.vel.y * dt;
        const nextZ = g.pos.z + g.vel.z * dt;

        if (checkBulletWallCollision3D(nextX, g.pos.z)) {
            g.vel.x *= -0.55;
        } else {
            g.pos.x = nextX;
        }
        if (checkBulletWallCollision3D(g.pos.x, nextZ)) {
            g.vel.z *= -0.55;
        } else {
            g.pos.z = nextZ;
        }

        if (nextY <= 0.18) {
            g.pos.y = 0.18;
            g.vel.y = Math.abs(g.vel.y) * 0.45;
            g.vel.x *= 0.85;
            g.vel.z *= 0.85;
        } else {
            g.pos.y = nextY;
        }

        g.mesh.position.copy(g.pos);

        if (g.timer <= 0) {
            explode3DGrenade(g.pos, g.shooterId, g.team);
            br3D.scene.remove(g.mesh);
            br3D.grenadesList.splice(i, 1);
        }
    }
}

function explode3DGrenade(pos, shooterId, team) {
    play3DSound('explosion');
    create3DMuzzleFlash(pos);

    for (let i = 0; i < 20; i++) {
        const pGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
        const pMat = new THREE.MeshBasicMaterial({ color: (i % 2 === 0) ? 0xff5500 : 0xffcc00 });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        pMesh.position.copy(pos);
        const vel = new THREE.Vector3(
            (Math.random() - 0.5) * 16,
            Math.random() * 12 + 2,
            (Math.random() - 0.5) * 16
        );
        br3D.scene.add(pMesh);
        br3D.particleSystems.push({ mesh: pMesh, vel: vel, life: 0.65 });
    }

    const damageRadius = 10;
    if (br3D.myP && br3D.myP.alive) {
        const d = Math.hypot(br3D.myP.x - pos.x, br3D.myP.z - pos.z);
        if (d < damageRadius) {
            const dmg = Math.round((1 - d / damageRadius) * 105);
            damage3DPlayer(br3D.myP, dmg, shooterId);
        }
    }
    br3D.bots.forEach(bot => {
        if (bot.alive && bot.team !== team) {
            const d = Math.hypot(bot.x - pos.x, bot.z - pos.z);
            if (d < damageRadius) {
                const dmg = Math.round((1 - d / damageRadius) * 105);
                damage3DBot(bot, dmg, shooterId);
                if (shooterId === myId) trigger3DHitmarker(false);
            }
        }
    });
}

function reload3DWeapon() {
    if (br3D.isReloading || br3D.ammo >= br3D.maxAmmo || br3D.maxAmmo === Infinity) return;
    br3D.isReloading = true;
    play3DSound('reload');
    update3DHUD();
    const reloadTime = (br3D.currentWeapon && br3D.currentWeapon.reloadTime) || 1200;
    setTimeout(() => {
        br3D.ammo = br3D.maxAmmo;
        br3D.isReloading = false;
        update3DHUD();
    }, reloadTime);
}

function jumpOrDash3D() {
    if (br3D.myP && br3D.myP.alive && (br3D.myP.y || 0) <= 0.05) {
        br3D.myP.vy = 6;
    }
}

// -----------------------------------------------------------------------------
// 3D BALLISTICS, TRACERS & PARTICLE EFFECTS (POOLED WEBGL RESOURCES)
// -----------------------------------------------------------------------------
let _sharedTracerGeo = null;
let _sharedTracerMatCT = null;
let _sharedTracerMatT = null;
let _sharedSparkGeo = null;
let _sharedSparkBloodMat = null;
let _sharedSparkRicochetMat = null;
let _sharedBloodDecalGeo = null;
let _sharedBloodDecalMat = null;
let _muzzleFlashLight = null;
let _muzzleFlashTimer = null;

function getSharedVfxResources() {
    if (!_sharedTracerGeo) {
        _sharedTracerGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.0, 6);
        _sharedTracerMatCT = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
        _sharedTracerMatT = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        _sharedSparkGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
        _sharedSparkBloodMat = new THREE.MeshBasicMaterial({ color: 0xcc1111 });
        _sharedSparkRicochetMat = new THREE.MeshBasicMaterial({ color: 0xffcc33 });
        _sharedBloodDecalGeo = new THREE.CircleGeometry(0.8, 12);
        _sharedBloodDecalMat = new THREE.MeshBasicMaterial({
            color: 0x660000,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
    }
}

function fire3DBullet(fromPos, dir, shooterId, team) {
    play3DSound('gunshot');
    getSharedVfxResources();

    const isCT = (team === 'Counter-Terrorists' || team === 'CT');
    const tracer = new THREE.Mesh(_sharedTracerGeo, isCT ? _sharedTracerMatCT : _sharedTracerMatT);
    tracer.position.copy(fromPos);
    tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

    br3D.scene.add(tracer);
    br3D.bulletMeshes.push({
        mesh: tracer,
        pos: fromPos.clone(),
        dir: dir.clone(),
        speed: 120, // 120 m/s
        shooterId: shooterId,
        team: team,
        life: 0.8
    });

    create3DMuzzleFlash(fromPos);
}

function create3DMuzzleFlash(pos) {
    if (!br3D.scene) return;
    if (!_muzzleFlashLight) {
        _muzzleFlashLight = new THREE.PointLight(0xffaa22, 0, 12);
        br3D.scene.add(_muzzleFlashLight);
    }
    _muzzleFlashLight.position.copy(pos);
    _muzzleFlashLight.intensity = 3.0;
    if (_muzzleFlashTimer) clearTimeout(_muzzleFlashTimer);
    _muzzleFlashTimer = setTimeout(() => {
        if (_muzzleFlashLight) _muzzleFlashLight.intensity = 0;
    }, 45);
}

function create3DHitSparks(pos, isBlood) {
    play3DSound(isBlood ? 'hit' : 'ricochet');
    getSharedVfxResources();
    const count = isBlood ? 6 : 4;
    const mat = isBlood ? _sharedSparkBloodMat : _sharedSparkRicochetMat;

    for (let i = 0; i < count; i++) {
        const pMesh = new THREE.Mesh(_sharedSparkGeo, mat);
        pMesh.position.copy(pos);

        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 7,
            Math.random() * 5 + 1,
            (Math.random() - 0.5) * 7
        );
        br3D.scene.add(pMesh);
        br3D.particleSystems.push({
            mesh: pMesh,
            vel: velocity,
            life: 0.35
        });
    }

    if (isBlood) {
        add3DBloodDecal(pos.x, pos.z);
    }
}

function add3DBloodDecal(x, z) {
    getSharedVfxResources();
    const decal = new THREE.Mesh(_sharedBloodDecalGeo, _sharedBloodDecalMat);
    decal.rotation.x = -Math.PI / 2;
    const scale = 0.7 + Math.random() * 0.5;
    decal.scale.set(scale, scale, 1);
    decal.position.set(x, 0.02, z);
    br3D.scene.add(decal);
    br3D.bloodDecals.push(decal);

    if (br3D.bloodDecals.length > 25) {
        const old = br3D.bloodDecals.shift();
        if (old && br3D.scene) br3D.scene.remove(old);
    }
}

function spawn3DFloatingDamage(pos, damage, isCrit = false) {
    if (!br3D.camera) return;
    const screenPos = pos.clone().project(br3D.camera);
    // Don't render damage indicators if behind camera
    if (screenPos.z > 1) return;

    const container = document.getElementById('br-container');
    if (!container) return;

    if (br3D.floatingTexts.length > 12) {
        const oldest = br3D.floatingTexts.shift();
        if (oldest) oldest.remove();
    }

    const x = (screenPos.x * 0.5 + 0.5) * container.clientWidth;
    const y = (-(screenPos.y * 0.5) + 0.5) * container.clientHeight;

    const dEl = document.createElement('div');
    dEl.className = 'damage-floating-text';
    dEl.innerText = `-${damage}`;
    dEl.style.position = 'absolute';
    dEl.style.left = `${x}px`;
    dEl.style.top = `${y}px`;
    dEl.style.color = isCrit ? '#ff3b30' : '#ffd60a';
    dEl.style.fontWeight = 'bold';
    dEl.style.fontSize = isCrit ? '24px' : '18px';
    dEl.style.pointerEvents = 'none';
    dEl.style.zIndex = '1005';
    dEl.style.transition = 'all 0.5s ease-out';
    dEl.style.textShadow = '0 2px 8px rgba(0,0,0,0.8)';
    container.appendChild(dEl);
    br3D.floatingTexts.push(dEl);

    requestAnimationFrame(() => {
        dEl.style.top = `${y - 35}px`;
        dEl.style.opacity = '0';
    });

    setTimeout(() => {
        dEl.remove();
        const idx = br3D.floatingTexts.indexOf(dEl);
        if (idx !== -1) br3D.floatingTexts.splice(idx, 1);
    }, 500);
}

// -----------------------------------------------------------------------------
// 3D COLLISION DETECTION & FAST RAYCASTING
// -----------------------------------------------------------------------------
function checkPlayerWallCollision3D(px, pz, radius = 0.8) {
    const walls = br3D.walls;
    const len = walls.length;
    const rSq = radius * radius;
    for (let i = 0; i < len; i++) {
        const wall = walls[i];
        if (px + radius < wall.minX || px - radius > wall.maxX || pz + radius < wall.minZ || pz - radius > wall.maxZ) {
            continue;
        }
        const nearestX = Math.max(wall.minX, Math.min(px, wall.maxX));
        const nearestZ = Math.max(wall.minZ, Math.min(pz, wall.maxZ));
        const dx = px - nearestX;
        const dz = pz - nearestZ;
        if (dx * dx + dz * dz < rSq) return true;
    }
    return false;
}

function checkBulletWallCollision3D(bx, bz) {
    const walls = br3D.walls;
    const len = walls.length;
    for (let i = 0; i < len; i++) {
        const wall = walls[i];
        if (bx >= wall.minX && bx <= wall.maxX && bz >= wall.minZ && bz <= wall.maxZ) {
            return true;
        }
    }
    return false;
}

function checkLineOfSight3D(x1, z1, x2, z2) {
    const steps = 10;
    const dx = (x2 - x1) / steps;
    const dz = (z2 - z1) / steps;
    for (let i = 1; i < steps; i++) {
        const cx = x1 + dx * i;
        const cz = z1 + dz * i;
        if (checkBulletWallCollision3D(cx, cz)) return false;
    }
    return true;
}

// -----------------------------------------------------------------------------
// BOTS AI & SIMULATION (TACTICAL 5v5 CS:GO BEHAVIOR)
// -----------------------------------------------------------------------------
function init3DBots(mode) {
    br3D.bots = [];
    let maxTeamSize = 5;
    if (mode === 'duel_1v1') maxTeamSize = 1;
    else if (mode === 'duel_2v2') maxTeamSize = 2;

    const myTeam = br3D.myP ? br3D.myP.team : br3D.selectedTeam;

    let ctRealCount = (myTeam === 'Counter-Terrorists') ? 1 : 0;
    let tRealCount = (myTeam === 'Terrorists') ? 1 : 0;

    if (lobbyId && typeof lobbyPlayers !== 'undefined' && Array.isArray(lobbyPlayers)) {
        Object.values(br3D.remotePlayers).forEach(p => {
            if (p.id === myId) return;
            const t = brNormalizeTeam(p.team);
            if (t === 'Counter-Terrorists') ctRealCount++;
            else if (t === 'Terrorists') tRealCount++;
        });
    }

    const ctBotCount = Math.max(0, maxTeamSize - ctRealCount);
    const tBotCount = Math.max(0, maxTeamSize - tRealCount);

    for (let i = 0; i < ctBotCount; i++) {
        const sp = get3DSpawnPos('Counter-Terrorists', mode);
        br3D.bots.push(create3DBotObj('bot_ct_' + (i + 1), 'Бот CT-' + (i + 1), 'Counter-Terrorists', sp.x, sp.z));
    }
    for (let i = 0; i < tBotCount; i++) {
        const sp = get3DSpawnPos('Terrorists', mode);
        br3D.bots.push(create3DBotObj('bot_t_' + (i + 1), 'Бот T-' + (i + 1), 'Terrorists', sp.x, sp.z));
    }
}

function create3DBotObj(id, label, team, x, z) {
    return {
        id: id,
        label: label,
        team: team,
        x: x,
        y: 0,
        z: z,
        vx: 0,
        vz: 0,
        rotY: (team === 'Counter-Terrorists') ? Math.PI / 2 : -Math.PI / 2,
        targetRotY: 0,
        hp: 100,
        maxHp: 100,
        speed: 7.5 + Math.random() * 2.0,
        alive: true,
        invulnUntil: Date.now() + 3000,
        targetX: 0,
        targetZ: 0,
        nextThink: 0,
        nextShot: 0,
        kills: 0,
        respawnTime: 0
    };
}

function update3DBots(dt) {
    if (!br3D.matchActive) return;
    const now = Date.now();

    br3D.bots.forEach(bot => {
        // Handle TDM Respawn
        if (!bot.alive) {
            if (br3D.mode === 'tdm_5v5' && bot.respawnTime && now >= bot.respawnTime) {
                const sp = get3DSpawnPos(bot.team, br3D.mode);
                bot.x = sp.x;
                bot.z = sp.z;
                bot.hp = bot.maxHp;
                bot.alive = true;
                bot.invulnUntil = now + 3000;
                bot.respawnTime = 0;
            }
            return;
        }

        // Host AI Decisions
        if (now >= bot.nextThink) {
            bot.nextThink = now + 400 + Math.random() * 300;

            // Target Acquisition: Local Player, Remote Players or Enemy Bots
            let bestTarget = null;
            let bestDist = 120;

            if (br3D.myP && br3D.myP.alive && br3D.myP.team !== bot.team && now >= br3D.myP.invulnUntil) {
                const dist = Math.hypot(br3D.myP.x - bot.x, br3D.myP.z - bot.z);
                if (dist < bestDist && checkLineOfSight3D(bot.x, bot.z, br3D.myP.x, br3D.myP.z)) {
                    bestDist = dist;
                    bestTarget = { x: br3D.myP.x, z: br3D.myP.z, id: myId };
                }
            }

            Object.keys(br3D.remotePlayers).forEach(rpId => {
                if (rpId === myId) return;
                const rp = br3D.remotePlayers[rpId];
                if (rp && rp.alive && rp.team !== bot.team && now >= (rp.invulnUntil || 0)) {
                    const dist = Math.hypot(rp.x - bot.x, rp.z - bot.z);
                    if (dist < bestDist && checkLineOfSight3D(bot.x, bot.z, rp.x, rp.z)) {
                        bestDist = dist;
                        bestTarget = { x: rp.x, z: rp.z, id: rpId };
                    }
                }
            });

            br3D.bots.forEach(otherBot => {
                if (otherBot.id !== bot.id && otherBot.alive && otherBot.team !== bot.team && now >= otherBot.invulnUntil) {
                    const dist = Math.hypot(otherBot.x - bot.x, otherBot.z - bot.z);
                    if (dist < bestDist && checkLineOfSight3D(bot.x, bot.z, otherBot.x, otherBot.z)) {
                        bestDist = dist;
                        bestTarget = { x: otherBot.x, z: otherBot.z, id: otherBot.id };
                    }
                }
            });

            if (bestTarget) {
                bot.targetX = bestTarget.x;
                bot.targetZ = bestTarget.z;
                bot.hasEnemy = true;

                // Fire Weapon
                if (now >= bot.nextShot && bestDist < 70) {
                    bot.nextShot = now + 450 + Math.random() * 350;
                    const aimAngle = Math.atan2(bestTarget.x - bot.x, bestTarget.z - bot.z);
                    const spread = (Math.random() - 0.5) * 0.12;
                    const finalAngle = aimAngle + spread;
                    const dir = new THREE.Vector3(Math.sin(finalAngle), 0, Math.cos(finalAngle)).normalize();
                    const fromPos = new THREE.Vector3(bot.x, 1.25, bot.z).addScaledVector(dir, 0.8);
                    fire3DBullet(fromPos, dir, bot.id, bot.team);
                }
            } else {
                bot.hasEnemy = false;
                // Patrol / Advance towards enemy half of the map
                if (Math.hypot(bot.targetX - bot.x, bot.targetZ - bot.z) < 5 || Math.random() < 0.2) {
                    const enemySpawn = (bot.team === 'Counter-Terrorists') ? br3D.baseRects.t : br3D.baseRects.ct;
                    const targetX = enemySpawn ? enemySpawn.x * 0.6 + (Math.random() - 0.5) * 40 : 0;
                    const targetZ = (Math.random() - 0.5) * (br3D.mapSize * 0.6);
                    bot.targetX = targetX;
                    bot.targetZ = targetZ;
                }
            }
        }

        // Movement towards target
        const dx = bot.targetX - bot.x;
        const dz = bot.targetZ - bot.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 1.5) {
            const moveAngle = Math.atan2(dx, dz);
            bot.rotY = moveAngle;
            const moveDist = bot.speed * dt;
            const nextX = bot.x + Math.sin(moveAngle) * moveDist;
            const nextZ = bot.z + Math.cos(moveAngle) * moveDist;

            bot.vx = (nextX - bot.x) / dt;
            bot.vz = (nextZ - bot.z) / dt;

            if (!checkPlayerWallCollision3D(nextX, nextZ, 0.8)) {
                bot.x = nextX;
                bot.z = nextZ;
            } else {
                if (!checkPlayerWallCollision3D(nextX, bot.z, 0.8)) bot.x = nextX;
                else if (!checkPlayerWallCollision3D(bot.x, nextZ, 0.8)) bot.z = nextZ;
                bot.nextThink = now;
            }
        } else {
            bot.vx = 0;
            bot.vz = 0;
        }
    });
}

function get3DSpawnPos(team, mode) {
    const isCT = (team === 'Counter-Terrorists' || team === 'CT');
    const base = isCT ? br3D.baseRects.ct : br3D.baseRects.t;
    const spread = (mode === 'duel_1v1' || mode === 'duel_2v2') ? 12 : 22;

    if (base) {
        return {
            x: base.x + (Math.random() - 0.5) * spread,
            z: base.z + (Math.random() - 0.5) * spread
        };
    }
    return {
        x: isCT ? -80 : 80,
        z: (Math.random() - 0.5) * 30
    };
}

// -----------------------------------------------------------------------------
// LOCAL PLAYER SIMULATION & WEAPON FIRING
// -----------------------------------------------------------------------------
function tryFire3DWeapon() {
    if (!br3D.active || !br3D.myP || !br3D.myP.alive || br3D.isReloading) return;
    const now = Date.now();
    const fireInterval = (br3D.currentWeapon ? br3D.currentWeapon.fireRate : (br3D.fireRate || 0.12)) * 1000;
    if (now - br3D.lastShotTime < fireInterval) return;

    // Knife Melee Attack
    if (br3D.currentWeaponSlot === 3) {
        br3D.lastShotTime = now;
        play3DSound('switch');

        const yaw = br3D.cameraCtrl.targetYaw;
        const forwardX = Math.sin(yaw);
        const forwardZ = Math.cos(yaw);
        const knifeRange = 2.8;

        let hitAny = false;
        // Check bots
        for (let bot of br3D.bots) {
            if (bot.alive && bot.team !== br3D.myP.team) {
                const dx = bot.x - br3D.myP.x;
                const dz = bot.z - br3D.myP.z;
                const dist = Math.hypot(dx, dz);
                if (dist < knifeRange) {
                    const dot = (dx * forwardX + dz * forwardZ) / dist;
                    if (dot > 0.5) {
                        const angleDiff = Math.abs((bot.rotY - yaw + Math.PI * 3) % (Math.PI * 2) - Math.PI);
                        const isBackstab = angleDiff < 1.0;
                        const dmg = isBackstab ? 125 : 65;
                        damage3DBot(bot, dmg, myId, isBackstab);
                        trigger3DHitmarker(isBackstab);
                        create3DHitSparks(new THREE.Vector3(bot.x, 1.4, bot.z), true);
                        hitAny = true;
                        break;
                    }
                }
            }
        }
        // Check remote players
        if (!hitAny) {
            for (let rpId of Object.keys(br3D.remotePlayers)) {
                if (rpId === myId) continue;
                const rp = br3D.remotePlayers[rpId];
                if (rp && rp.alive && rp.team !== br3D.myP.team) {
                    const dx = rp.x - br3D.myP.x;
                    const dz = rp.z - br3D.myP.z;
                    const dist = Math.hypot(dx, dz);
                    if (dist < knifeRange) {
                        const dot = (dx * forwardX + dz * forwardZ) / dist;
                        if (dot > 0.5) {
                            const isBackstab = Math.abs(((rp.rotY || rp.a || 0) - yaw + Math.PI * 3) % (Math.PI * 2) - Math.PI) < 1.0;
                            const dmg = isBackstab ? 125 : 65;
                            trigger3DHitmarker(isBackstab);
                            create3DHitSparks(new THREE.Vector3(rp.x, 1.4, rp.z), true);
                            spawn3DFloatingDamage(new THREE.Vector3(rp.x, 1.8, rp.z), dmg, isBackstab);
                            if (lobbyId) {
                                db.ref(`lobbies/${lobbyId}/br/damage/${rpId}`).transaction(v => (parseInt(v) || 0) + dmg).catch(() => {});
                            }
                            break;
                        }
                    }
                }
            }
        }
        return;
    }

    // Guns (Rifle & Pistol)
    if (br3D.ammo <= 0) {
        reload3DWeapon();
        return;
    }

    br3D.ammo--;
    br3D.lastShotTime = now;
    br3D.myP.shotSeq = (br3D.myP.shotSeq || 0) + 1;

    // Bullet direction towards crosshair center in 3D
    const yaw = br3D.cameraCtrl.targetYaw;
    const pitch = br3D.cameraCtrl.targetPitch;
    const dir = new THREE.Vector3(
        Math.sin(yaw) * Math.cos(pitch),
        -Math.sin(pitch),
        Math.cos(yaw) * Math.cos(pitch)
    ).normalize();

    const fromPos = new THREE.Vector3(br3D.myP.x, 1.35, br3D.myP.z).addScaledVector(dir, 0.8);

    fire3DBullet(fromPos, dir, myId, br3D.myP.team);
    update3DHUD();

    if (lobbyId) {
        syncBrPlayerState(true);
    }
}

function is3DKeyPressed(codes, keys) {
    const k = br3D.keys;
    if (!k) return false;
    for (let i = 0; i < codes.length; i++) {
        if (k[codes[i]]) return true;
    }
    for (let j = 0; j < keys.length; j++) {
        if (k[keys[j]]) return true;
    }
    return false;
}

function update3DLocalPlayer(dt) {
    if (!br3D.myP || !br3D.myP.alive) return;
    const p = br3D.myP;

    // 1. Keyboard / Joystick Input
    let moveForward = 0, moveRight = 0;
    // W / Up / Ц
    if (is3DKeyPressed(['KeyW', 'ArrowUp', 'KeyЦ', 'Keyw'], ['w', 'W', 'ц', 'Ц'])) moveForward += 1;
    // S / Down / Ы
    if (is3DKeyPressed(['KeyS', 'ArrowDown', 'KeyЫ', 'Keys'], ['s', 'S', 'ы', 'Ы'])) moveForward -= 1;
    // A / Left / Ф (Strafe Left)
    if (is3DKeyPressed(['KeyA', 'ArrowLeft', 'KeyФ', 'Keya'], ['a', 'A', 'ф', 'Ф'])) moveRight -= 1;
    // D / Right / В (Strafe Right)
    if (is3DKeyPressed(['KeyD', 'ArrowRight', 'KeyВ', 'Keyd'], ['d', 'D', 'в', 'В'])) moveRight += 1;

    if (br3D.touch.joystickActive) {
        moveRight += br3D.touch.dx;
        moveForward -= br3D.touch.dy;
    }

    const inputLen = Math.hypot(moveForward, moveRight);
    const isShift = is3DKeyPressed(['ShiftLeft', 'ShiftRight'], ['shift']);
    const isMoving = inputLen > 0.05;

    if (isMoving) {
        const normFwd = moveForward / inputLen;
        const normRt = moveRight / inputLen;

        // Align movement relative to camera orientation with zero lag
        const camYaw = br3D.cameraCtrl.targetYaw;
        const worldMoveX = normFwd * Math.sin(camYaw) + normRt * Math.cos(camYaw);
        const worldMoveZ = normFwd * Math.cos(camYaw) - normRt * Math.sin(camYaw);

        const currentSpeed = (p.speed || 12) * (isShift ? 0.55 : 1.0);
        const moveDist = currentSpeed * dt;
        const nextX = p.x + worldMoveX * moveDist;
        const nextZ = p.z + worldMoveZ * moveDist;

        p.vx = worldMoveX * currentSpeed;
        p.vz = worldMoveZ * currentSpeed;

        if (!checkPlayerWallCollision3D(nextX, nextZ, 0.8)) {
            p.x = nextX;
            p.z = nextZ;
        } else {
            if (!checkPlayerWallCollision3D(nextX, p.z, 0.8)) p.x = nextX;
            else if (!checkPlayerWallCollision3D(p.x, nextZ, 0.8)) p.z = nextZ;
        }
    } else {
        p.vx = 0;
        p.vz = 0;
    }

    // Footsteps sound timing (silent on Shift or airborne)
    if ((p.y || 0) <= 0.05) {
        update3DFootsteps(isMoving, isShift, dt);
    }

    // Always aim forward where camera is pointing
    p.rotY = br3D.cameraCtrl.targetYaw;

    // 2. Automatic Continuous Firing while Mouse is held down
    if (br3D.mouse.isDown || br3D.touch.shootActive) {
        tryFire3DWeapon();
    }

    // 3. Jump Physics
    if (p.vy) {
        p.y = (p.y || 0) + p.vy * dt;
        p.vy -= 18 * dt; // Gravity
        if (p.y <= 0) {
            p.y = 0;
            p.vy = 0;
        }
    }
}

function update3DCamera(dt) {
    if (!br3D.camera) return;

    let targetX = 0, targetY = 1.45, targetZ = 0;
    if (br3D.isSpectator && br3D.spectatorTargetId) {
        const rp = br3D.remotePlayers[br3D.spectatorTargetId];
        if (rp) { targetX = rp.x; targetY = (rp.y || 0) + 1.45; targetZ = rp.z; }
    } else if (br3D.myP) {
        targetX = br3D.myP.x;
        targetY = (br3D.myP.y || 0) + (br3D.cameraCtrl.heightOffset || 1.45);
        targetZ = br3D.myP.z;
    }

    // Smooth camera orbit angles
    const c = br3D.cameraCtrl;
    c.yaw += (c.targetYaw - c.yaw) * 0.35;
    c.pitch += (c.targetPitch - c.pitch) * 0.35;
    c.distance += (c.targetDistance - c.distance) * 0.25;

    // Tactical Right Shoulder Offset (shifted right relative to camera view angle)
    const shoulderDist = c.shoulderOffset || 0.55;
    const rightX = Math.cos(c.yaw) * shoulderDist;
    const rightZ = -Math.sin(c.yaw) * shoulderDist;

    // Spherical orbit coordinates positioned behind player
    const horizDist = c.distance * Math.cos(c.pitch);
    const eyeX = targetX + rightX - horizDist * Math.sin(c.yaw);
    const eyeY = targetY + c.distance * Math.sin(c.pitch) + 0.35;
    const eyeZ = targetZ + rightZ - horizDist * Math.cos(c.yaw);

    br3D.camera.position.set(eyeX, Math.max(0.3, eyeY), eyeZ);

    // Look ahead through the crosshair
    const lookTargetX = targetX + rightX + 60 * Math.sin(c.yaw) * Math.cos(c.pitch);
    const lookTargetY = targetY - 60 * Math.sin(c.pitch);
    const lookTargetZ = targetZ + rightZ + 60 * Math.cos(c.yaw) * Math.cos(c.pitch);

    br3D.camera.lookAt(lookTargetX, lookTargetY, lookTargetZ);
}

// -----------------------------------------------------------------------------
// 3D MESH SYNCHRONIZATION & LEG ANIMATIONS
// -----------------------------------------------------------------------------
function sync3DCharacterMeshes(dt) {
    const now = Date.now();

    // 1. Local Player Mesh
    if (br3D.myP) {
        let mesh = br3D.localPlayerMesh || br3D.playerMeshes['__local__'] || br3D.playerMeshes[myId];
        if (!mesh) {
            mesh = create3DCharacterModel(br3D.myP.team);
            br3D.scene.add(mesh);
            br3D.localPlayerMesh = mesh;
            br3D.playerMeshes['__local__'] = mesh;
            br3D.playerMeshes[myId] = mesh;
        }

        mesh.visible = !!br3D.myP.alive;
        if (br3D.myP.alive) {
            mesh.position.set(br3D.myP.x, br3D.myP.y || 0, br3D.myP.z);
            mesh.rotation.y = br3D.myP.rotY;

            animate3DLegs(mesh, br3D.myP.vx, br3D.myP.vz, dt);

            if (mesh.shieldNode) {
                mesh.shieldNode.visible = (now < br3D.myP.invulnUntil);
                if (mesh.shieldNode.visible) {
                    mesh.shieldNode.rotation.y += 2 * dt;
                }
            }
        }
    }

    // 2. Bots Meshes
    br3D.bots.forEach(bot => {
        let mesh = br3D.botMeshes[bot.id];
        if (!mesh) {
            mesh = create3DCharacterModel(bot.team);
            br3D.scene.add(mesh);
            br3D.botMeshes[bot.id] = mesh;
        }

        mesh.visible = bot.alive;
        if (bot.alive) {
            mesh.position.set(bot.x, bot.y || 0, bot.z);
            mesh.rotation.y = bot.rotY;

            animate3DLegs(mesh, bot.vx, bot.vz, dt);

            if (mesh.shieldNode) {
                mesh.shieldNode.visible = (now < bot.invulnUntil);
                if (mesh.shieldNode.visible) {
                    mesh.shieldNode.rotation.y += 2 * dt;
                }
            }
        }
    });

    // 3. Remote Players Meshes
    Object.keys(br3D.remotePlayers).forEach(pId => {
        if (pId === myId) return;
        const rp = br3D.remotePlayers[pId];
        let mesh = br3D.playerMeshes[pId];
        if (!mesh) {
            mesh = create3DCharacterModel(rp.team);
            br3D.scene.add(mesh);
            br3D.playerMeshes[pId] = mesh;
        }

        mesh.visible = rp.alive !== false && (rp.hp === undefined || rp.hp > 0);
        if (mesh.visible) {
            mesh.position.x += (rp.x - mesh.position.x) * 0.35;
            mesh.position.z += (rp.z - mesh.position.z) * 0.35;
            mesh.position.y = rp.y || 0;
            mesh.rotation.y = rp.rotY || rp.a || 0;
            animate3DLegs(mesh, rp.vx || 0, rp.vz || rp.vy || 0, dt);

            if (mesh.shieldNode) {
                mesh.shieldNode.visible = (now < (rp.invulnUntil || 0));
                if (mesh.shieldNode.visible) mesh.shieldNode.rotation.y += 2 * dt;
            }
        }
    });

    // Cleanup meshes of removed players
    Object.keys(br3D.playerMeshes).forEach(id => {
        if (id !== '__local__' && id !== myId && !br3D.remotePlayers[id]) {
            br3D.scene.remove(br3D.playerMeshes[id]);
            delete br3D.playerMeshes[id];
        }
    });
}

function animate3DLegs(mesh, vx, vz, dt) {
    const isMoving = (vx * vx + vz * vz) > 0.25;
    if (!mesh.walkPhase) mesh.walkPhase = 0;

    if (isMoving) {
        mesh.walkPhase += 14 * dt;
        const swing = Math.sin(mesh.walkPhase) * 0.45;
        if (mesh.leftLegNode) mesh.leftLegNode.rotation.x = swing;
        if (mesh.rightLegNode) mesh.rightLegNode.rotation.x = -swing;
        if (mesh.leftArmNode) mesh.leftArmNode.rotation.x = Math.PI / 3 - swing * 0.25;
        if (mesh.rightArmNode) mesh.rightArmNode.rotation.x = Math.PI / 3 + swing * 0.25;
    } else {
        if (mesh.leftLegNode) mesh.leftLegNode.rotation.x *= 0.8;
        if (mesh.rightLegNode) mesh.rightLegNode.rotation.x *= 0.8;
        if (mesh.leftArmNode) mesh.leftArmNode.rotation.x = (mesh.leftArmNode.rotation.x - Math.PI / 3) * 0.8 + Math.PI / 3;
        if (mesh.rightArmNode) mesh.rightArmNode.rotation.x = (mesh.rightArmNode.rotation.x - Math.PI / 3) * 0.8 + Math.PI / 3;
    }
}

// -----------------------------------------------------------------------------
// 3D BULLET & PROJECTILE SIMULATION (LOCAL & NETWORK)
// -----------------------------------------------------------------------------
const _bulletScratchVec = new THREE.Vector3();

function update3DBullets(dt) {
    for (let i = br3D.bulletMeshes.length - 1; i >= 0; i--) {
        const b = br3D.bulletMeshes[i];
        b.life -= dt;

        const moveDist = b.speed * dt;
        const nextPosX = b.pos.x + b.dir.x * moveDist;
        const nextPosY = b.pos.y + b.dir.y * moveDist;
        const nextPosZ = b.pos.z + b.dir.z * moveDist;
        _bulletScratchVec.set(nextPosX, nextPosY, nextPosZ);

        // 1. Check Collision with 3D Walls
        if (checkBulletWallCollision3D(nextPosX, nextPosZ)) {
            create3DHitSparks(_bulletScratchVec, false);
            br3D.scene.remove(b.mesh);
            br3D.bulletMeshes.splice(i, 1);
            continue;
        }

        // Check Headshot height (height >= 1.65m from ground)
        const isHeadshot = (nextPosY >= 1.65);
        const baseDmg = (b.shooterId === myId && br3D.damagePerHit) ? br3D.damagePerHit : 28;
        const finalDamage = isHeadshot ? Math.round(baseDmg * 2.5) : baseDmg;

        // 2. Check Collision with Local Player
        if (b.shooterId !== myId && br3D.myP && br3D.myP.alive && b.team !== br3D.myP.team) {
            const dx = nextPosX - br3D.myP.x;
            const dz = nextPosZ - br3D.myP.z;
            if (dx * dx + dz * dz < 1.3) {
                damage3DPlayer(br3D.myP, finalDamage, b.shooterId, isHeadshot);
                create3DHitSparks(_bulletScratchVec, true);
                br3D.scene.remove(b.mesh);
                br3D.bulletMeshes.splice(i, 1);
                continue;
            }
        }

        // 3. Check Collision with Remote Players
        let hitRemote = false;
        if (b.shooterId === myId) {
            for (let rpId of Object.keys(br3D.remotePlayers)) {
                if (rpId === myId) continue;
                const rp = br3D.remotePlayers[rpId];
                if (rp && rp.alive && rp.team !== b.team) {
                    const dx = nextPosX - rp.x;
                    const dz = nextPosZ - rp.z;
                    if (dx * dx + dz * dz < 1.3) {
                        trigger3DHitmarker(isHeadshot);
                        create3DHitSparks(_bulletScratchVec, true);
                        spawn3DFloatingDamage(new THREE.Vector3(rp.x, isHeadshot ? 2.0 : 1.6, rp.z), finalDamage, isHeadshot);
                        br3D.damageDealt += finalDamage;

                        // Transmit damage via Firebase
                        if (lobbyId) {
                            db.ref(`lobbies/${lobbyId}/br/damage/${rpId}`).transaction(v => (parseInt(v) || 0) + finalDamage).catch(() => {});
                        }

                        br3D.scene.remove(b.mesh);
                        br3D.bulletMeshes.splice(i, 1);
                        hitRemote = true;
                        break;
                    }
                }
            }
        }
        if (hitRemote) continue;

        // 4. Check Collision with Bots
        let hitBot = false;
        for (let bot of br3D.bots) {
            if (b.shooterId !== bot.id && bot.alive && b.team !== bot.team) {
                const dx = nextPosX - bot.x;
                const dz = nextPosZ - bot.z;
                if (dx * dx + dz * dz < 1.3) {
                    if (b.shooterId === myId) {
                        trigger3DHitmarker(isHeadshot);
                    }
                    damage3DBot(bot, finalDamage, b.shooterId, isHeadshot);
                    create3DHitSparks(_bulletScratchVec, true);
                    br3D.scene.remove(b.mesh);
                    br3D.bulletMeshes.splice(i, 1);
                    hitBot = true;
                    break;
                }
            }
        }
        if (hitBot) continue;

        // Update tracer position
        b.pos.set(nextPosX, nextPosY, nextPosZ);
        b.mesh.position.set(nextPosX, nextPosY, nextPosZ);

        if (b.life <= 0) {
            br3D.scene.remove(b.mesh);
            br3D.bulletMeshes.splice(i, 1);
        }
    }

    // Update Particles
    for (let i = br3D.particleSystems.length - 1; i >= 0; i--) {
        const p = br3D.particleSystems[i];
        p.life -= dt;
        p.vel.y -= 9.8 * dt; // Gravity
        p.mesh.position.addScaledVector(p.vel, dt);

        if (p.life <= 0 || p.mesh.position.y < 0) {
            br3D.scene.remove(p.mesh);
            br3D.particleSystems.splice(i, 1);
        }
    }
}

function damage3DPlayer(p, rawDamage, attackerId, isHeadshot = false) {
    const now = Date.now();
    if (now < p.invulnUntil || !p.alive) return;

    const damage = Math.max(1, rawDamage);
    p.hp -= damage;
    spawn3DFloatingDamage(new THREE.Vector3(p.x, isHeadshot ? 2.0 : 1.6, p.z), damage, isHeadshot);
    update3DHUD();

    if (p.hp <= 0) {
        p.hp = 0;
        p.alive = false;
        handle3DPlayerDeath(p, attackerId, isHeadshot);
    }
}

function damage3DBot(bot, rawDamage, attackerId, isHeadshot = false) {
    const now = Date.now();
    if (now < bot.invulnUntil || !bot.alive) return;

    const damage = Math.max(1, rawDamage);
    bot.hp -= damage;
    spawn3DFloatingDamage(new THREE.Vector3(bot.x, isHeadshot ? 2.0 : 1.6, bot.z), damage, isHeadshot);

    if (attackerId === myId) {
        br3D.damageDealt += damage;
    }

    if (bot.hp <= 0) {
        bot.hp = 0;
        bot.alive = false;
        handle3DBotDeath(bot, attackerId, isHeadshot);
    }
}

function handle3DPlayerDeath(p, attackerId, isHeadshot = false) {
    const killerName = (attackerId === myId) ? (typeof myName !== 'undefined' ? myName : 'Вы') : (br3D.remotePlayers[attackerId]?.name || 'Бот');
    const killerTeam = (attackerId === myId) ? br3D.myP?.team : (br3D.remotePlayers[attackerId]?.team || 'Terrorists');
    const weaponName = (attackerId === myId && br3D.currentWeapon) ? br3D.currentWeapon.name : 'AK-47';

    add3DKillFeed(killerName, p.name || 'Игрок', killerTeam, p.team, weaponName, isHeadshot);

    if (attackerId === myId) {
        br3D.kills++;
        record3DKill(p.name || 'Игрок', isHeadshot);
    } else if (lobbyId && attackerId) {
        db.ref(`lobbies/${lobbyId}/br/players/${attackerId}/kills`).transaction(v => (parseInt(v) || 0) + 1).catch(() => {});
    }

    // Award team score
    if (p.team === 'Counter-Terrorists' || p.team === 'CT') {
        br3D.tScore++;
    } else {
        br3D.ctScore++;
    }

    if (lobbyId && isHost) {
        db.ref(`lobbies/${lobbyId}/br`).update({
            ctScore: br3D.ctScore,
            tScore: br3D.tScore
        }).catch(() => {});
    }

    update3DHUD();
    syncBrPlayerState(true);

    // Spawn Weapon Drop
    const randP = Math.random();
    const pDropSlot = randP < 0.3 ? 4 : (randP < 0.6 ? 2 : 1);
    const pDropName = pDropSlot === 4 ? 'AWP' : (pDropSlot === 2 ? 'DEAGLE' : (p.team === 'Counter-Terrorists' ? 'M4A1' : 'AK-47'));
    spawn3DWeaponDrop(new THREE.Vector3(p.x, 0.4, p.z), pDropSlot, pDropName);

    if (br3D.mode === 'tdm_5v5') {
        showRespawnTimer(1.5, () => {
            respawn3DPlayer();
        });
    } else {
        br3D.isSpectator = true;
        document.getElementById('br-ui-spectator').style.display = 'block';
        checkDuelRoundEnd();
    }
}

function handle3DBotDeath(bot, attackerId, isHeadshot = false) {
    const killerName = (attackerId === myId) ? (typeof myName !== 'undefined' ? myName : 'Вы') : (bot.team === 'Counter-Terrorists' ? 'Terrorist Bot' : 'CT Bot');
    const killerTeam = (attackerId === myId) ? br3D.myP?.team : (bot.team === 'Counter-Terrorists' ? 'Terrorists' : 'Counter-Terrorists');
    const weaponName = (attackerId === myId && br3D.currentWeapon) ? br3D.currentWeapon.name : 'AK-47';

    add3DKillFeed(killerName, bot.name || ('Бот ' + bot.id), killerTeam, bot.team, weaponName, isHeadshot);

    // Spawn Weapon Drop from bot
    const randB = Math.random();
    const bDropSlot = randB < 0.25 ? 4 : (randB < 0.55 ? 2 : 1);
    const bDropName = bDropSlot === 4 ? 'AWP' : (bDropSlot === 2 ? 'DEAGLE' : (bot.team === 'Counter-Terrorists' ? 'M4A1' : 'AK-47'));
    spawn3DWeaponDrop(new THREE.Vector3(bot.x, 0.4, bot.z), bDropSlot, bDropName);

    if (attackerId === myId) {
        br3D.kills++;
        const killsEl = document.getElementById('br-ui-kills');
        if (killsEl) killsEl.innerText = `Киллы: ${br3D.kills}`;
        record3DKill(bot.name || ('Бот ' + bot.id), isHeadshot);
    }

    if (bot.team === 'Counter-Terrorists' || bot.team === 'CT') {
        br3D.tScore++;
    } else {
        br3D.ctScore++;
    }

    if (lobbyId && isHost) {
        db.ref(`lobbies/${lobbyId}/br`).update({
            ctScore: br3D.ctScore,
            tScore: br3D.tScore
        }).catch(() => {});
    }

    update3DHUD();

    if (br3D.mode === 'tdm_5v5') {
        bot.respawnTime = Date.now() + 1500;
    } else {
        checkDuelRoundEnd();
    }
}

function respawn3DPlayer() {
    if (!br3D.myP) return;
    const spawn = get3DSpawnPos(br3D.myP.team, br3D.mode);
    br3D.myP.x = spawn.x;
    br3D.myP.z = spawn.z;
    br3D.myP.y = 0;
    br3D.myP.hp = br3D.myP.maxHp;
    br3D.myP.alive = true;
    br3D.myP.invulnUntil = Date.now() + 3000;
    br3D.ammo = br3D.maxAmmo;
    br3D.grenades = 1;
    br3D.smokeGrenades = 1;
    if (br3D.isScoped) toggle3DScope();
    br3D.isSpectator = false;
    updateWeaponSlotsUI();

    const spec = document.getElementById('br-ui-spectator');
    if (spec) spec.style.display = 'none';
    update3DHUD();
    syncBrPlayerState(true);
}

function showRespawnTimer(seconds, callback) {
    const overlay = document.getElementById('br-respawn-overlay');
    const timerText = document.getElementById('br-respawn-countdown');
    if (!overlay || !timerText) {
        if (callback) callback();
        return;
    }

    overlay.classList.remove('hidden');
    let remain = seconds;
    timerText.innerText = remain.toFixed(1);

    const interval = setInterval(() => {
        remain -= 0.1;
        if (remain <= 0) {
            clearInterval(interval);
            overlay.classList.add('hidden');
            if (callback) callback();
        } else {
            timerText.innerText = remain.toFixed(1);
        }
    }, 100);
}

// -----------------------------------------------------------------------------
// FIREBASE NETWORK SYNCHRONIZATION
// -----------------------------------------------------------------------------
function brPublicPlayerState(includeHealth) {
    if (!br3D.myP) return {};
    return {
        id: myId,
        name: typeof myName !== 'undefined' ? myName : 'Игрок',
        avatar: typeof myAvatar !== 'undefined' ? myAvatar : '👤',
        eqName: typeof myEqName !== 'undefined' ? myEqName : '',
        x: Number(br3D.myP.x.toFixed(2)),
        z: Number(br3D.myP.z.toFixed(2)),
        vx: Number((br3D.myP.vx || 0).toFixed(2)),
        vz: Number((br3D.myP.vz || 0).toFixed(2)),
        rotY: Number(br3D.myP.rotY.toFixed(3)),
        hp: br3D.myP.hp,
        maxHp: br3D.myP.maxHp || 100,
        alive: br3D.myP.alive,
        kills: br3D.kills,
        shotSeq: br3D.myP.shotSeq || 0,
        team: brNormalizeTeam(br3D.myP.team),
        invulnUntil: br3D.myP.invulnUntil || 0,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
    };
}

function syncBrPlayerState(force = false) {
    if (!br3D.active || !lobbyId || !br3D.myP) return;
    const state = brPublicPlayerState(force);
    db.ref(`lobbies/${lobbyId}/br/players/${myId}`).update(state).catch(() => {});
}

function apply3DRemoteShot(p) {
    const seq = Number(p.shotSeq) || 0;
    if (!seq || br3D.remoteShotSeqs[p.id] === seq) return;
    br3D.remoteShotSeqs[p.id] = seq;

    const angle = p.rotY || p.a || 0;
    const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)).normalize();
    const fromPos = new THREE.Vector3(p.x, 1.35, p.z).addScaledVector(dir, 0.8);
    fire3DBullet(fromPos, dir, p.id, p.team);
}

// -----------------------------------------------------------------------------
// ROUND STATE MACHINE & DUEL / TDM FLOW
// -----------------------------------------------------------------------------
function checkDuelRoundEnd() {
    if (br3D.roundEnding || (lobbyId && !isHost)) return;

    let ctAlive = 0, tAlive = 0;
    if (br3D.myP && br3D.myP.alive) {
        if (br3D.myP.team === 'Counter-Terrorists') ctAlive++; else tAlive++;
    }
    Object.values(br3D.remotePlayers).forEach(rp => {
        if (rp.alive) {
            if (rp.team === 'Counter-Terrorists') ctAlive++; else tAlive++;
        }
    });
    br3D.bots.forEach(b => {
        if (b.alive) {
            if (b.team === 'Counter-Terrorists') ctAlive++; else tAlive++;
        }
    });

    if (ctAlive === 0 || tAlive === 0) {
        br3D.roundEnding = true;
        const winner = (ctAlive > 0) ? 'Counter-Terrorists' : 'Terrorists';
        if (winner === 'Counter-Terrorists') br3D.ctRounds++; else br3D.tRounds++;

        if (lobbyId && isHost) {
            db.ref(`lobbies/${lobbyId}/br`).update({
                ctRounds: br3D.ctRounds,
                tRounds: br3D.tRounds,
                currentRound: br3D.currentRound,
                roundEnding: { winner: winner, until: Date.now() + 3500 }
            }).catch(() => {});
        } else {
            playTeamWinSound(winner);
            showRoundWinnerBanner(winner);
            setTimeout(() => {
                if (br3D.ctRounds >= 8 || br3D.tRounds >= 8) {
                    end3DMatch();
                } else {
                    startNextDuelRound();
                }
            }, 3500);
        }
    }
}

function showRoundWinnerBanner(winner) {
    const container = document.getElementById('br-container');
    if (!container) return;

    const banner = document.createElement('div');
    banner.className = 'round-banner-overlay';
    const isCT = (winner === 'Counter-Terrorists' || winner === 'CT');
    banner.innerHTML = `
        <div class="round-banner-title ${isCT ? 'ct' : 't'}">
            ${isCT ? 'COUNTER-TERRORISTS' : 'TERRORISTS'} ПОБЕДИЛИ!
        </div>
        <div class="round-banner-sub">Раунд ${br3D.currentRound} завершен</div>
    `;
    container.appendChild(banner);

    setTimeout(() => {
        banner.remove();
    }, 3200);
}

function startNextDuelRound() {
    br3D.roundEnding = false;
    br3D.currentRound++;

    // Clear bullets and decals
    br3D.bulletMeshes.forEach(b => br3D.scene.remove(b.mesh));
    br3D.bulletMeshes = [];
    br3D.bloodDecals.forEach(d => br3D.scene.remove(d));
    br3D.bloodDecals = [];

    respawn3DPlayer();
    br3D.bots.forEach(bot => {
        const spawn = get3DSpawnPos(bot.team, br3D.mode);
        bot.x = spawn.x; bot.z = spawn.z; bot.hp = bot.maxHp; bot.alive = true;
        bot.invulnUntil = Date.now() + 3000;
    });

    update3DHUD();
}

function end3DMatch() {
    br3D.matchActive = false;
    exit3DPointerLock();

    const isWinner = (br3D.myP && ((br3D.myP.team === 'Counter-Terrorists' && br3D.ctScore >= br3D.tScore) || (br3D.myP.team === 'Terrorists' && br3D.tScore >= br3D.ctScore)));

    const resultOverlay = document.getElementById('result-overlay');
    const resultEmoji = document.getElementById('result-emoji');
    const resultText = document.getElementById('result-text');
    const resultSub = document.getElementById('result-subtext');

    if (resultOverlay && resultText) {
        resultEmoji.innerText = isWinner ? '🏆' : '💀';
        resultText.innerText = isWinner ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ';
        resultSub.innerHTML = `
            <div style="font-size: 18px; margin-top: 10px;">
                Киллы: <b>${br3D.kills}</b> | Урон: <b>${br3D.damageDealt}</b><br>
                Счет матча: CT <b>${br3D.mode === 'tdm_5v5' ? br3D.ctScore : br3D.ctRounds}</b> - <b>${br3D.mode === 'tdm_5v5' ? br3D.tScore : br3D.tRounds}</b> T<br>
                Награда: +<b>${isWinner ? 150 : 50}</b> 🪙
            </div>
        `;
        resultOverlay.classList.remove('hidden');
    }

    const reward = isWinner ? 150 : 50;
    if (typeof addCoins === 'function') {
        addCoins(reward);
    } else if (typeof globalCoins !== 'undefined') {
        globalCoins += reward;
        if (typeof updateCoinsUI === 'function') updateCoinsUI();
    }
}

// -----------------------------------------------------------------------------
// 3D HUD & RADAR / MINIMAP
// -----------------------------------------------------------------------------
let _cachedHudEls = null;
let _lastHudState = { hp: -1, maxHp: -1, ammo: -1, reloading: null, alive: -1, ctScore: -1, tScore: -1, timer: '' };

function update3DHUD() {
    if (!_cachedHudEls) {
        _cachedHudEls = {
            ctScore: document.getElementById('br-ct-score-val'),
            tScore: document.getElementById('br-t-score-val'),
            timerVal: document.getElementById('br-match-timer-val'),
            hpFill: document.getElementById('br-hp-fill'),
            hpVal: document.getElementById('br-hp-val'),
            ammoVal: document.getElementById('br-ammo-val'),
            aliveEl: document.getElementById('br-ui-alive'),
            killsEl: document.getElementById('br-ui-kills')
        };
    }
    const els = _cachedHudEls;

    // Scoreboard
    const ctScore = (br3D.mode === 'tdm_5v5') ? br3D.ctScore : br3D.ctRounds;
    const tScore = (br3D.mode === 'tdm_5v5') ? br3D.tScore : br3D.tRounds;
    if (_lastHudState.ctScore !== ctScore) {
        _lastHudState.ctScore = ctScore;
        if (els.ctScore) els.ctScore.innerText = ctScore;
    }
    if (_lastHudState.tScore !== tScore) {
        _lastHudState.tScore = tScore;
        if (els.tScore) els.tScore.innerText = tScore;
    }

    // Timer
    if (br3D.matchStartTime) {
        const elapsed = Math.floor((Date.now() - br3D.matchStartTime) / 1000);
        const remain = Math.max(0, br3D.matchDuration - elapsed);
        const mins = String(Math.floor(remain / 60)).padStart(2, '0');
        const secs = String(remain % 60).padStart(2, '0');
        const timerStr = `${mins}:${secs}`;
        if (_lastHudState.timer !== timerStr) {
            _lastHudState.timer = timerStr;
            if (els.timerVal) els.timerVal.innerText = timerStr;
        }
    }

    // Health
    if (br3D.myP) {
        const hp = Math.max(0, br3D.myP.hp);
        const maxHp = br3D.myP.maxHp || 100;
        if (_lastHudState.hp !== hp || _lastHudState.maxHp !== maxHp) {
            _lastHudState.hp = hp;
            _lastHudState.maxHp = maxHp;
            const pct = Math.min(100, Math.max(0, (hp / maxHp) * 100));
            if (els.hpFill) els.hpFill.style.width = `${pct}%`;
            if (els.hpVal) els.hpVal.innerText = hp;
        }
    }

    // Ammo
    const isRel = br3D.isReloading;
    const ammo = br3D.ammo;
    if (_lastHudState.ammo !== ammo || _lastHudState.reloading !== isRel) {
        _lastHudState.ammo = ammo;
        _lastHudState.reloading = isRel;
        if (els.ammoVal) els.ammoVal.innerText = isRel ? 'RELOAD...' : ammo;
    }

    // Alive tracker
    let aliveCount = (br3D.myP && br3D.myP.alive) ? 1 : 0;
    Object.values(br3D.remotePlayers).forEach(rp => { if (rp.alive) aliveCount++; });
    br3D.bots.forEach(b => { if (b.alive) aliveCount++; });
    if (_lastHudState.alive !== aliveCount) {
        _lastHudState.alive = aliveCount;
        if (els.aliveEl) els.aliveEl.innerText = `Живых: ${aliveCount}`;
    }
}

let _radarBgCanvas = null;

function buildRadarBackground() {
    const w = 120, h = 120;
    if (!_radarBgCanvas) {
        _radarBgCanvas = document.createElement('canvas');
        _radarBgCanvas.width = w;
        _radarBgCanvas.height = h;
    }
    const ctx = _radarBgCanvas.getContext('2d');
    ctx.fillStyle = 'rgba(15, 20, 30, 0.88)';
    ctx.fillRect(0, 0, w, h);

    const half = br3D.mapSize / 2;
    const scale = w / br3D.mapSize;

    // Walls
    ctx.fillStyle = '#445566';
    br3D.walls.forEach(wall => {
        const rx = (wall.minX + half) * scale;
        const rz = (wall.minZ + half) * scale;
        const rw = (wall.maxX - wall.minX) * scale;
        const rd = (wall.maxZ - wall.minZ) * scale;
        ctx.fillRect(rx, rz, rw, rd);
    });

    // Bases
    if (br3D.baseRects.ct) {
        ctx.fillStyle = 'rgba(50, 173, 230, 0.3)';
        const b = br3D.baseRects.ct;
        ctx.fillRect((b.minX + half) * scale, (b.minZ + half) * scale, (b.maxX - b.minX) * scale, (b.maxZ - b.minZ) * scale);
    }
    if (br3D.baseRects.t) {
        ctx.fillStyle = 'rgba(255, 159, 10, 0.3)';
        const b = br3D.baseRects.t;
        ctx.fillRect((b.minX + half) * scale, (b.minZ + half) * scale, (b.maxX - b.minX) * scale, (b.maxZ - b.minZ) * scale);
    }
}

function render3DRadar() {
    const minimap = document.getElementById('br-minimap-canvas');
    if (!minimap) return;
    const ctx = minimap.getContext('2d');
    const w = minimap.width;
    const h = minimap.height;

    if (_radarBgCanvas) {
        ctx.drawImage(_radarBgCanvas, 0, 0, w, h);
    } else {
        ctx.fillStyle = 'rgba(15, 20, 30, 0.85)';
        ctx.fillRect(0, 0, w, h);
    }

    const half = br3D.mapSize / 2;
    const scale = w / br3D.mapSize;

    // Local Player
    if (br3D.myP && br3D.myP.alive) {
        ctx.fillStyle = '#00ffcc';
        ctx.beginPath();
        ctx.arc((br3D.myP.x + half) * scale, (br3D.myP.z + half) * scale, 3.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Remote Players
    Object.values(br3D.remotePlayers).forEach(rp => {
        if (!rp.alive) return;
        const isAlly = (br3D.myP && rp.team === br3D.myP.team);
        ctx.fillStyle = isAlly ? '#32ade6' : '#ff453a';
        ctx.beginPath();
        ctx.arc((rp.x + half) * scale, (rp.z + half) * scale, 3.0, 0, Math.PI * 2);
        ctx.fill();
    });

    // Bots
    br3D.bots.forEach(bot => {
        if (!bot.alive) return;
        const isAlly = (br3D.myP && bot.team === br3D.myP.team);
        ctx.fillStyle = isAlly ? '#32ade6' : '#ff453a';
        ctx.beginPath();
        ctx.arc((bot.x + half) * scale, (bot.z + half) * scale, 2.5, 0, Math.PI * 2);
        ctx.fill();
    });
}

// -----------------------------------------------------------------------------
// LOBBY & TEAM SELECTOR (STANDOFF 2 STYLE)
// -----------------------------------------------------------------------------
function selectTeam(teamName) {
    br3D.selectedTeam = teamName;

    // Immediately hide the team selection overlay and spawn the local player
    const overlay = document.getElementById('so2-lobby-overlay');
    if (overlay) overlay.style.display = 'none';

    // Initialize/update local player immediately so there is ZERO hang or freeze
    const submode = br3D.mode || 'tdm_5v5';
    const spawn = get3DSpawnPos(teamName, submode);
    const mySettings = (typeof mergedSettingsForGame === 'function' ? mergedSettingsForGame('br_2d') : {})?.players?.[myId] || {};
    const myMaxHp = Math.max(1, parseInt(mySettings.lives) || 100);
    const mySpeed = brNormalizeSpeed(mySettings.speed);

    if (!br3D.myP) {
        br3D.myP = {
            id: myId,
            team: teamName,
            x: spawn.x,
            y: 0,
            z: spawn.z,
            vx: 0, vz: 0,
            rotY: (teamName === 'Counter-Terrorists' || teamName === 'CT') ? Math.PI / 2 : -Math.PI / 2,
            hp: myMaxHp,
            maxHp: myMaxHp,
            speed: mySpeed,
            alive: true,
            kills: 0,
            shotSeq: 0,
            invulnUntil: Date.now() + 3000
        };
        br3D.cameraCtrl.yaw = br3D.myP.rotY;
        br3D.cameraCtrl.targetYaw = br3D.myP.rotY;
    } else {
        br3D.myP.team = teamName;
        br3D.myP.x = spawn.x;
        br3D.myP.z = spawn.z;
        br3D.myP.rotY = (teamName === 'Counter-Terrorists' || teamName === 'CT') ? Math.PI / 2 : -Math.PI / 2;
        br3D.cameraCtrl.yaw = br3D.myP.rotY;
        br3D.cameraCtrl.targetYaw = br3D.myP.rotY;
    }

    // Ensure 3D Loop is running
    start3DLoop();

    // Lock Pointer on entering match
    request3DPointerLock();

    if (!lobbyId) {
        init3DBots(submode);
        return;
    }

    // In a lobby: update Firebase and notify others
    const base = `lobbies/${lobbyId}/br`;
    db.ref(`${base}/players/${myId}/team`).set(teamName).catch(() => {});
    syncBrPlayerState(true);

    if (isHost && !br3D.spawningBotsStarted) {
        br3D.spawningBotsStarted = true;
        setTimeout(() => {
            db.ref(`${base}/players`).once('value').then(snap => {
                const players = snap.exists() ? snap.val() : { [myId]: { team: teamName } };
                finalize3DMatchStart(players, submode);
            }).catch(() => {
                finalize3DMatchStart({ [myId]: { team: teamName } }, submode);
            });
        }, 600);
    }
}
window.selectTeam = selectTeam;

function finalize3DMatchStart(players, mode) {
    if (!isHost || !lobbyId) return;

    let maxTeamSize = 5;
    if (mode === 'duel_1v1') maxTeamSize = 1;
    else if (mode === 'duel_2v2') maxTeamSize = 2;

    let ctRealIds = [], tRealIds = [];
    Object.keys(players || {}).forEach(id => {
        const team = brNormalizeTeam(players[id].team);
        if (team === 'Counter-Terrorists') ctRealIds.push(id);
        else if (team === 'Terrorists') tRealIds.push(id);
    });

    const ctBotCount = Math.max(0, maxTeamSize - ctRealIds.length);
    const tBotCount = Math.max(0, maxTeamSize - tRealIds.length);

    const bots = [];
    for (let i = 0; i < ctBotCount; i++) {
        const sp = get3DSpawnPos('Counter-Terrorists', mode);
        bots.push(create3DBotObj('bot_ct_' + (i + 1), 'Бот CT-' + (i + 1), 'Counter-Terrorists', sp.x, sp.z));
    }
    for (let i = 0; i < tBotCount; i++) {
        const sp = get3DSpawnPos('Terrorists', mode);
        bots.push(create3DBotObj('bot_t_' + (i + 1), 'Бот T-' + (i + 1), 'Terrorists', sp.x, sp.z));
    }

    br3D.bots = bots;
    const base = `lobbies/${lobbyId}/br`;

    db.ref(base).update({
        bots: bots,
        damage: {},
        ctScore: 0,
        tScore: 0,
        ctRounds: 0,
        tRounds: 0,
        currentRound: 1,
        matchStartTime: Date.now(),
        roundStartCountdownUntil: Date.now() + 3000,
        matchGameplayStarted: true
    }).catch(() => {});

    Object.keys(players || {}).forEach(id => {
        const p = players[id];
        const team = brNormalizeTeam(p.team);
        const sp = get3DSpawnPos(team, mode);
        db.ref(`${base}/players/${id}`).update({
            x: Number(sp.x.toFixed(2)),
            z: Number(sp.z.toFixed(2)),
            hp: p.maxHp || 100,
            maxHp: p.maxHp || 100,
            alive: true
        }).catch(() => {});
    });
}

// -----------------------------------------------------------------------------
// MAIN 3D GAME LOOP & START / STOP
// -----------------------------------------------------------------------------
let _radarThrottleTimer = 0;

function start3DLoop() {
    if (!br3D.active) return;
    if (br3D.animFrameId) {
        cancelAnimationFrame(br3D.animFrameId);
        br3D.animFrameId = null;
    }
    br3D.animFrameId = requestAnimationFrame(br3DLoop);
}

function br3DLoop() {
    if (!br3D.active) {
        br3D.animFrameId = null;
        return;
    }
    const dt = Math.min(br3D.clock ? br3D.clock.getDelta() : 0.016, 0.05);

    // Update Local Player
    update3DLocalPlayer(dt);

    // Update Bots AI (Host or Solo runs AI)
    if (!lobbyId || isHost) {
        update3DBots(dt);
    }

    // Update Bullets & Ballistics
    update3DBullets(dt);

    // Update Grenades & Smokes
    update3DGrenades(dt);
    update3DSmokeGrenades(dt);
    update3DSmokeClouds(dt);

    // Update Weapon Pickups on Ground
    update3DWeaponPickups(dt);

    // Update Camera Position & Orbit
    update3DCamera(dt);

    // Sync 3D Meshes
    sync3DCharacterMeshes(dt);

    // Render HUD
    update3DHUD();

    // Throttled 2D Radar Update
    _radarThrottleTimer += dt;
    if (_radarThrottleTimer >= 0.08) {
        _radarThrottleTimer = 0;
        render3DRadar();
    }

    // Render Three.js Scene
    if (br3D.renderer && br3D.scene && br3D.camera) {
        br3D.renderer.render(br3D.scene, br3D.camera);
    }

    if (br3D.active) {
        br3D.animFrameId = requestAnimationFrame(br3DLoop);
    } else {
        br3D.animFrameId = null;
    }
}

function start3DMatchClient(submode) {
    const base = `lobbies/${lobbyId}/br`;
    const overlay = document.getElementById('so2-lobby-overlay');
    if (overlay) overlay.style.display = 'none';

    // 1. Disconnect handler
    db.ref(`${base}/players/${myId}`).onDisconnect().update({ alive: false, hp: 0 });

    // 2. Players list sync
    if (!br3D.playersListener) {
        br3D.playersListener = playersSnap => {
            if (!playersSnap.exists()) return;
            const data = playersSnap.val();
            br3D.remotePlayers = data;
            const remoteMe = data[myId];
            if (remoteMe && br3D.myP) {
                br3D.kills = Math.max(br3D.kills, parseInt(remoteMe.kills) || 0);
                const killsEl = document.getElementById('br-ui-kills');
                if (killsEl) killsEl.innerText = `Киллы: ${br3D.kills}`;
                if (remoteMe.team) br3D.myP.team = remoteMe.team;
            }
        };
        db.ref(`${base}/players`).on('value', br3D.playersListener);
    }

    // 3. Remote shots listener
    if (!br3D.shotsListener) {
        br3D.shotsListener = snap => {
            const p = snap.exists() ? Object.assign({ id: snap.key }, snap.val()) : null;
            if (!p || p.id === myId) return;
            br3D.remotePlayers[p.id] = p;
            apply3DRemoteShot(p);
        };
        db.ref(`${base}/players`).on('child_changed', br3D.shotsListener);
    }

    // 4. Damage listener
    if (!br3D.damageListener) {
        br3D.damageListener = damageSnap => {
            br3D.damageByPlayer = damageSnap.exists() ? damageSnap.val() : {};
            const myDamage = Math.max(0, parseInt(br3D.damageByPlayer[myId]) || 0);
            if (br3D.myP && myDamage > br3D.damageTaken && Date.now() > br3D.myP.invulnUntil) {
                const delta = myDamage - br3D.damageTaken;
                br3D.damageTaken = myDamage;
                br3D.myP.hp = Math.max(0, br3D.myP.hp - delta);
                create3DHitSparks(new THREE.Vector3(br3D.myP.x, 1.2, br3D.myP.z), true);
                spawn3DFloatingDamage(new THREE.Vector3(br3D.myP.x, 1.8, br3D.myP.z), delta);
                update3DHUD();
                if (br3D.myP.hp <= 0) {
                    br3D.myP.alive = false;
                    handle3DPlayerDeath(br3D.myP, null);
                }
            }
        };
        db.ref(`${base}/damage`).on('value', br3D.damageListener);
    }

    // 5. Bots listener (Clients receive bot state from host)
    if (!isHost && !br3D.botsListener) {
        br3D.botsListener = botsSnap => {
            if (botsSnap.exists()) {
                const val = botsSnap.val();
                br3D.bots = Array.isArray(val) ? val : Object.values(val);
            }
        };
        db.ref(`${base}/bots`).on('value', br3D.botsListener);
    }

    // 6. Rounds & Match State listener
    if (!br3D.roundsListener) {
        br3D.roundsListener = roundsSnap => {
            if (!roundsSnap.exists()) return;
            const data = roundsSnap.val();
            const oldRound = br3D.currentRound || 1;

            br3D.ctScore = data.ctScore || 0;
            br3D.tScore = data.tScore || 0;
            br3D.ctRounds = data.ctRounds || 0;
            br3D.tRounds = data.tRounds || 0;
            br3D.currentRound = data.currentRound || 1;

            if (data.roundEnding && data.roundEnding.winner) {
                if (!br3D.roundEnding) {
                    br3D.roundEnding = true;
                    playTeamWinSound(data.roundEnding.winner);
                    showRoundWinnerBanner(data.roundEnding.winner);
                }
            } else {
                br3D.roundEnding = false;
            }

            if (br3D.currentRound > oldRound) {
                startNextDuelRound();
            }

            if (data.matchEnded) {
                end3DMatch();
            }
        };
        db.ref(`${base}`).on('value', br3D.roundsListener);
    }

    // 7. Sync Timers
    if (!br3D.syncTimer) {
        br3D.syncTimer = setInterval(() => syncBrPlayerState(), 80);
    }

    if (isHost && !br3D.hostBotTimer) {
        br3D.hostBotTimer = setInterval(() => {
            if (br3D.active && lobbyId && br3D.bots.length > 0) {
                db.ref(`${base}/bots`).set(br3D.bots).catch(() => {});
            }
        }, 100);
    }

    syncBrPlayerState(true);

    start3DLoop();
}

function initBR() {
    br3D.active = true;
    br3D.matchActive = true;
    br3D.matchStartTime = Date.now();
    br3D.kills = 0;
    br3D.damageDealt = 0;
    br3D.damageTaken = 0;
    br3D.ctScore = 0;
    br3D.tScore = 0;
    br3D.ctRounds = 0;
    br3D.tRounds = 0;
    br3D.currentWeaponSlot = 1;
    br3D.currentWeapon = WEAPONS_CONFIG[1];
    br3D.ammo = 30;
    br3D.maxAmmo = 30;
    br3D.damagePerHit = 28;
    br3D.fireRate = 0.11;
    br3D.grenades = 1;
    br3D.smokeGrenades = 1;
    br3D.killstreak = 0;
    br3D.lastKillTime = 0;
    br3D.grenadesList = [];
    br3D.smokeGrenadesList = [];
    br3D.smokeClouds = [];
    br3D.weaponDrops = [];
    br3D.isScoped = false;
    const scopeEl = document.getElementById('br-sniper-scope');
    if (scopeEl) scopeEl.classList.add('hidden');
    const dot = document.querySelector('.hud-crosshair-dot');
    if (dot) dot.style.display = 'block';
    br3D.isReloading = false;
    br3D.spawningBotsStarted = false;
    br3D.myP = null;

    // Detect game mode
    const submode = (typeof appState !== 'undefined' && appState.selectedGameId && appState.selectedGameId.startsWith('br_')) 
        ? appState.selectedGameId.replace('br_', '') 
        : 'tdm_5v5';
    br3D.mode = submode;

    // Init Three.js Engine & Map
    init3DEngine();
    generate3DMap(submode);
    bind3DControls();
    updateWeaponSlotsUI();

    // Show Scoreboard & HUD Elements
    const scoreboard = document.getElementById('br-scoreboard');
    if (scoreboard) scoreboard.style.display = 'flex';
    const timerLabel = document.getElementById('br-match-timer-label');
    if (timerLabel) timerLabel.innerText = (submode === 'tdm_5v5') ? 'TDM' : 'DUEL';

    const isMobile = (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) || ('ontouchstart' in window);
    const controls = document.getElementById('br-controls');
    if (controls) controls.style.display = isMobile ? 'block' : 'none';

    // -------------------------------------------------------------
    // Firebase Multiplayer Lobby Flow
    // -------------------------------------------------------------
    if (lobbyId) {
        const overlay = document.getElementById('so2-lobby-overlay');
        if (overlay) overlay.style.display = 'flex';

        const base = `lobbies/${lobbyId}/br`;

        // Listen for match gameplay start
        db.ref(`${base}/matchGameplayStarted`).off();
        br3D.matchGameplayStartedListener = snap => {
            if (snap.exists() && snap.val() === true) {
                db.ref(`${base}/players`).off('value', br3D.teamSelectListener);
                start3DMatchClient(submode);
            }
        };
        db.ref(`${base}/matchGameplayStarted`).on('value', br3D.matchGameplayStartedListener);

        // Listen for team selection changes
        db.ref(`${base}/players`).off();
        br3D.teamSelectListener = snap => {
            const players = snap.exists() ? snap.val() : {};
            const ctList = document.getElementById('so2-ct-players-list');
            const tList = document.getElementById('so2-t-players-list');

            if (ctList && tList) {
                ctList.innerHTML = '';
                tList.innerHTML = '';
                let ctCount = 0, tCount = 0;

                Object.keys(players).forEach(id => {
                    if (typeof isAiFriendId === 'function' && isAiFriendId(id)) return;
                    const p = players[id];
                    const item = document.createElement('div');
                    item.className = 'so2-team-player-row';
                    const avHtml = (typeof getAvatarHTML === 'function') ? getAvatarHTML(p.avatar) : (p.avatar || '👤');
                    const nameHtml = (typeof getNameHTML === 'function') ? getNameHTML(p.name, p.eqName) : (p.name || 'Игрок');
                    item.innerHTML = `${avHtml} <span>${nameHtml}</span>`;

                    const team = brNormalizeTeam(p.team);
                    if (team === 'Counter-Terrorists') {
                        ctList.appendChild(item);
                        ctCount++;
                    } else if (team === 'Terrorists') {
                        tList.appendChild(item);
                        tCount++;
                    }
                });

                const ctCountEl = document.getElementById('so2-ct-count');
                const tCountEl = document.getElementById('so2-t-count');
                if (ctCountEl) ctCountEl.innerText = ctCount;
                if (tCountEl) tCountEl.innerText = tCount;

                const myPData = players[myId];
                if (myPData && myPData.team) {
                    // Hide overlay if my team was already selected
                    const ov = document.getElementById('so2-lobby-overlay');
                    if (ov) ov.style.display = 'none';
                }

                const realPlayers = (typeof lobbyPlayers !== 'undefined' && Array.isArray(lobbyPlayers) && lobbyPlayers.length > 0)
                    ? lobbyPlayers.filter(p => !isAiFriendId(p.id))
                    : [{ id: myId }];
                const allChosen = realPlayers.every(p => players[p.id] && brNormalizeTeam(players[p.id].team) !== '');
                const isBalanced = (realPlayers.length <= 1) || (Math.abs(ctCount - tCount) <= 1);

                const footerText = document.getElementById('so2-team-select-footer-text');
                if (allChosen && isBalanced) {
                    if (footerText) footerText.innerText = 'Все игроки готовы. Игра начинается!';
                    if (isHost && !br3D.spawningBotsStarted) {
                        br3D.spawningBotsStarted = true;
                        setTimeout(() => {
                            finalize3DMatchStart(players, submode);
                        }, 800);
                    }
                } else {
                    if (footerText) footerText.innerText = 'Ожидание выбора команд игроками...';
                }
            }
        };
        db.ref(`${base}/players`).on('value', br3D.teamSelectListener);

        // Register initial player state
        const mySettings = (typeof mergedSettingsForGame === 'function' ? mergedSettingsForGame('br_2d') : {})?.players?.[myId] || {};
        const myMaxHp = Math.max(1, parseInt(mySettings.lives) || 100);
        const freshPlayerObj = {
            id: myId,
            name: typeof myName !== 'undefined' ? myName : 'Игрок',
            avatar: typeof myAvatar !== 'undefined' ? myAvatar : '👤',
            eqName: typeof myEqName !== 'undefined' ? myEqName : '',
            team: '',
            hp: myMaxHp,
            maxHp: myMaxHp,
            alive: true,
            kills: 0,
            damageTaken: 0,
            shotSeq: 0,
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        };

        if (isHost) {
            db.ref(base).update({
                matchActive: true,
                matchGameplayStarted: false,
                currentMode: submode,
                currentRound: 1,
                ctScore: 0,
                tScore: 0,
                ctRounds: 0,
                tRounds: 0
            }).catch(() => {});
        }
        db.ref(`${base}/players/${myId}`).set(freshPlayerObj).catch(() => {});

    } else {
        // -------------------------------------------------------------
        // Solo / Local Offline Play (Instant Start with Bots)
        // -------------------------------------------------------------
        selectTeam('Counter-Terrorists');
    }
}

function stopBR() {
    br3D.active = false;
    br3D.matchActive = false;
    exit3DPointerLock();

    if (br3D.animFrameId) {
        cancelAnimationFrame(br3D.animFrameId);
        br3D.animFrameId = null;
    }
    if (br3D.syncTimer) {
        clearInterval(br3D.syncTimer);
        br3D.syncTimer = null;
    }
    if (br3D.hostBotTimer) {
        clearInterval(br3D.hostBotTimer);
        br3D.hostBotTimer = null;
    }

    if (lobbyId) {
        const base = `lobbies/${lobbyId}/br`;
        if (br3D.teamSelectListener) {
            db.ref(`${base}/players`).off('value', br3D.teamSelectListener);
            br3D.teamSelectListener = null;
        }
        if (br3D.matchGameplayStartedListener) {
            db.ref(`${base}/matchGameplayStarted`).off('value', br3D.matchGameplayStartedListener);
            br3D.matchGameplayStartedListener = null;
        }
        if (br3D.playersListener) {
            db.ref(`${base}/players`).off('value', br3D.playersListener);
            br3D.playersListener = null;
        }
        if (br3D.shotsListener) {
            db.ref(`${base}/players`).off('child_changed', br3D.shotsListener);
            br3D.shotsListener = null;
        }
        if (br3D.damageListener) {
            db.ref(`${base}/damage`).off('value', br3D.damageListener);
            br3D.damageListener = null;
        }
        if (br3D.botsListener) {
            db.ref(`${base}/bots`).off('value', br3D.botsListener);
            br3D.botsListener = null;
        }
        if (br3D.roundsListener) {
            db.ref(`${base}`).off('value', br3D.roundsListener);
            br3D.roundsListener = null;
        }

        if (isHost) {
            db.ref(base).remove().catch(() => {});
        } else {
            db.ref(`${base}/players/${myId}`).remove().catch(() => {});
        }
    }

    // Cleanup Three.js Scene
    if (br3D.bulletMeshes) {
        br3D.bulletMeshes.forEach(b => br3D.scene && br3D.scene.remove(b.mesh));
        br3D.bulletMeshes = [];
    }
    if (br3D.bloodDecals) {
        br3D.bloodDecals.forEach(d => br3D.scene && br3D.scene.remove(d));
        br3D.bloodDecals = [];
    }
    if (br3D.particleSystems) {
        br3D.particleSystems.forEach(p => br3D.scene && br3D.scene.remove(p.mesh));
        br3D.particleSystems = [];
    }
    if (br3D.grenadesList) {
        br3D.grenadesList.forEach(g => br3D.scene && br3D.scene.remove(g.mesh));
        br3D.grenadesList = [];
    }
    if (br3D.smokeGrenadesList) {
        br3D.smokeGrenadesList.forEach(g => br3D.scene && br3D.scene.remove(g.mesh));
        br3D.smokeGrenadesList = [];
    }
    if (br3D.smokeClouds) {
        br3D.smokeClouds.forEach(c => c.particles.forEach(p => br3D.scene && br3D.scene.remove(p.mesh)));
        br3D.smokeClouds = [];
    }
    if (br3D.weaponDrops) {
        br3D.weaponDrops.forEach(d => {
            if (br3D.scene) {
                br3D.scene.remove(d.mesh);
                br3D.scene.remove(d.ring);
            }
        });
        br3D.weaponDrops = [];
    }
    br3D.nearestWeaponDrop = null;
    br3D.isScoped = false;

    Object.keys(br3D.playerMeshes).forEach(id => {
        if (br3D.scene) br3D.scene.remove(br3D.playerMeshes[id]);
    });
    br3D.playerMeshes = {};
    Object.keys(br3D.botMeshes).forEach(id => {
        if (br3D.scene) br3D.scene.remove(br3D.botMeshes[id]);
    });
    br3D.botMeshes = {};
    br3D.localPlayerMesh = null;
    br3D.myP = null;
    br3D.remotePlayers = {};
    br3D.bots = [];

    const overlay = document.getElementById('so2-lobby-overlay');
    if (overlay) overlay.style.display = 'none';
    const resultOverlay = document.getElementById('result-overlay');
    if (resultOverlay) resultOverlay.classList.add('hidden');
    const deathScreen = document.getElementById('br-death-screen');
    if (deathScreen) deathScreen.style.display = 'none';
    const scopeEl = document.getElementById('br-sniper-scope');
    if (scopeEl) scopeEl.classList.add('hidden');
    const prompt = document.getElementById('br-pickup-prompt');
    if (prompt) prompt.classList.add('hidden');
    const dot = document.querySelector('.hud-crosshair-dot');
    if (dot) dot.style.display = 'block';
}

// Global exports
window.initBR = initBR;
window.stopBR = stopBR;
window.br3D = br3D;
