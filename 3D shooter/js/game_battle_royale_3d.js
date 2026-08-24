/**
 * =========================================================================================
 * 3D SHOOTER ENGINE - THREE.JS WEBGL TACTICAL SHOOTER (STANDOFF 2 / CS:GO STYLE 3D REWORK)
 * =========================================================================================
 * Fully reworked 3D gameplay, 3D characters, physics, ballistics, AI, and controls
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
    mapSize: 350, // 350m in 3D (equivalent to 3500px in 2D)
    mode: 'tdm_5v5',
    baseRects: { ct: null, t: null },
    
    // Local player state
    myP: null,
    keys: {},
    mouse: { x: 0, y: 0, worldX: 0, worldZ: 0, isDown: false, rightDown: false, midDown: false },
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
    
    // Interactive Camera Controls
    cameraCtrl: {
        distance: 22,
        targetDistance: 22,
        minDistance: 4,
        maxDistance: 65,
        yaw: 0,                 // Horizontal orbit angle (radians)
        targetYaw: 0,
        pitch: 0.85,            // Vertical elevation angle (~48 deg)
        targetPitch: 0.85,
        minPitch: 0.12,         // ~7 deg (low ground view)
        maxPitch: 1.48,         // ~85 deg (top-down view)
        panOffset: { x: 0, z: 0 },
        targetPanOffset: { x: 0, z: 0 },
        isDragging: false,
        dragButton: -1,
        lastX: 0,
        lastY: 0,
        mode: 'tactical',       // 'tactical' (dynamic follow), 'free' (free orbit), 'topdown' (overhead)
        autoAlignBehind: false
    },
    cameraTarget: null,
    
    // Combat & Weapon
    ammo: 30,
    maxAmmo: 30,
    isReloading: false,
    lastShotTime: 0,
    fireRate: 0.1, // 10 rounds/sec
    damagePerHit: 25,
    kills: 0,
    damageDealt: 0,
    isSpectator: false,
    spectatorTargetId: null,
    
    // Match state
    matchActive: false,
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
    
    // Bots & Multiplayer
    bots: [],
    remotePlayers: {},
    remoteShotSeqs: {},
    syncTimer: 0,
    hostBotTimer: 0,
    
    // Audio Context
    audioCtx: null,
    sounds: {}
};

function brNormalizeTeam(team) {
    if (!team) return 'Counter-Terrorists';
    return (team === 'Counter-Terrorists' || team === 'CT') ? 'Counter-Terrorists' : 'Terrorists';
}
window.brNormalizeTeam = brNormalizeTeam;

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
            // Punchy gunshot: low sine drop + filtered noise
            const osc = ctx.createOscillator();
            const oscGain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(260, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
            oscGain.gain.setValueAtTime(0.7, now);
            oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.connect(oscGain);
            oscGain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.15);

            // Noise burst
            const bufSize = Math.floor(ctx.sampleRate * 0.1);
            const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
            const noise = ctx.createBufferSource();
            noise.buffer = buf;
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(2200, now);
            filter.frequency.exponentialRampToValueAtTime(200, now + 0.1);
            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.8, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(ctx.destination);
            noise.start(now);
        } else if (type === 'hit') {
            // Tactical hit confirmation beep / squish
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.08);
            gain.gain.setValueAtTime(0.35, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.08);
        } else if (type === 'ricochet') {
            // High metallic ping
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(2400 + Math.random() * 800, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 'beep') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'go') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1320, now);
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
// THREE.JS INITIALIZATION & SCENE SETUP (OPTIMIZED FOR 60 FPS MOBILE)
// -----------------------------------------------------------------------------
function init3DEngine() {
    const container = document.getElementById('br-container');
    if (!container) return;

    // Detect mobile device
    const isMobileDev = (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) || ('ontouchstart' in window);
    br3D.isMobile = isMobileDev;

    // Remove old canvas if exists
    const oldCanvas = document.getElementById('br-canvas-3d');
    if (oldCanvas) oldCanvas.remove();

    // Create 3D canvas
    const canvas = document.createElement('canvas');
    canvas.id = 'br-canvas-3d';
    container.insertBefore(canvas, container.firstChild);
    br3D.canvas = canvas;

    // Renderer with mobile optimizations
    br3D.renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: !isMobileDev, // Off on mobile for massive GPU fill-rate boost
        powerPreference: 'high-performance',
        precision: isMobileDev ? 'mediump' : 'highp',
        stencil: false,
        depth: true,
        alpha: false
    });
    br3D.renderer.setSize(container.clientWidth, container.clientHeight);
    // Cap pixel ratio to 1.0 on mobile to avoid rendering at 3x retina resolution
    br3D.renderer.setPixelRatio(isMobileDev ? 1.0 : Math.min(window.devicePixelRatio || 1, 1.5));
    
    // Dynamic shadows enabled only on Desktop for solid 60 FPS on mobile
    br3D.renderer.shadowMap.enabled = !isMobileDev;
    if (!isMobileDev) {
        br3D.renderer.shadowMap.type = THREE.PCFShadowMap;
    }
    br3D.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    br3D.renderer.toneMappingExposure = 1.1;

    // Scene
    br3D.scene = new THREE.Scene();
    br3D.scene.background = new THREE.Color(0x0c0e14);
    br3D.scene.fog = new THREE.FogExp2(0x0c0e14, 0.0035);

    // Camera
    br3D.camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    br3D.camera.position.set(0, 30, 25);
    br3D.cameraTarget = new THREE.Vector3(0, 0, 0);

    // Clock
    br3D.clock = new THREE.Clock();

    // Lighting
    setup3DLights();

    // Resize listener
    window.addEventListener('resize', on3DResize);
}

function setup3DLights() {
    const isMobileDev = br3D.isMobile;

    // Ambient / Hemisphere light
    const hemiLight = new THREE.HemisphereLight(0x557799, 0x182030, isMobileDev ? 1.1 : 0.7);
    hemiLight.position.set(0, 50, 0);
    br3D.scene.add(hemiLight);

    // Main Directional Sun Light
    const sunLight = new THREE.DirectionalLight(0xfffaed, isMobileDev ? 1.0 : 1.2);
    sunLight.position.set(60, 100, 40);
    if (!isMobileDev) {
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 1024;
        sunLight.shadow.mapSize.height = 1024;
        sunLight.shadow.camera.near = 10;
        sunLight.shadow.camera.far = 300;
        const d = 160;
        sunLight.shadow.camera.left = -d;
        sunLight.shadow.camera.right = d;
        sunLight.shadow.camera.top = d;
        sunLight.shadow.camera.bottom = -d;
        sunLight.shadow.bias = -0.0005;
    }
    br3D.scene.add(sunLight);

    // Subtle blue fill light
    const fillLight = new THREE.DirectionalLight(0x32ade6, 0.4);
    fillLight.position.set(-60, 40, -40);
    br3D.scene.add(fillLight);
}

function on3DResize() {
    const container = document.getElementById('br-container');
    if (!container || !br3D.renderer || !br3D.camera) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    br3D.renderer.setSize(w, h);
    br3D.camera.aspect = w / h;
    br3D.camera.updateProjectionMatrix();
}

// -----------------------------------------------------------------------------
// PROCEDURAL 3D PROCEDURAL MAP GENERATION
// -----------------------------------------------------------------------------
function generate3DMap(mode) {
    if (br3D.mapGroup) {
        br3D.scene.remove(br3D.mapGroup);
    }
    br3D.mapGroup = new THREE.Group();
    br3D.scene.add(br3D.mapGroup);

    br3D.walls = [];
    br3D.wallMeshes = [];
    br3D.smokeZones = [];
    br3D.smokeMeshes = [];

    const is5v5 = (mode === 'tdm_5v5');
    const mapSize = is5v5 ? 350 : 120; // 350m for 5v5, 120m for Duel
    br3D.mapSize = mapSize;
    const half = mapSize / 2;

    // Floor Texture & Mesh
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const fctx = floorCanvas.getContext('2d');
    fctx.fillStyle = '#141820';
    fctx.fillRect(0, 0, 512, 512);
    fctx.strokeStyle = '#1e2430';
    fctx.lineWidth = 4;
    const gridStep = 64;
    for (let x = 0; x <= 512; x += gridStep) {
        fctx.beginPath(); fctx.moveTo(x, 0); fctx.lineTo(x, 512); fctx.stroke();
    }
    for (let y = 0; y <= 512; y += gridStep) {
        fctx.beginPath(); fctx.moveTo(0, y); fctx.lineTo(512, y); fctx.stroke();
    }
    const floorTex = new THREE.CanvasTexture(floorCanvas);
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(mapSize / 8, mapSize / 8);

    const floorGeo = new THREE.PlaneGeometry(mapSize, mapSize);
    const floorMat = new THREE.MeshStandardMaterial({
        map: floorTex,
        roughness: 0.8,
        metalness: 0.2
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    br3D.mapGroup.add(floorMesh);

    // Outer Boundary Perimeter Walls (Height = 8m)
    const wallH = 8;
    const boundThick = 4;
    const wallMat = getSharedWallMaterial();

    const bounds = [
        { x: 0, z: -half - boundThick/2, w: mapSize + boundThick*2, d: boundThick },
        { x: 0, z: half + boundThick/2, w: mapSize + boundThick*2, d: boundThick },
        { x: -half - boundThick/2, z: 0, w: boundThick, d: mapSize + boundThick*2 },
        { x: half + boundThick/2, z: 0, w: boundThick, d: mapSize + boundThick*2 }
    ];
    bounds.forEach(b => {
        const geo = new THREE.BoxGeometry(b.w, wallH, b.d);
        const mesh = new THREE.Mesh(geo, wallMat);
        mesh.position.set(b.x, wallH / 2, b.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        br3D.mapGroup.add(mesh);
        br3D.walls.push({
            minX: b.x - b.w / 2, maxX: b.x + b.w / 2,
            minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2
        });
    });

    // Spawn Base Zones
    setup3DSpawnBases(mode, mapSize);

    // Central Divider Wall with Passages
    const passagesCount = is5v5 ? 8 : 3;
    const gap = 14; // 14m passage
    const dividerThick = 6; // 6m thick
    const passageZPositions = [];
    for (let i = 1; i <= passagesCount; i++) {
        const ratio = i / (passagesCount + 1);
        const offset = -4 + Math.random() * 8;
        passageZPositions.push(-half + mapSize * ratio + offset);
    }
    passageZPositions.sort((a, b) => a - b);
    br3D.passageZPositions = passageZPositions;

    let zStart = -half + 10;
    for (let i = 0; i < passageZPositions.length; i++) {
        let zEnd = passageZPositions[i] - gap / 2;
        if (zEnd > zStart + 4) {
            add3DWallBlock(0, (zStart + zEnd) / 2, dividerThick, zEnd - zStart, 4.5);
        }
        zStart = passageZPositions[i] + gap / 2;
    }
    if (half - 10 > zStart + 4) {
        add3DWallBlock(0, (zStart + (half - 10)) / 2, dividerThick, (half - 10) - zStart, 4.5);
    }

    // Procedural Concrete Cover Blocks (25 blocks)
    const totalBlocks = is5v5 ? 25 : 10;
    let attempts = 0;
    while (br3D.wallMeshes.length < totalBlocks && attempts < 300) {
        attempts++;
        const bw = 6 + Math.floor(Math.random() * 10);
        const bd = 6 + Math.floor(Math.random() * 10);
        const bx = -half + 15 + Math.random() * (mapSize - 30 - bw);
        const bz = -half + 15 + Math.random() * (mapSize - 30 - bd);

        // Don't spawn close to center
        if (Math.hypot(bx, bz) < 25) continue;

        // Base checks
        if (br3D.baseRects.ct && rectOverlap3D(bx, bz, bw, bd, br3D.baseRects.ct, 6)) continue;
        if (br3D.baseRects.t && rectOverlap3D(bx, bz, bw, bd, br3D.baseRects.t, 6)) continue;

        // Clear zone around central line
        if (Math.abs(bx) < 14) {
            let inGap = false;
            for (let pz of passageZPositions) {
                if (Math.abs(bz - pz) < gap / 2 + 3) inGap = true;
            }
            if (inGap) continue;
        }

        // Overlap with existing walls
        let overlaps = false;
        for (let w of br3D.walls) {
            if (bx - bw/2 < w.maxX + 4 && bx + bw/2 > w.minX - 4 &&
                bz - bd/2 < w.maxZ + 4 && bz + bd/2 > w.minZ - 4) {
                overlaps = true;
                break;
            }
        }
        if (overlaps) continue;

        add3DWallBlock(bx, bz, bw, bd, 3.5);
    }

    // Spawn 3D Smoke Zones
    generate3DSmokeZones(mode);
}

let _sharedWallMaterial = null;

function getSharedWallMaterial() {
    if (_sharedWallMaterial) return _sharedWallMaterial;

    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#262a36';
    ctx.fillRect(0, 0, 128, 128);
    // Concrete noise
    for (let i = 0; i < 200; i++) {
        ctx.fillStyle = (Math.random() > 0.5) ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
        ctx.fillRect(Math.random() * 128, Math.random() * 128, 2 + Math.random()*3, 2 + Math.random()*3);
    }
    // Hazard stripe border on top
    ctx.fillStyle = '#32ade6';
    ctx.fillRect(0, 0, 128, 6);

    const tex = new THREE.CanvasTexture(canvas);
    _sharedWallMaterial = new THREE.MeshLambertMaterial({
        map: tex
    });
    return _sharedWallMaterial;
}
const createConcreteWallMaterial = getSharedWallMaterial;

function add3DWallBlock(x, z, w, d, h) {
    const wallMat = getSharedWallMaterial();
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, wallMat);
    mesh.position.set(x, h / 2, z);
    if (!br3D.isMobile) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
    }
    br3D.mapGroup.add(mesh);
    br3D.wallMeshes.push(mesh);

    br3D.walls.push({
        minX: x - w / 2, maxX: x + w / 2,
        minZ: z - d / 2, maxZ: z + d / 2,
        x: x, z: z, w: w, d: d, h: h
    });
}

function rectOverlap3D(x, z, w, d, base, pad = 0) {
    const minX = x - w/2, maxX = x + w/2;
    const minZ = z - d/2, maxZ = z + d/2;
    return (minX < base.maxX + pad && maxX > base.minX - pad &&
            minZ < base.maxZ + pad && maxZ > base.minZ - pad);
}

function setup3DSpawnBases(mode, mapSize) {
    const half = mapSize / 2;
    const baseW = (mode === 'tdm_5v5') ? 45 : 25;
    const baseD = (mode === 'tdm_5v5') ? 45 : 25;

    // CT Base (Left / Blue)
    const ctX = -half + baseW / 2 + 10;
    const ctZ = 0;
    br3D.baseRects.ct = {
        minX: ctX - baseW / 2, maxX: ctX + baseW / 2,
        minZ: ctZ - baseD / 2, maxZ: ctZ + baseD / 2,
        x: ctX, z: ctZ
    };

    // T Base (Right / Orange)
    const tX = half - baseW / 2 - 10;
    const tZ = 0;
    br3D.baseRects.t = {
        minX: tX - baseW / 2, maxX: tX + baseW / 2,
        minZ: tZ - baseD / 2, maxZ: tZ + baseD / 2,
        x: tX, z: tZ
    };

    // Base Zone Glowing Markers on floor
    create3DBasePad(ctX, ctZ, baseW, 0x32ade6, 'CT BASE');
    create3DBasePad(tX, tZ, baseW, 0xff9f0a, 'T BASE');
}

function create3DBasePad(x, z, size, colorHex, label) {
    // Ring Mesh
    const ringGeo = new THREE.RingGeometry(size * 0.35, size * 0.48, 32);
    const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(x, 0.05, z);
    br3D.mapGroup.add(ringMesh);

    // Glowing Center Symbol
    const centerGeo = new THREE.CircleGeometry(size * 0.25, 24);
    const centerMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.25
    });
    const centerMesh = new THREE.Mesh(centerGeo, centerMat);
    centerMesh.rotation.x = -Math.PI / 2;
    centerMesh.position.set(x, 0.04, z);
    br3D.mapGroup.add(centerMesh);
}

function generate3DSmokeZones(mode) {
    const is5v5 = (mode === 'tdm_5v5');
    const smokeCount = is5v5 ? 4 : 2;
    const radius = 16;

    for (let i = 0; i < smokeCount; i++) {
        const angle = (i / smokeCount) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 35 + Math.random() * 40;
        const sx = Math.cos(angle) * dist;
        const sz = Math.sin(angle) * dist;

        const smokeGeo = new THREE.SphereGeometry(radius, 16, 12);
        const smokeMat = new THREE.MeshStandardMaterial({
            color: 0x8899aa,
            transparent: true,
            opacity: 0.45,
            roughness: 1.0
        });
        const smokeMesh = new THREE.Mesh(smokeGeo, smokeMat);
        smokeMesh.position.set(sx, radius * 0.6, sz);
        br3D.mapGroup.add(smokeMesh);
        br3D.smokeMeshes.push(smokeMesh);

        br3D.smokeZones.push({ x: sx, z: sz, r: radius });
    }
}

// -----------------------------------------------------------------------------
// 3D CHARACTER MODEL BUILDER (OPTIMIZED WITH SHARED GEOMETRIES & MATERIALS)
// -----------------------------------------------------------------------------
let _charRes = null;

function getSharedCharResources() {
    if (_charRes) return _charRes;

    const isMob = br3D.isMobile;
    const MatClass = isMob ? THREE.MeshLambertMaterial : THREE.MeshStandardMaterial;

    _charRes = {
        // Geometries
        hipsGeo: new THREE.BoxGeometry(0.7, 0.3, 0.45),
        torsoGeo: new THREE.BoxGeometry(0.85, 0.65, 0.55),
        headGeo: new THREE.BoxGeometry(0.42, 0.45, 0.42),
        helmetGeo: new THREE.BoxGeometry(0.48, 0.28, 0.48),
        visorGeo: new THREE.BoxGeometry(0.38, 0.12, 0.1),
        bandGeo: new THREE.BoxGeometry(0.46, 0.12, 0.46),
        maskGeo: new THREE.BoxGeometry(0.44, 0.2, 0.2),
        armGeo: new THREE.BoxGeometry(0.24, 0.6, 0.24),
        legGeo: new THREE.BoxGeometry(0.28, 0.75, 0.28),
        shieldGeo: new THREE.SphereGeometry(1.4, 16, 12),
        indicatorGeo: new THREE.RingGeometry(0.8, 0.95, 16),

        // Weapon Geometries
        gunBodyGeo: new THREE.BoxGeometry(0.1, 0.14, 0.6),
        gunBarrelGeo: new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6),
        gunMagGeo: new THREE.BoxGeometry(0.08, 0.22, 0.14),
        gunStockGeo: new THREE.BoxGeometry(0.08, 0.16, 0.3),

        // Shared Materials
        bodyMatCT: new MatClass({ color: 0x1c3a63 }),
        bodyMatT: new MatClass({ color: 0x7c471b }),
        vestMatCT: new MatClass({ color: 0x0f223d }),
        vestMatT: new MatClass({ color: 0xb86c28 }),
        skinMat: new MatClass({ color: 0xdeb887 }),
        gearMat: new MatClass({ color: 0x11141a }),
        visorMatCT: new MatClass({ color: 0x32ade6, emissive: 0x32ade6, emissiveIntensity: 0.5 }),
        visorMatT: new MatClass({ color: 0xff9f0a, emissive: 0xff9f0a, emissiveIntensity: 0.5 }),

        shieldMatCT: new THREE.MeshBasicMaterial({ color: 0x32ade6, transparent: true, opacity: 0.35, wireframe: true }),
        shieldMatT: new THREE.MeshBasicMaterial({ color: 0xff9f0a, transparent: true, opacity: 0.35, wireframe: true }),
        indMatCT: new THREE.MeshBasicMaterial({ color: 0x32ade6, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }),
        indMatT: new THREE.MeshBasicMaterial({ color: 0xff9f0a, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }),

        gunMat: new MatClass({ color: 0x111317 }),
        woodMat: new MatClass({ color: 0x5a2d12 })
    };
    return _charRes;
}

function create3DCharacterModel(team) {
    const group = new THREE.Group();
    const isCT = (team === 'Counter-Terrorists' || team === 'CT');
    const res = getSharedCharResources();
    const castShadow = !br3D.isMobile;

    const bodyMat = isCT ? res.bodyMatCT : res.bodyMatT;
    const vestMat = isCT ? res.vestMatCT : res.vestMatT;
    const visorMat = isCT ? res.visorMatCT : res.visorMatT;

    // 1. Pelvis / Hips (Y = 0.9m)
    const hipsMesh = new THREE.Mesh(res.hipsGeo, bodyMat);
    hipsMesh.position.y = 0.9;
    hipsMesh.castShadow = castShadow;
    group.add(hipsMesh);

    // 2. Torso / Tactical Vest (Y = 1.35m)
    const torsoMesh = new THREE.Mesh(res.torsoGeo, vestMat);
    torsoMesh.position.y = 1.35;
    torsoMesh.castShadow = castShadow;
    group.add(torsoMesh);

    // 3. Head & Helmet (Y = 1.85m)
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.85;

    const headMesh = new THREE.Mesh(res.headGeo, res.skinMat);
    headGroup.add(headMesh);

    if (isCT) {
        const helmetMesh = new THREE.Mesh(res.helmetGeo, vestMat);
        helmetMesh.position.y = 0.12;
        headGroup.add(helmetMesh);

        const visorMesh = new THREE.Mesh(res.visorGeo, visorMat);
        visorMesh.position.set(0, 0.02, 0.22);
        headGroup.add(visorMesh);
    } else {
        const bandMesh = new THREE.Mesh(res.bandGeo, visorMat);
        bandMesh.position.y = 0.08;
        headGroup.add(bandMesh);

        const maskMesh = new THREE.Mesh(res.maskGeo, res.gearMat);
        maskMesh.position.set(0, -0.1, 0.15);
        headGroup.add(maskMesh);
    }
    group.add(headGroup);
    group.headNode = headGroup;

    // 4. Arms & Weapon
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.52, 1.45, 0);
    const leftArm = new THREE.Mesh(res.armGeo, bodyMat);
    leftArm.position.y = -0.25;
    leftArmGroup.add(leftArm);
    group.add(leftArmGroup);
    group.leftArmNode = leftArmGroup;

    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.52, 1.45, 0);
    const rightArm = new THREE.Mesh(res.armGeo, bodyMat);
    rightArm.position.y = -0.25;
    rightArmGroup.add(rightArm);
    group.add(rightArmGroup);
    group.rightArmNode = rightArmGroup;

    // Weapon Mesh attached to Right Arm
    const weaponGroup = create3DWeaponMesh(isCT, res);
    weaponGroup.position.set(0, -0.4, 0.4);
    weaponGroup.rotation.x = Math.PI / 12;
    rightArmGroup.add(weaponGroup);
    group.weaponNode = weaponGroup;

    // 5. Legs
    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(-0.22, 0.75, 0);
    const leftLeg = new THREE.Mesh(res.legGeo, bodyMat);
    leftLeg.position.y = -0.35;
    leftLeg.castShadow = castShadow;
    leftLegGroup.add(leftLeg);
    group.add(leftLegGroup);
    group.leftLegNode = leftLegGroup;

    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(0.22, 0.75, 0);
    const rightLeg = new THREE.Mesh(res.legGeo, bodyMat);
    rightLeg.position.y = -0.35;
    rightLeg.castShadow = castShadow;
    rightLegGroup.add(rightLeg);
    group.add(rightLegGroup);
    group.rightLegNode = rightLegGroup;

    // 6. Invulnerability Energy Shield
    const shieldMat = isCT ? res.shieldMatCT : res.shieldMatT;
    const shieldMesh = new THREE.Mesh(res.shieldGeo, shieldMat);
    shieldMesh.position.y = 1.1;
    shieldMesh.visible = false;
    group.add(shieldMesh);
    group.shieldNode = shieldMesh;

    // 7. Team Indicator Ring on Ground
    const indMat = isCT ? res.indMatCT : res.indMatT;
    const indicatorMesh = new THREE.Mesh(res.indicatorGeo, indMat);
    indicatorMesh.rotation.x = -Math.PI / 2;
    indicatorMesh.position.y = 0.05;
    group.add(indicatorMesh);
    group.indicatorNode = indicatorMesh;

    group.team = team;
    return group;
}

function create3DWeaponMesh(isCT, res) {
    if (!res) res = getSharedCharResources();
    const weapon = new THREE.Group();
    const gunMat = res.gunMat;
    const woodMat = res.woodMat;

    // Main Body / Receiver
    const bodyMesh = new THREE.Mesh(res.gunBodyGeo, gunMat);
    weapon.add(bodyMesh);

    // Barrel
    const barrelMesh = new THREE.Mesh(res.gunBarrelGeo, gunMat);
    barrelMesh.rotation.x = Math.PI / 2;
    barrelMesh.position.set(0, 0.02, 0.45);
    weapon.add(barrelMesh);

    // Magazine
    const magMesh = new THREE.Mesh(res.gunMagGeo, isCT ? gunMat : woodMat);
    magMesh.position.set(0, -0.12, 0.1);
    magMesh.rotation.x = -0.2;
    weapon.add(magMesh);

    // Stock
    const stockMesh = new THREE.Mesh(res.gunStockGeo, isCT ? gunMat : woodMat);
    stockMesh.position.set(0, -0.02, -0.35);
    weapon.add(stockMesh);

    // Muzzle Anchor Point for Tracers
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.02, 0.7);
    weapon.add(muzzle);
    weapon.muzzlePoint = muzzle;

    return weapon;
}

// -----------------------------------------------------------------------------
// 3D CONTROLS & INPUT SYSTEM (STANDOFF 2 / CS STYLE POINTER LOCK & SENSITIVITY)
// -----------------------------------------------------------------------------
function bind3DControls() {
    // Keyboard
    window.addEventListener('keydown', e => {
        br3D.keys[e.code] = true;
        if (e.code === 'KeyR') reload3DWeapon();
        if (e.code === 'Space') jumpOrDash3D();
        if (e.code === 'KeyC') reset3DCameraBehind();
        if (e.code === 'KeyV') toggle3DCameraMode();
        if (e.code === 'BracketLeft') zoom3DCamera(-2);
        if (e.code === 'BracketRight') zoom3DCamera(2);
        if (e.code === 'Escape' || e.code === 'KeyP') {
            if (document.exitPointerLock) document.exitPointerLock();
            if (typeof togglePause === 'function') togglePause(true);
        }
    });

    window.addEventListener('keyup', e => {
        br3D.keys[e.code] = false;
    });

    // Mouse Controls on Canvas (Pointer Lock & Sensitivity)
    const canvas = br3D.canvas;
    if (!canvas) return;

    // Prevent context menu on right-click
    canvas.addEventListener('contextmenu', e => {
        e.preventDefault();
        return false;
    });

    // Request Pointer Lock on click so cursor disappears like in Standoff 2
    canvas.addEventListener('click', () => {
        if (!document.pointerLockElement && br3D.active) {
            canvas.requestPointerLock().catch(() => {});
        }
    });

    document.addEventListener('pointerlockchange', () => {
        br3D.isPointerLocked = (document.pointerLockElement === canvas);
    });

    canvas.addEventListener('mousedown', e => {
        if (e.button === 0) { // Left Click: Fire weapon & lock pointer
            if (!document.pointerLockElement && br3D.active) {
                canvas.requestPointerLock().catch(() => {});
            }
            br3D.mouse.isDown = true;
            isShooting = true;
            tryFire3DWeapon();
        } else if (e.button === 2) { // Right Click
            br3D.mouse.rightDown = true;
        }
    });

    window.addEventListener('mousemove', e => {
        if (!canvas || !br3D.active) return;

        // Pointer Lock Active (Standoff 2 / CS Style Mouse Aiming)
        if (document.pointerLockElement === canvas) {
            const rawSens = (window.gameSensitivity || parseFloat(localStorage.getItem('game_sensitivity')) || 5.0);
            // Calibrated mouse sensitivity for 60-144hz displays
            const mouseSens = rawSens * 0.00045;

            const mX = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
            const mY = e.movementY || e.mozMovementY || e.webkitMovementY || 0;

            br3D.cameraCtrl.yaw -= mX * mouseSens;
            br3D.cameraCtrl.targetYaw = br3D.cameraCtrl.yaw;

            // Pitch clamping: allows looking slightly up and down
            br3D.cameraCtrl.pitch = Math.max(0.08, Math.min(1.35, br3D.cameraCtrl.pitch + mY * mouseSens));
            br3D.cameraCtrl.targetPitch = br3D.cameraCtrl.pitch;

            // Character always faces look direction
            if (br3D.myP && br3D.myP.alive) {
                br3D.myP.rotY = br3D.cameraCtrl.yaw;
            }
        } else {
            // Unlocked mouse fallback
            const rect = canvas.getBoundingClientRect();
            br3D.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            br3D.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        }
    });

    window.addEventListener('mouseup', e => {
        if (e.button === 0) {
            br3D.mouse.isDown = false;
            isShooting = false;
        }
        if (e.button === 2) br3D.mouse.rightDown = false;
    });

    // Mouse Wheel Zoom
    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        const delta = Math.sign(e.deltaY) * 2;
        zoom3DCamera(delta);
    }, { passive: false });

    // Mobile Virtual Joystick & Touch Controls
    bind3DMobileControls();
}

function bind3DMobileControls() {
    const joystick = document.getElementById('br-joystick');
    const stick = document.getElementById('br-stick');
    const shootBtn = document.getElementById('br-shoot-btn');
    const canvas = br3D.canvas;

    if (!joystick || !stick) return;

    // Movement Joystick (Left Side)
    joystick.addEventListener('touchstart', e => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        br3D.touch.joystickActive = true;
        br3D.touch.joystickId = touch.identifier;
        const rect = joystick.getBoundingClientRect();
        br3D.touch.startX = rect.left + rect.width / 2;
        br3D.touch.startY = rect.top + rect.height / 2;
        updateJoystickPos(touch.clientX, touch.clientY);
    }, { passive: false });

    window.addEventListener('touchmove', e => {
        if (br3D.touch.joystickActive) {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if (t.identifier === br3D.touch.joystickId) {
                    updateJoystickPos(t.clientX, t.clientY);
                    break;
                }
            }
        }

        // Camera Touch Drag (Non-joystick touch)
        if (br3D.touch.camActive) {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if (t.identifier === br3D.touch.camId) {
                    const dx = t.clientX - br3D.touch.camLastX;
                    const dy = t.clientY - br3D.touch.camLastY;
                    br3D.touch.camLastX = t.clientX;
                    br3D.touch.camLastY = t.clientY;
                    rotate3DCamera(-dx * 0.008, dy * 0.007);
                    break;
                }
            }
        }

        // Two-Finger Pinch Zoom
        if (e.touches.length >= 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            if (br3D.touch.pinchDist > 0) {
                const pinchDiff = br3D.touch.pinchDist - dist;
                zoom3DCamera(pinchDiff * 0.15);
            }
            br3D.touch.pinchDist = dist;
        }
    }, { passive: false });

    const endTouchHandler = e => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (t.identifier === br3D.touch.joystickId) {
                br3D.touch.joystickActive = false;
                br3D.touch.dx = 0;
                br3D.touch.dy = 0;
                stick.style.transform = `translate(0px, 0px)`;
            }
            if (t.identifier === br3D.touch.camId) {
                br3D.touch.camActive = false;
                br3D.touch.camId = null;
            }
        }
        if (e.touches.length < 2) {
            br3D.touch.pinchDist = 0;
        }
    };
    window.addEventListener('touchend', endTouchHandler);
    window.addEventListener('touchcancel', endTouchHandler);

    function updateJoystickPos(cx, cy) {
        let dx = cx - br3D.touch.startX;
        let dy = cy - br3D.touch.startY;
        const maxDist = 45;
        const dist = Math.hypot(dx, dy);
        if (dist > maxDist) {
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
        }
        stick.style.transform = `translate(${dx}px, ${dy}px)`;
        br3D.touch.dx = dx / maxDist;
        br3D.touch.dy = dy / maxDist;
    }

    // Touch on Canvas (Right/Center Screen) to Drag Camera
    if (canvas) {
        canvas.addEventListener('touchstart', e => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if (t.clientX > window.innerWidth * 0.35 && !br3D.touch.camActive) {
                    br3D.touch.camActive = true;
                    br3D.touch.camId = t.identifier;
                    br3D.touch.camLastX = t.clientX;
                    br3D.touch.camLastY = t.clientY;
                }
            }
        }, { passive: true });
    }

    // Shoot Button
    if (shootBtn) {
        shootBtn.addEventListener('touchstart', e => {
            e.preventDefault();
            br3D.mouse.isDown = true;
            isShooting = true;
        }, { passive: false });

        shootBtn.addEventListener('touchend', e => {
            e.preventDefault();
            br3D.mouse.isDown = false;
            isShooting = false;
        }, { passive: false });
    }
}

// -----------------------------------------------------------------------------
// CAMERA MOVEMENT & HELPER FUNCTIONS
// -----------------------------------------------------------------------------
function zoom3DCamera(delta) {
    const ctrl = br3D.cameraCtrl;
    ctrl.targetDistance = Math.max(ctrl.minDistance, Math.min(ctrl.maxDistance, ctrl.targetDistance + delta));
}

function rotate3DCamera(yawDelta, pitchDelta) {
    const ctrl = br3D.cameraCtrl;
    ctrl.targetYaw += yawDelta;
    ctrl.targetPitch = Math.max(ctrl.minPitch, Math.min(ctrl.maxPitch, ctrl.targetPitch + pitchDelta));
}

function reset3DCameraBehind() {
    const ctrl = br3D.cameraCtrl;
    if (br3D.myP) {
        ctrl.targetYaw = br3D.myP.rotY + Math.PI;
    } else {
        ctrl.targetYaw = 0;
    }
    ctrl.targetPitch = 0.85;
    ctrl.targetDistance = 22;
    ctrl.targetPanOffset = { x: 0, z: 0 };
    ctrl.mode = 'tactical';
    updateCameraModeUI();
}

function toggle3DCameraMode() {
    const ctrl = br3D.cameraCtrl;
    if (ctrl.mode === 'tactical') {
        ctrl.mode = 'topdown';
        ctrl.targetPitch = 1.42;
        ctrl.targetDistance = 38;
    } else if (ctrl.mode === 'topdown') {
        ctrl.mode = 'close';
        ctrl.targetPitch = 0.45;
        ctrl.targetDistance = 8;
        if (br3D.myP) ctrl.targetYaw = br3D.myP.rotY + Math.PI;
    } else {
        ctrl.mode = 'tactical';
        ctrl.targetPitch = 0.85;
        ctrl.targetDistance = 22;
    }
    updateCameraModeUI();
}

function updateCameraModeUI() {
    const icon = document.getElementById('cam-mode-icon');
    if (!icon) return;
    if (br3D.cameraCtrl.mode === 'topdown') icon.innerText = '🗺️';
    else if (br3D.cameraCtrl.mode === 'close') icon.innerText = '🔍';
    else icon.innerText = '👁️';
}

window.zoom3DCamera = zoom3DCamera;
window.rotate3DCamera = rotate3DCamera;
window.reset3DCameraBehind = reset3DCameraBehind;
window.toggle3DCameraMode = toggle3DCameraMode;

function reload3DWeapon() {
    if (br3D.isReloading || br3D.ammo === br3D.maxAmmo) return;
    br3D.isReloading = true;
    play3DSound('ricochet');
    setTimeout(() => {
        br3D.ammo = br3D.maxAmmo;
        br3D.isReloading = false;
        update3DHUD();
    }, 1200);
}

function jumpOrDash3D() {
    if (!br3D.myP || !br3D.myP.alive) return;
    // Add small tactical burst impulse
    if (br3D.myP.y === 0) {
        br3D.myP.vy = 6;
    }
}

// -----------------------------------------------------------------------------
// 3D BALLISTICS, TRACERS & PARTICLE EFFECTS
// -----------------------------------------------------------------------------
function fire3DBullet(fromPos, dir, shooterId, team) {
    play3DSound('gunshot');

    // Create glowing 3D tracer rod
    const tracerGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.0, 6);
    const tracerMat = new THREE.MeshBasicMaterial({
        color: (team === 'Counter-Terrorists' || team === 'CT') ? 0x00f0ff : 0xffaa00
    });
    const tracer = new THREE.Mesh(tracerGeo, tracerMat);
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
        life: 0.8 // Max lifetime seconds
    });

    // Muzzle Flash Light & Spark
    create3DMuzzleFlash(fromPos);
}

function create3DMuzzleFlash(pos) {
    const flashLight = new THREE.PointLight(0xffaa22, 3, 10);
    flashLight.position.copy(pos);
    br3D.scene.add(flashLight);
    setTimeout(() => {
        br3D.scene.remove(flashLight);
    }, 40);
}

function create3DHitSparks(pos, isBlood) {
    play3DSound(isBlood ? 'hit' : 'ricochet');
    const color = isBlood ? 0xcc1111 : 0xffcc33;
    const count = isBlood ? 8 : 5;

    for (let i = 0; i < count; i++) {
        const pGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
        const pMat = new THREE.MeshBasicMaterial({ color: color });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        pMesh.position.copy(pos);

        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 8,
            Math.random() * 6 + 1,
            (Math.random() - 0.5) * 8
        );
        br3D.scene.add(pMesh);
        br3D.particleSystems.push({
            mesh: pMesh,
            vel: velocity,
            life: 0.4
        });
    }

    if (isBlood) {
        add3DBloodDecal(pos.x, pos.z);
    }
}

function add3DBloodDecal(x, z) {
    const decalGeo = new THREE.CircleGeometry(0.6 + Math.random() * 0.5, 12);
    const decalMat = new THREE.MeshBasicMaterial({
        color: 0x660000,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide
    });
    const decal = new THREE.Mesh(decalGeo, decalMat);
    decal.rotation.x = -Math.PI / 2;
    decal.position.set(x, 0.02, z);
    br3D.scene.add(decal);
    br3D.bloodDecals.push(decal);

    // Limit decals to 30
    if (br3D.bloodDecals.length > 30) {
        const old = br3D.bloodDecals.shift();
        br3D.scene.remove(old);
    }
}

function spawn3DFloatingDamage(pos, damage, isCrit = false) {
    const screenPos = pos.clone().project(br3D.camera);
    const container = document.getElementById('br-container');
    if (!container) return;

    const x = (screenPos.x * 0.5 + 0.5) * container.clientWidth;
    const y = (-(screenPos.y * 0.5) + 0.5) * container.clientHeight;

    const el = document.createElement('div');
    el.className = `damage-number-float ${isCrit ? 'crit' : ''}`;
    el.innerText = `-${damage}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    container.appendChild(el);

    setTimeout(() => {
        el.remove();
    }, 800);
}

// -----------------------------------------------------------------------------
// 3D COLLISION & PHYSICS
// -----------------------------------------------------------------------------
function checkPlayerWallCollision3D(px, pz, radius = 0.8) {
    for (let w of br3D.walls) {
        if (px + radius > w.minX && px - radius < w.maxX &&
            pz + radius > w.minZ && pz - radius < w.maxZ) {
            return true;
        }
    }
    return false;
}

function checkBulletWallCollision3D(bx, bz) {
    for (let w of br3D.walls) {
        if (bx >= w.minX && bx <= w.maxX && bz >= w.minZ && bz <= w.maxZ) {
            return true;
        }
    }
    return false;
}

// Line of Sight (LOS) Raycast through 3D walls & smoke
function checkLineOfSight3D(x1, z1, x2, z2) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const dist = Math.hypot(dx, dz);
    if (dist === 0) return true;

    const steps = Math.ceil(dist / 1.5);
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const curX = x1 + dx * t;
        const curZ = z1 + dz * t;

        // Check walls
        for (let w of br3D.walls) {
            if (curX >= w.minX && curX <= w.maxX && curZ >= w.minZ && curZ <= w.maxZ) {
                return false; // View blocked by wall
            }
        }

        // Check smoke zones
        for (let s of br3D.smokeZones) {
            if (Math.hypot(curX - s.x, curZ - s.z) < s.r * 0.85) {
                return false; // View blocked by smoke
            }
        }
    }
    return true;
}

// -----------------------------------------------------------------------------
// 3D BOT AI SYSTEM (3 LEVELS OF TACTICAL BEHAVIOR)
// -----------------------------------------------------------------------------
function init3DBots(mode) {
    br3D.bots = [];
    const is5v5 = (mode === 'tdm_5v5');
    const totalSlots = is5v5 ? 10 : (mode === 'duel_2v2' ? 4 : 2);

    // Count players already in CT and T
    let ctCount = 0, tCount = 0;
    if (br3D.myP) {
        if (br3D.myP.team === 'Counter-Terrorists') ctCount++;
        else tCount++;
    }

    const neededBots = totalSlots - (ctCount + tCount);
    let botIndex = 1;

    for (let i = 0; i < neededBots; i++) {
        const team = (ctCount <= tCount) ? 'Counter-Terrorists' : 'Terrorists';
        if (team === 'Counter-Terrorists') ctCount++; else tCount++;

        const spawn = get3DSpawnPos(team, mode);
        const aiLevel = (i % 3 === 0) ? 3 : ((i % 2 === 0) ? 2 : 1);

        const bot = {
            id: `bot_${botIndex}`,
            label: `Бот ${botIndex}`,
            team: team,
            x: spawn.x + (Math.random() - 0.5) * 6,
            y: 0,
            z: spawn.z + (Math.random() - 0.5) * 6,
            vx: 0, vz: 0,
            rotY: (team === 'Counter-Terrorists') ? Math.PI / 2 : -Math.PI / 2,
            hp: 100,
            maxHp: 100,
            alive: true,
            kills: 0,
            aiLevel: aiLevel,
            speed: (aiLevel === 3) ? 14 : ((aiLevel === 2) ? 11 : 8),
            lastShotTime: 0,
            shootInterval: (aiLevel === 3) ? 0.15 : ((aiLevel === 2) ? 0.3 : 0.6),
            targetId: null,
            patrolTarget: null,
            invulnUntil: Date.now() + 3000,
            respawnTime: 0
        };

        br3D.bots.push(bot);
        botIndex++;
    }
}

function getBestPassageZ(fromZ, toZ) {
    if (!br3D.passageZPositions || br3D.passageZPositions.length === 0) return 0;
    let bestZ = br3D.passageZPositions[0];
    let bestDist = Infinity;
    for (let pz of br3D.passageZPositions) {
        const d = Math.abs(fromZ - pz) * 1.2 + Math.abs(toZ - pz);
        if (d < bestDist) {
            bestDist = d;
            bestZ = pz;
        }
    }
    return bestZ;
}

function findClearBotAngle(bot, baseAngle, checkDist = 2.4) {
    const testX = bot.x + Math.sin(baseAngle) * checkDist;
    const testZ = bot.z + Math.cos(baseAngle) * checkDist;
    if (!checkPlayerWallCollision3D(testX, testZ, 0.85)) {
        return baseAngle;
    }

    const offsets = [
        Math.PI * 0.2, -Math.PI * 0.2,
        Math.PI * 0.4, -Math.PI * 0.4,
        Math.PI * 0.6, -Math.PI * 0.6,
        Math.PI * 0.8, -Math.PI * 0.8,
        Math.PI
    ];

    for (let offset of offsets) {
        const candAngle = baseAngle + offset;
        const cx = bot.x + Math.sin(candAngle) * checkDist;
        const cz = bot.z + Math.cos(candAngle) * checkDist;
        if (!checkPlayerWallCollision3D(cx, cz, 0.85)) {
            return candAngle;
        }
    }

    for (let offset of offsets) {
        const candAngle = baseAngle + offset;
        const cx = bot.x + Math.sin(candAngle) * 1.2;
        const cz = bot.z + Math.cos(candAngle) * 1.2;
        if (!checkPlayerWallCollision3D(cx, cz, 0.8)) {
            return candAngle;
        }
    }

    return baseAngle;
}

function update3DBots(dt) {
    const now = Date.now();

    br3D.bots.forEach(bot => {
        if (!bot.alive) {
            // Check respawn in TDM
            if (br3D.mode === 'tdm_5v5' && bot.respawnTime > 0 && now >= bot.respawnTime) {
                const spawn = get3DSpawnPos(bot.team, br3D.mode);
                bot.x = spawn.x + (Math.random() - 0.5) * 6;
                bot.z = spawn.z + (Math.random() - 0.5) * 6;
                bot.y = 0;
                bot.hp = bot.maxHp;
                bot.alive = true;
                bot.invulnUntil = now + 3000;
                bot.respawnTime = 0;
                bot.stuckCounter = 0;
                bot.patrolTarget = null;
            }
            return;
        }

        // 1. Stuck Detection & Recovery Timer
        if (!bot.lastPosCheck || now - bot.lastPosCheck > 400) {
            if (bot.lastX !== undefined && bot.lastZ !== undefined) {
                const distTraveled = Math.hypot(bot.x - bot.lastX, bot.z - bot.lastZ);
                if (distTraveled < 0.25) {
                    bot.stuckCounter = (bot.stuckCounter || 0) + 1;
                    if (bot.stuckCounter >= 2) {
                        bot.stuckTimer = now + 1200;
                        bot.unstuckAngle = bot.rotY + (Math.random() > 0.5 ? 1 : -1) * (Math.PI * 0.6 + Math.random() * 0.5);
                        bot.patrolTarget = null;
                        bot.stuckCounter = 0;
                    }
                } else {
                    bot.stuckCounter = 0;
                }
            }
            bot.lastX = bot.x;
            bot.lastZ = bot.z;
            bot.lastPosCheck = now;
        }

        // 2. Find nearest visible enemy
        let nearestEnemy = null;
        let nearestDist = Infinity;

        // Check local player
        if (br3D.myP && br3D.myP.alive && br3D.myP.team !== bot.team) {
            const dist = Math.hypot(br3D.myP.x - bot.x, br3D.myP.z - bot.z);
            if (dist < 80) {
                const hasLOS = checkLineOfSight3D(bot.x, bot.z, br3D.myP.x, br3D.myP.z);
                if (hasLOS && dist < nearestDist) {
                    nearestDist = dist;
                    nearestEnemy = br3D.myP;
                }
            }
        }

        // Check enemy bots
        br3D.bots.forEach(otherBot => {
            if (otherBot.id !== bot.id && otherBot.alive && otherBot.team !== bot.team) {
                const dist = Math.hypot(otherBot.x - bot.x, otherBot.z - bot.z);
                if (dist < 80) {
                    const hasLOS = checkLineOfSight3D(bot.x, bot.z, otherBot.x, otherBot.z);
                    if (hasLOS && dist < nearestDist) {
                        nearestDist = dist;
                        nearestEnemy = otherBot;
                    }
                }
            }
        });

        // 3. AI Behaviors & Obstacle Avoidance
        let moveAngle = 0;
        let moveSpeed = bot.speed;
        let isMoving = true;

        if (bot.stuckTimer && now < bot.stuckTimer) {
            // Unstuck maneuver
            moveAngle = findClearBotAngle(bot, bot.unstuckAngle || 0, 2.0);
            bot.rotY = moveAngle;
            moveSpeed = bot.speed * 0.7;
        } else if (nearestEnemy) {
            // Aim at enemy
            let targetX = nearestEnemy.x;
            let targetZ = nearestEnemy.z;

            // Level 3 bots lead the target
            if (bot.aiLevel === 3 && nearestEnemy.vx) {
                targetX += nearestEnemy.vx * 0.2;
                targetZ += nearestEnemy.vz * 0.2;
            }

            const aimAngle = Math.atan2(targetX - bot.x, targetZ - bot.z);
            bot.rotY = aimAngle;

            // Combat Movement
            if (nearestDist > 18) {
                // Approach enemy with wall avoidance
                moveAngle = findClearBotAngle(bot, aimAngle, 2.4);
                moveSpeed = bot.speed;
            } else if (nearestDist < 8) {
                // Back up slightly with wall avoidance
                moveAngle = findClearBotAngle(bot, aimAngle + Math.PI, 2.0);
                moveSpeed = bot.speed * 0.7;
            } else {
                // Tactical strafe
                const strafeDir = (bot.strafeSign || 1);
                const rawStrafeAngle = aimAngle + (Math.PI / 2) * strafeDir;
                moveAngle = findClearBotAngle(bot, rawStrafeAngle, 2.0);
                moveSpeed = bot.speed * 0.55;
            }

            // Shoot at enemy
            if (now - bot.lastShotTime > bot.shootInterval * 1000) {
                bot.lastShotTime = now;
                const muzzlePos = new THREE.Vector3(bot.x, 1.4, bot.z);
                const shootDir = new THREE.Vector3(Math.sin(aimAngle), 0, Math.cos(aimAngle)).normalize();
                fire3DBullet(muzzlePos, shootDir, bot.id, bot.team);
            }
        } else {
            // Patrol towards enemy base or intermediate passage
            if (!bot.patrolTarget || Math.hypot(bot.patrolTarget.x - bot.x, bot.patrolTarget.z - bot.z) < 6) {
                const targetBase = (bot.team === 'Counter-Terrorists') ? br3D.baseRects.t : br3D.baseRects.ct;
                if (targetBase) {
                    bot.patrolTarget = {
                        x: targetBase.x + (Math.random() - 0.5) * 40,
                        z: targetBase.z + (Math.random() - 0.5) * 40
                    };
                }
            }

            let nextWaypoint = bot.patrolTarget;
            if (bot.patrolTarget) {
                // If crossing central divider wall (X=0) is needed
                const needCrossCenter = (bot.x < -4 && bot.patrolTarget.x > 4) || (bot.x > 4 && bot.patrolTarget.x < -4);
                if (needCrossCenter) {
                    const bestPZ = getBestPassageZ(bot.z, bot.patrolTarget.z);
                    nextWaypoint = { x: 0, z: bestPZ };
                }
            }

            if (nextWaypoint) {
                const desiredAngle = Math.atan2(nextWaypoint.x - bot.x, nextWaypoint.z - bot.z);
                moveAngle = findClearBotAngle(bot, desiredAngle, 2.5);
                bot.rotY = moveAngle;
                moveSpeed = bot.speed * 0.65;
            } else {
                isMoving = false;
            }
        }

        // Apply Movement with 3D Collision Sliding
        if (isMoving) {
            bot.vx = Math.sin(moveAngle) * moveSpeed;
            bot.vz = Math.cos(moveAngle) * moveSpeed;

            const newX = bot.x + bot.vx * dt;
            if (!checkPlayerWallCollision3D(newX, bot.z, 0.8)) {
                bot.x = newX;
            } else {
                bot.vx = 0;
            }

            const newZ = bot.z + bot.vz * dt;
            if (!checkPlayerWallCollision3D(bot.x, newZ, 0.8)) {
                bot.z = newZ;
            } else {
                bot.vz = 0;
            }
        } else {
            bot.vx = 0;
            bot.vz = 0;
        }
    });
}

function get3DSpawnPos(team, mode) {
    const base = (team === 'Counter-Terrorists' || team === 'CT') ? br3D.baseRects.ct : br3D.baseRects.t;
    if (!base) return { x: 0, z: 0 };
    return {
        x: base.x + (Math.random() - 0.5) * 12,
        z: base.z + (Math.random() - 0.5) * 12
    };
}

function tryFire3DWeapon() {
    const p = br3D.myP;
    if (!p || !p.alive || br3D.isReloading) return;
    const now = Date.now();
    if (now - br3D.lastShotTime < br3D.fireRate * 1000) return;

    if (br3D.ammo > 0) {
        br3D.ammo--;
        br3D.lastShotTime = now;
        const muzzlePos = new THREE.Vector3(p.x, 1.35, p.z);
        const pitch = br3D.cameraCtrl ? br3D.cameraCtrl.pitch : 0.45;
        const shootDir = new THREE.Vector3(
            Math.sin(p.rotY),
            -Math.sin(pitch - 0.45) * 0.35,
            Math.cos(p.rotY)
        ).normalize();
        fire3DBullet(muzzlePos, shootDir, myId, p.team);
        p.shotSeq = (p.shotSeq || 0) + 1;
        update3DHUD();
    } else {
        reload3DWeapon();
    }
}

// -----------------------------------------------------------------------------
// LOCAL PLAYER LOGIC & CAMERA UPDATE
// -----------------------------------------------------------------------------
function update3DLocalPlayer(dt) {
    const p = br3D.myP;
    if (!p || !p.alive) return;

    const now = Date.now();
    let forwardInput = 0;
    let strafeInput = 0;

    // Keyboard WASD:
    // W: Forward, S: Backward
    if (br3D.keys['KeyW'] || br3D.keys['ArrowUp']) forwardInput += 1;
    if (br3D.keys['KeyS'] || br3D.keys['ArrowDown']) forwardInput -= 1;

    // A: Strafe Left, D: Strafe Right
    if (br3D.keys['KeyA'] || br3D.keys['ArrowLeft']) strafeInput -= 1;
    if (br3D.keys['KeyD'] || br3D.keys['ArrowRight']) strafeInput += 1;

    // Mobile Virtual Joystick input
    if (br3D.touch.joystickActive) {
        forwardInput -= br3D.touch.dy;
        strafeInput += br3D.touch.dx;
    }

    // Normalize diagonal movement
    const inputLen = Math.hypot(forwardInput, strafeInput);
    if (inputLen > 1) {
        forwardInput /= inputLen;
        strafeInput /= inputLen;
    }

    // Calculate movement relative to character's look direction
    const lookAngle = p.rotY;
    const forwardX = Math.sin(lookAngle);
    const forwardZ = Math.cos(lookAngle);
    const rightX = -Math.cos(lookAngle);
    const rightZ = Math.sin(lookAngle);

    const speed = (br3D.keys['ShiftLeft'] || br3D.keys['ShiftRight']) ? p.speed * 1.35 : p.speed;

    p.vx = (forwardX * forwardInput + rightX * strafeInput) * speed;
    p.vz = (forwardZ * forwardInput + rightZ * strafeInput) * speed;

    // X Axis collision sliding
    const nextX = p.x + p.vx * dt;
    if (!checkPlayerWallCollision3D(nextX, p.z, 0.8)) {
        p.x = nextX;
    }

    // Z Axis collision sliding
    const nextZ = p.z + p.vz * dt;
    if (!checkPlayerWallCollision3D(p.x, nextZ, 0.8)) {
        p.z = nextZ;
    }

    // Continuous shooting while holding LMB
    if (isShooting && !br3D.isReloading && now - br3D.lastShotTime > br3D.fireRate * 1000) {
        tryFire3DWeapon();
    }
}

function update3DCamera(dt) {
    if (!br3D.camera) return;
    const ctrl = br3D.cameraCtrl;

    // Smooth Lerp for Camera Orbit Angles & Zoom
    ctrl.yaw = THREE.MathUtils.lerp(ctrl.yaw, ctrl.targetYaw, 0.28);
    ctrl.pitch = THREE.MathUtils.lerp(ctrl.pitch, ctrl.targetPitch, 0.28);
    ctrl.distance = THREE.MathUtils.lerp(ctrl.distance, ctrl.targetDistance, 0.22);

    // Target position (player or spectator target)
    let targetX = 0, targetY = 0, targetZ = 0;
    if (br3D.myP && br3D.myP.alive) {
        targetX = br3D.myP.x;
        targetY = br3D.myP.y || 0;
        targetZ = br3D.myP.z;
    } else if (br3D.isSpectator || (br3D.myP && !br3D.myP.alive)) {
        let targetBot = br3D.bots.find(b => b.id === br3D.spectatorTargetId && b.alive);
        if (!targetBot) {
            const myTeam = br3D.myP ? br3D.myP.team : null;
            targetBot = br3D.bots.find(b => b.alive && b.team === myTeam) || br3D.bots.find(b => b.alive);
            if (targetBot) br3D.spectatorTargetId = targetBot.id;
        }
        if (targetBot) {
            targetX = targetBot.x;
            targetY = targetBot.y || 0;
            targetZ = targetBot.z;
            const specEl = document.getElementById('br-ui-spectator');
            if (specEl && br3D.isSpectator) {
                specEl.innerText = `Зритель: ${targetBot.label || targetBot.id}`;
            }
        }
    }

    // Spherical Coordinate Positioning behind target (Standoff 2 Over-The-Shoulder / Third Person)
    const horizontalDist = ctrl.distance * Math.cos(ctrl.pitch);
    const heightOffset = ctrl.distance * Math.sin(ctrl.pitch);

    // Place camera behind the character
    let desiredCamX = targetX - Math.sin(ctrl.yaw) * horizontalDist;
    let desiredCamY = targetY + 1.5 + heightOffset;
    let desiredCamZ = targetZ - Math.cos(ctrl.yaw) * horizontalDist;

    if (desiredCamY < 0.8) desiredCamY = 0.8;

    // Aim target in front of character along look direction
    const lookTarget = new THREE.Vector3(
        targetX + Math.sin(ctrl.yaw) * 25,
        targetY + 1.4 - Math.sin(ctrl.pitch - 0.45) * 12,
        targetZ + Math.cos(ctrl.yaw) * 25
    );

    br3D.camera.position.lerp(new THREE.Vector3(desiredCamX, desiredCamY, desiredCamZ), 0.35);
    br3D.cameraTarget.lerp(lookTarget, 0.4);
    br3D.camera.lookAt(br3D.cameraTarget);
}

// -----------------------------------------------------------------------------
// 3D MESH SYNCHRONIZATION & PROCEDURAL ANIMATIONS
// -----------------------------------------------------------------------------
function sync3DCharacterMeshes(dt) {
    const now = Date.now();

    // 1. Local Player Mesh
    if (br3D.myP) {
        let mesh = br3D.playerMeshes[myId];
        if (!mesh) {
            mesh = create3DCharacterModel(br3D.myP.team);
            br3D.scene.add(mesh);
            br3D.playerMeshes[myId] = mesh;
        }

        mesh.visible = br3D.myP.alive;
        if (br3D.myP.alive) {
            mesh.position.set(br3D.myP.x, br3D.myP.y || 0, br3D.myP.z);
            mesh.rotation.y = br3D.myP.rotY;

            // Walk animation
            animate3DLegs(mesh, br3D.myP.vx, br3D.myP.vz, dt);

            // Shield
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
        const rp = br3D.remotePlayers[pId];
        let mesh = br3D.playerMeshes[pId];
        if (!mesh) {
            mesh = create3DCharacterModel(rp.team);
            br3D.scene.add(mesh);
            br3D.playerMeshes[pId] = mesh;
        }

        mesh.visible = rp.alive;
        if (rp.alive) {
            mesh.position.lerp(new THREE.Vector3(rp.x, 0, rp.z), 0.2);
            mesh.rotation.y = rp.rotY || 0;
        }
    });
}

function animate3DLegs(mesh, vx, vz, dt) {
    const isMoving = Math.hypot(vx, vz) > 0.5;
    if (!mesh.walkPhase) mesh.walkPhase = 0;

    if (isMoving) {
        mesh.walkPhase += 14 * dt;
        const swing = Math.sin(mesh.walkPhase) * 0.45;
        if (mesh.leftLegNode) mesh.leftLegNode.rotation.x = swing;
        if (mesh.rightLegNode) mesh.rightLegNode.rotation.x = -swing;
        if (mesh.leftArmNode) mesh.leftArmNode.rotation.x = -swing * 0.7;
    } else {
        if (mesh.leftLegNode) mesh.leftLegNode.rotation.x *= 0.8;
        if (mesh.rightLegNode) mesh.rightLegNode.rotation.x *= 0.8;
        if (mesh.leftArmNode) mesh.leftArmNode.rotation.x *= 0.8;
    }
}

// -----------------------------------------------------------------------------
// 3D BULLET & PROJECTILE SIMULATION
// -----------------------------------------------------------------------------
function update3DBullets(dt) {
    const now = Date.now();

    for (let i = br3D.bulletMeshes.length - 1; i >= 0; i--) {
        const b = br3D.bulletMeshes[i];
        b.life -= dt;

        const moveDist = b.speed * dt;
        const nextPos = b.pos.clone().addScaledVector(b.dir, moveDist);

        // 1. Check Collision with 3D Walls
        if (checkBulletWallCollision3D(nextPos.x, nextPos.z)) {
            create3DHitSparks(nextPos, false);
            br3D.scene.remove(b.mesh);
            br3D.bulletMeshes.splice(i, 1);
            continue;
        }

        // 2. Check Collision with Local Player
        if (b.shooterId !== myId && br3D.myP && br3D.myP.alive && b.team !== br3D.myP.team) {
            if (Math.hypot(nextPos.x - br3D.myP.x, nextPos.z - br3D.myP.z) < 1.0) {
                // Local player hit
                damage3DPlayer(br3D.myP, br3D.damagePerHit, b.shooterId);
                create3DHitSparks(nextPos, true);
                br3D.scene.remove(b.mesh);
                br3D.bulletMeshes.splice(i, 1);
                continue;
            }
        }

        // 3. Check Collision with Bots
        let hitBot = false;
        for (let bot of br3D.bots) {
            if (b.shooterId !== bot.id && bot.alive && b.team !== bot.team) {
                if (Math.hypot(nextPos.x - bot.x, nextPos.z - bot.z) < 1.0) {
                    damage3DBot(bot, br3D.damagePerHit, b.shooterId);
                    create3DHitSparks(nextPos, true);
                    br3D.scene.remove(b.mesh);
                    br3D.bulletMeshes.splice(i, 1);
                    hitBot = true;
                    break;
                }
            }
        }
        if (hitBot) continue;

        // Update tracer position
        b.pos.copy(nextPos);
        b.mesh.position.copy(nextPos);

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

function get3DHitDamage(currentHp) {
    if (currentHp > 25) return 25;
    if (currentHp > 1) return currentHp - 1; // 25 -> 24 damage, leaving 1 HP
    return Math.max(1, currentHp); // 1 -> 1 damage on 5th hit, defeating target
}

function damage3DPlayer(p, rawDamage, attackerId) {
    const now = Date.now();
    if (now < p.invulnUntil || !p.alive) return; // Invulnerable

    const damage = get3DHitDamage(p.hp);
    p.hp -= damage;
    spawn3DFloatingDamage(new THREE.Vector3(p.x, 1.8, p.z), damage);
    update3DHUD();

    if (p.hp <= 0) {
        p.hp = 0;
        p.alive = false;
        handle3DPlayerDeath(p, attackerId);
    }
}

function damage3DBot(bot, rawDamage, attackerId) {
    const now = Date.now();
    if (now < bot.invulnUntil || !bot.alive) return;

    const damage = get3DHitDamage(bot.hp);
    bot.hp -= damage;
    spawn3DFloatingDamage(new THREE.Vector3(bot.x, 1.8, bot.z), damage);

    if (attackerId === myId) {
        br3D.damageDealt += damage;
    }

    if (bot.hp <= 0) {
        bot.hp = 0;
        bot.alive = false;
        handle3DBotDeath(bot, attackerId);
    }
}

function handle3DPlayerDeath(p, attackerId) {
    if (attackerId === myId) {
        br3D.kills++;
    }

    // Award team score
    if (p.team === 'Counter-Terrorists') {
        br3D.tScore++;
    } else {
        br3D.ctScore++;
    }

    update3DHUD();

    if (br3D.mode === 'tdm_5v5') {
        // TDM Respawn after 1.5s
        showRespawnTimer(1.5, () => {
            respawn3DPlayer();
        });
    } else {
        // Duel mode: Enter Spectator
        br3D.isSpectator = true;
        document.getElementById('br-ui-spectator').style.display = 'block';
        checkDuelRoundEnd();
    }
}

function handle3DBotDeath(bot, attackerId) {
    if (attackerId === myId) {
        br3D.kills++;
        const killsEl = document.getElementById('br-ui-kills');
        if (killsEl) killsEl.innerText = `Киллы: ${br3D.kills}`;
    }

    if (bot.team === 'Counter-Terrorists') {
        br3D.tScore++;
    } else {
        br3D.ctScore++;
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
    br3D.isSpectator = false;

    const spec = document.getElementById('br-ui-spectator');
    if (spec) spec.style.display = 'none';
    update3DHUD();
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
// ROUND STATE MACHINE & GAME MODES
// -----------------------------------------------------------------------------
function checkDuelRoundEnd() {
    if (br3D.roundEnding) return;

    let ctAlive = 0, tAlive = 0;
    if (br3D.myP && br3D.myP.alive) {
        if (br3D.myP.team === 'Counter-Terrorists') ctAlive++; else tAlive++;
    }
    br3D.bots.forEach(b => {
        if (b.alive) {
            if (b.team === 'Counter-Terrorists') ctAlive++; else tAlive++;
        }
    });

    if (ctAlive === 0 || tAlive === 0) {
        br3D.roundEnding = true;
        const winner = (ctAlive > 0) ? 'Counter-Terrorists' : 'Terrorists';
        if (winner === 'Counter-Terrorists') br3D.ctRounds++; else br3D.tRounds++;

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

    // Respawn all
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

    // Award Coins
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
            timer: document.getElementById('br-match-timer-val'),
            hpFill: document.getElementById('br-hp-fill'),
            hpVal: document.getElementById('br-hp-val'),
            ammoVal: document.getElementById('br-ammo-val'),
            aliveEl: document.getElementById('br-ui-alive')
        };
    }
    const els = _cachedHudEls;

    // Scoreboard values
    const ctVal = (br3D.mode === 'tdm_5v5') ? br3D.ctScore : br3D.ctRounds;
    const tVal = (br3D.mode === 'tdm_5v5') ? br3D.tScore : br3D.tRounds;
    if (_lastHudState.ctScore !== ctVal) {
        _lastHudState.ctScore = ctVal;
        if (els.ctScore) els.ctScore.innerText = ctVal;
    }
    if (_lastHudState.tScore !== tVal) {
        _lastHudState.tScore = tVal;
        if (els.tScore) els.tScore.innerText = tVal;
    }

    // Timer
    const now = Date.now();
    const elapsed = Math.floor((now - br3D.matchStartTime) / 1000);
    const remain = Math.max(0, br3D.matchDuration - elapsed);
    const m = Math.floor(remain / 60);
    const s = remain % 60;
    const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    if (_lastHudState.timer !== timeStr) {
        _lastHudState.timer = timeStr;
        if (els.timer) els.timer.innerText = timeStr;
    }

    if (br3D.mode === 'tdm_5v5' && remain === 0 && br3D.matchActive) {
        end3DMatch();
    }

    // Health Bar & Ammo
    const hp = br3D.myP ? br3D.myP.hp : 0;
    const maxHp = br3D.myP ? br3D.myP.maxHp : 100;
    if (_lastHudState.hp !== hp || _lastHudState.maxHp !== maxHp) {
        _lastHudState.hp = hp;
        _lastHudState.maxHp = maxHp;
        if (els.hpFill) els.hpFill.style.width = `${(hp / maxHp) * 100}%`;
        if (els.hpVal) els.hpVal.innerText = hp;
    }

    const isRel = br3D.isReloading;
    const ammo = br3D.ammo;
    if (_lastHudState.ammo !== ammo || _lastHudState.reloading !== isRel) {
        _lastHudState.ammo = ammo;
        _lastHudState.reloading = isRel;
        if (els.ammoVal) els.ammoVal.innerText = isRel ? 'RELOAD...' : ammo;
    }

    // Alive tracker
    let aliveCount = (br3D.myP && br3D.myP.alive) ? 1 : 0;
    br3D.bots.forEach(b => { if (b.alive) aliveCount++; });
    if (_lastHudState.alive !== aliveCount) {
        _lastHudState.alive = aliveCount;
        if (els.aliveEl) els.aliveEl.innerText = `Живых: ${aliveCount}`;
    }
}

function render3DRadar() {
    const minimap = document.getElementById('br-minimap-canvas');
    if (!minimap) return;
    const ctx = minimap.getContext('2d');
    const w = minimap.width;
    const h = minimap.height;
    ctx.clearRect(0, 0, w, h);

    // Dark radar background
    ctx.fillStyle = 'rgba(15, 20, 30, 0.85)';
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

    // Teammates & Enemies
    if (br3D.myP && br3D.myP.alive) {
        ctx.fillStyle = '#00ffcc';
        ctx.beginPath();
        ctx.arc((br3D.myP.x + half) * scale, (br3D.myP.z + half) * scale, 3.5, 0, Math.PI * 2);
        ctx.fill();
    }

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
// MAIN 3D GAME LOOP & START / STOP
// -----------------------------------------------------------------------------
let _radarThrottleTimer = 0;

function br3DLoop() {
    if (!br3D.active) return;
    const dt = Math.min(br3D.clock ? br3D.clock.getDelta() : 0.016, 0.1);

    // Update Local Player
    update3DLocalPlayer(dt);

    // Update Bots AI
    update3DBots(dt);

    // Update Bullets & Ballistics
    update3DBullets(dt);

    // Update Camera Position & Orbit
    update3DCamera(dt);

    // Sync 3D Meshes
    sync3DCharacterMeshes(dt);

    // Render HUD
    update3DHUD();

    // Throttled 2D Radar Update (~12 FPS instead of 60 FPS)
    _radarThrottleTimer += dt;
    if (_radarThrottleTimer >= 0.08) {
        _radarThrottleTimer = 0;
        render3DRadar();
    }

    // Render Three.js Scene
    if (br3D.renderer && br3D.scene && br3D.camera) {
        br3D.renderer.render(br3D.scene, br3D.camera);
    }

    br3D.animFrameId = requestAnimationFrame(br3DLoop);
}

function initBR() {
    br3D.active = true;
    br3D.matchActive = true;
    br3D.matchStartTime = Date.now();
    br3D.kills = 0;
    br3D.damageDealt = 0;
    br3D.ctScore = 0;
    br3D.tScore = 0;
    br3D.ctRounds = 0;
    br3D.tRounds = 0;
    br3D.currentRound = 1;
    br3D.roundEnding = false;
    br3D.ammo = 30;
    br3D.isReloading = false;

    // Detect game mode
    const submode = (typeof appState !== 'undefined' && appState.selectedGameId && appState.selectedGameId.startsWith('br_')) 
        ? appState.selectedGameId.replace('br_', '') 
        : 'tdm_5v5';
    br3D.mode = submode;

    // Init Three.js
    init3DEngine();
    generate3DMap(submode);

    // Initialize Local Player
    const myTeam = (typeof selectedTeam !== 'undefined' && selectedTeam) ? selectedTeam : 'Counter-Terrorists';
    const spawn = get3DSpawnPos(myTeam, submode);

    br3D.myP = {
        id: myId,
        team: myTeam,
        x: spawn.x,
        y: 0,
        z: spawn.z,
        vx: 0, vz: 0,
        rotY: (myTeam === 'Counter-Terrorists') ? Math.PI / 2 : -Math.PI / 2,
        hp: 100,
        maxHp: 100,
        speed: 12,
        alive: true,
        invulnUntil: Date.now() + 3000
    };

    // Initialize Bots
    init3DBots(submode);

    // Initialize Camera Controller (Standoff 2 Third-Person Default)
    br3D.cameraCtrl.distance = 12;
    br3D.cameraCtrl.targetDistance = 12;
    br3D.cameraCtrl.yaw = (myTeam === 'Counter-Terrorists') ? Math.PI / 2 : -Math.PI / 2;
    br3D.cameraCtrl.targetYaw = br3D.cameraCtrl.yaw;
    br3D.cameraCtrl.pitch = 0.45;
    br3D.cameraCtrl.targetPitch = 0.45;
    br3D.cameraCtrl.mode = 'tactical';
    updateCameraModeUI();

    // Bind Controls
    bind3DControls();

    // Show Scoreboard & HUD Elements
    const scoreboard = document.getElementById('br-scoreboard');
    if (scoreboard) scoreboard.style.display = 'flex';
    const timerLabel = document.getElementById('br-match-timer-label');
    if (timerLabel) timerLabel.innerText = (submode === 'tdm_5v5') ? 'TDM' : 'DUEL';

    // Show mobile controls if mobile
    const isMobile = (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) || ('ontouchstart' in window);
    const controls = document.getElementById('br-controls');
    if (controls) controls.style.display = isMobile ? 'block' : 'none';

    // Start 3D Loop
    if (br3D.animFrameId) cancelAnimationFrame(br3D.animFrameId);
    br3D.animFrameId = requestAnimationFrame(br3DLoop);
}

function stopBR() {
    br3D.active = false;
    br3D.matchActive = false;
    if (br3D.animFrameId) {
        cancelAnimationFrame(br3D.animFrameId);
        br3D.animFrameId = null;
    }
}

// Global exports
window.initBR = initBR;
window.stopBR = stopBR;
window.br3D = br3D;
