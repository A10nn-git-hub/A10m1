// =========================================================================
// GAME HUB - CENTRAL MULTIPLAYER LOBBY & GAME LAUNCH ENGINE
// =========================================================================

// Sound FX generator using Web Audio API
class SoundFX {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
    }

    hover() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(420, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(840, this.ctx.currentTime + 0.08);

            gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + 0.08);
        } catch (e) {}
    }

    click() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(220, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(580, this.ctx.currentTime + 0.15);

            gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + 0.15);
        } catch (e) {}
    }

    ready() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            [523.25, 659.25, 783.99].forEach((freq, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + i * 0.05);
                gain.gain.setValueAtTime(0.08, now + i * 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.16);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now + i * 0.05);
                osc.stop(now + i * 0.05 + 0.16);
            });
        } catch (e) {}
    }

    unready() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(360, now);
            osc.frequency.exponentialRampToValueAtTime(200, now + 0.14);
            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.14);
        } catch (e) {}
    }

    countdownTick() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(780, now);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.12);
        } catch (e) {}
    }

    countdownGo() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            [587.33, 880, 1174.66].forEach((freq, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now + i * 0.05);
                gain.gain.setValueAtTime(0.14, now + i * 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.45);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now + i * 0.05);
                osc.stop(now + i * 0.05 + 0.45);
            });
        } catch (e) {}
    }

    copy() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(980, now);
            osc.frequency.exponentialRampToValueAtTime(1400, now + 0.09);
            gain.gain.setValueAtTime(0.09, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.09);
        } catch (e) {}
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

const sfx = new SoundFX();

// Particle Canvas Background
class ParticleCanvas {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.numParticles = 55;
        this.mouse = { x: null, y: null, radius: 140 };

        this.resize();
        this.initParticles();
        this.bindEvents();
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    resize() {
        this.width = this.canvas.width = window.innerWidth;
        this.height = this.canvas.height = window.innerHeight;
    }

    initParticles() {
        this.particles = [];
        for (let i = 0; i < this.numParticles; i++) {
            this.particles.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                vx: (Math.random() - 0.5) * 0.8,
                vy: (Math.random() - 0.5) * 0.8,
                size: Math.random() * 2 + 1,
                alpha: Math.random() * 0.5 + 0.2,
                color: Math.random() > 0.5 ? '#00f0ff' : '#32ade6'
            });
        }
    }

    bindEvents() {
        window.addEventListener('resize', () => {
            this.resize();
            this.initParticles();
        });

        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.x;
            this.mouse.y = e.y;
        });

        window.addEventListener('mouseleave', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });
    }

    animate() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];

            p.x += p.vx;
            p.y += p.vy;

            if (p.x < 0 || p.x > this.width) p.vx *= -1;
            if (p.y < 0 || p.y > this.height) p.vy *= -1;

            if (this.mouse.x !== null && this.mouse.y !== null) {
                const dx = this.mouse.x - p.x;
                const dy = this.mouse.y - p.y;
                const dist = Math.hypot(dx, dy);
                if (dist < this.mouse.radius) {
                    const force = (this.mouse.radius - dist) / this.mouse.radius;
                    p.x -= (dx / dist) * force * 2;
                    p.y -= (dy / dist) * force * 2;
                }
            }

            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.alpha;
            this.ctx.fill();

            for (let j = i + 1; j < this.particles.length; j++) {
                const p2 = this.particles[j];
                const dx = p.x - p2.x;
                const dy = p.y - p2.y;
                const dist = Math.hypot(dx, dy);

                if (dist < 120) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(p.x, p.y);
                    this.ctx.lineTo(p2.x, p2.y);
                    this.ctx.strokeStyle = '#38bdf8';
                    this.ctx.globalAlpha = (1 - dist / 120) * 0.15;
                    this.ctx.lineWidth = 0.8;
                    this.ctx.stroke();
                }
            }
        }

        this.ctx.globalAlpha = 1;
        requestAnimationFrame(this.animate);
    }
}

// Device Mode Manager
class DeviceModeManager {
    constructor() {
        this.STORAGE_KEY = 'gamehub_device_mode';
        this.modal = document.getElementById('device-modal');
        this.btnPc = document.getElementById('btn-select-pc');
        this.btnMobile = document.getElementById('btn-select-mobile');
        this.btnToggle = document.getElementById('device-toggle');
        this.toggleIcon = document.getElementById('device-toggle-icon');
        this.toggleText = document.getElementById('device-toggle-text');
        this.hintText = document.getElementById('platform-hint-text');

        this.init();
    }

    init() {
        const savedMode = localStorage.getItem(this.STORAGE_KEY);
        if (!savedMode) {
            this.showModal();
        } else {
            this.applyMode(savedMode, false);
        }

        if (this.btnPc) {
            this.btnPc.addEventListener('click', () => {
                sfx.click();
                this.setMode('pc');
                this.hideModal();
            });
        }

        if (this.btnMobile) {
            this.btnMobile.addEventListener('click', () => {
                sfx.click();
                this.setMode('mobile');
                this.hideModal();
            });
        }

        if (this.btnToggle) {
            this.btnToggle.addEventListener('click', () => {
                sfx.click();
                const current = this.getMode();
                const nextMode = current === 'mobile' ? 'pc' : 'mobile';
                this.setMode(nextMode);
            });
        }
    }

    getMode() {
        return localStorage.getItem(this.STORAGE_KEY) || 'pc';
    }

    setMode(mode) {
        localStorage.setItem(this.STORAGE_KEY, mode);
        this.applyMode(mode, true);
    }

    showModal() {
        if (this.modal) this.modal.classList.add('active');
    }

    hideModal() {
        if (this.modal) this.modal.classList.remove('active');
    }

    applyMode(mode) {
        if (mode === 'mobile') {
            document.body.classList.add('mode-mobile');
            if (this.toggleIcon) this.toggleIcon.textContent = '📱';
            if (this.toggleText) this.toggleText.textContent = 'Режим: Телефон';
            if (this.hintText) this.hintText.textContent = 'Нажмите на карточку игры для запуска';
        } else {
            document.body.classList.remove('mode-mobile');
            if (this.toggleIcon) this.toggleIcon.textContent = '🖥️';
            if (this.toggleText) this.toggleText.textContent = 'Режим: ПК';
            if (this.hintText) this.hintText.textContent = 'Нажмите на игру или настройте режим в лобби';
        }
    }
}

// =========================================================================
// CENTRAL MULTIPLAYER LOBBY STATE & FIREBASE SYNC
// =========================================================================

let db = null;
let myId = '';
let myName = 'Игрок';
let myAvatar = '😎';
let lobbyId = '';
let isHost = true;
let isPlayerReady = false;
let myPing = 0;
let pingInterval = null;
let currentLobbyData = null;
let friendsList = [];
let pendingInvite = null;
let lobbyListenerRef = null;

let toastTimeout = null;
let activeCountdownInterval = null;
let isCountingDown = false;

let selectedGame = 'br_3d'; // 'br_3d' or 'gta'
let selected3DMode = 'tdm_5v5'; // 'tdm_5v5', 'duel_1v1', 'duel_2v2'
let pending3DMode = 'tdm_5v5';

const MODE_NAMES = {
    'tdm_5v5': 'Командный бой 5х5',
    'duel_1v1': 'Дуэль 1х1',
    'duel_2v2': 'Дуэль 2х2'
};

const AVAILABLE_AVATARS = ['😎', '🤠', '🥷', '👾', '🤖', '🦁', '👑', '🎯', '🔥', '⚡', '🚀', '💀', '👽', '🦊', '🐺', '🦾', '🏆', '💎'];

// 0. Toast Utility
function showLobbyToast(msg, icon = '✨') {
    const toast = document.getElementById('lobby-toast');
    const toastMsg = document.getElementById('toast-msg');
    const toastIcon = document.getElementById('toast-icon');
    if (!toast) return;
    if (toastMsg) toastMsg.innerText = msg;
    if (toastIcon) toastIcon.innerText = icon;
    toast.classList.add('show');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3200);
}

// 0.1 Share / Copy Invite Link
function copyLobbyInviteLink() {
    sfx.click();
    const currentLId = lobbyId || myId;
    const url = `${window.location.origin}${window.location.pathname}?join=${currentLId}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
            sfx.copy();
            showLobbyToast('Ссылка на лобби скопирована!', '🔗');
        }).catch(() => fallbackCopyText(url));
    } else {
        fallbackCopyText(url);
    }
}

function fallbackCopyText(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        sfx.copy();
        showLobbyToast('Ссылка на лобби скопирована!', '🔗');
    } catch (err) {
        showLobbyToast('Код лобби: #' + (lobbyId || myId), '📋');
    }
    document.body.removeChild(textArea);
}

// 0.2 Ping Monitor
function startPingMonitor() {
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(measurePing, 3500);
    measurePing();
}

function measurePing() {
    if (!db || !myId) return;
    const t0 = Date.now();
    db.ref(`users/${myId}/_pingCheck`).set(t0).then(() => {
        myPing = Math.max(12, Math.round(Date.now() - t0));
        if (lobbyId && db) {
            db.ref(`lobbies/${lobbyId}/players/${myId}/ping`).set(myPing).catch(() => {});
        }
    }).catch(() => {});
}

// 1. Firebase Initialization
function initHubFirebase() {
    const firebaseConfig = {
        projectId: "mini-games-b9400",
        databaseURL: "https://mini-games-b9400-default-rtdb.europe-west1.firebasedatabase.app"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    db = firebase.database();

    // Init User ID
    const tg = window.Telegram ? window.Telegram.WebApp : null;
    let tgId = tg?.initDataUnsafe?.user?.id ? tg.initDataUnsafe.user.id.toString() : null;
    let tgName = tg?.initDataUnsafe?.user?.first_name || null;
    let savedId = localStorage.getItem('my_id') || tgId;

    if (savedId) {
        myId = savedId;
    } else {
        myId = Math.floor(1000 + Math.random() * 9000).toString();
        localStorage.setItem('my_id', myId);
    }

    myName = localStorage.getItem('my_name') || tgName || "Игрок";
    myAvatar = localStorage.getItem('my_avatar') || "😎";

    updateProfileUI();

    // Sync user in Firebase & listen for profile changes
    db.ref(`users/${myId}`).on('value', snap => {
        if (snap.exists()) {
            const data = snap.val();
            if (data.name) myName = data.name;
            if (data.avatar) myAvatar = data.avatar;
            updateProfileUI();
        } else {
            db.ref(`users/${myId}`).update({
                name: myName,
                avatar: myAvatar,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            });
        }
    });

    // Listen for incoming invites
    db.ref(`users/${myId}/invite`).on('value', snap => {
        if (snap.exists()) {
            pendingInvite = snap.val();
            showIncomingInviteToast(pendingInvite);
        } else {
            hideIncomingInviteToast();
        }
    });

    // Listen for friends list
    db.ref(`users/${myId}/friends`).on('value', snap => {
        friendsList = [];
        if (snap.exists()) {
            friendsList = Object.keys(snap.val());
        }
        renderFriendsList();
    });

    // Listen for friend requests badge
    db.ref(`users/${myId}/friend_reqs`).on('value', snap => {
        const badge = document.getElementById('fr-badge');
        if (!badge) return;
        const count = snap.exists() ? Object.keys(snap.val()).length : 0;
        badge.style.display = count > 0 ? 'inline-block' : 'none';
        badge.innerText = count;
    });

    // Presence & Ping systems
    bindHubPresence();
    startPingMonitor();

    // Check URL parameters for Quick Join (?join=XXXX or ?lobby=XXXX)
    const urlParams = new URLSearchParams(window.location.search);
    const targetJoinId = urlParams.get('join') || urlParams.get('lobby');

    if (targetJoinId && targetJoinId.trim().length > 0 && targetJoinId.trim() !== myId) {
        joinLobbyByHostId(targetJoinId.trim(), true);
        try {
            window.history.replaceState({}, document.title, window.location.pathname);
        } catch (e) {}
    } else {
        // Start with home lobby
        lobbyId = myId;
        isHost = true;
        if (db) {
            db.ref(`lobbies/${myId}`).update({
                status: 'waiting',
                host: myId
            }).catch(() => {});
        }
        listenToLobby(lobbyId);
    }
}

function bindHubPresence() {
    const userStatusRef = db.ref(`users/${myId}/presence`);
    const connectedRef = db.ref('.info/connected');

    connectedRef.on('value', snap => {
        if (snap.val() === false) return;
        userStatusRef.onDisconnect().set({
            state: 'offline',
            lastSeenAt: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
            userStatusRef.set({
                state: 'online',
                lastSeenAt: firebase.database.ServerValue.TIMESTAMP
            });
        });
    });
}

function updateProfileUI() {
    const avatarEl = document.getElementById('my-avatar');
    const nameEl = document.getElementById('my-name');
    const idEl = document.getElementById('my-id');

    if (avatarEl) avatarEl.innerText = myAvatar;
    if (nameEl) nameEl.innerText = `${myName} ✏️`;
    if (idEl) idEl.innerText = `ID: ${myId}`;
}

function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch]));
}

// 2. Lobby Management & Firebase Sync
function listenToLobby(lId) {
    if (lobbyListenerRef) {
        lobbyListenerRef.off();
    }

    lobbyId = lId;
    isPlayerReady = false;
    updateReadyButtonUI();

    lobbyListenerRef = db.ref(`lobbies/${lobbyId}`);

    // If in my own lobby, reset status to waiting
    if (lobbyId === myId) {
        db.ref(`lobbies/${lobbyId}`).update({
            status: 'waiting',
            host: myId
        }).catch(() => {});
    }

    // Ensure my player presence in lobby & remove from pending invites
    db.ref(`lobbies/${lobbyId}/players/${myId}`).set({
        name: myName,
        avatar: myAvatar,
        ready: isHost ? true : isPlayerReady,
        ping: myPing,
        joinedAt: firebase.database.ServerValue.TIMESTAMP
    }).catch(() => {});

    db.ref(`lobbies/${lobbyId}/invites/${myId}`).remove().catch(() => {});

    // On disconnect remove from lobby
    db.ref(`lobbies/${lobbyId}/players/${myId}`).onDisconnect().remove();

    const lobbyConnectedAt = Date.now();

    lobbyListenerRef.on('value', snap => {
        if (!snap.exists()) {
            // Lobby closed, return to my own lobby
            if (lobbyId !== myId) {
                showLobbyToast('Лобби было закрыто хостом', '⚠️');
                listenToLobby(myId);
            }
            return;
        }

        const data = snap.val();
        currentLobbyData = data;
        isHost = (data.host === myId || !data.host);

        // Synchronize selected game & mode
        if (data.game) selectedGame = data.game;
        if (data.currentMode) selected3DMode = data.currentMode;

        updateLobbyUI(data);

        // Handle Countdown status
        if (data.status === 'countdown') {
            if (!isCountingDown) {
                triggerCountdownSequence(3, () => {
                    launchGameDirectly(data);
                });
            }
        } else if (data.status === 'playing') {
            if (isCountingDown) {
                stopCountdownVisuals();
            }
            const startedAt = typeof data.startedAt === 'number' ? data.startedAt : 0;
            const isFreshLaunch = startedAt && (Date.now() - startedAt < 45000);
            if (isFreshLaunch) {
                launchGameDirectly(data);
            } else if (isHost) {
                // Stale playing status cleanup after 45+ seconds
                db.ref(`lobbies/${lobbyId}`).update({ status: 'waiting' }).catch(() => {});
            }
        } else if (data.status === 'waiting') {
            if (isCountingDown && data.countdownCancelled) {
                stopCountdownVisuals();
            }
        }
    });
}

// Ready toggle for guest players
function togglePlayerReady() {
    if (isHost) return;
    isPlayerReady = !isPlayerReady;
    if (isPlayerReady) {
        sfx.ready();
        showLobbyToast('Вы готовы к бою!', '✅');
    } else {
        sfx.unready();
        showLobbyToast('Готовность снята', '⏳');
    }
    updateReadyButtonUI();
    if (db && lobbyId) {
        db.ref(`lobbies/${lobbyId}/players/${myId}/ready`).set(isPlayerReady).catch(() => {});
    }
}

function updateReadyButtonUI() {
    const readyBtn = document.getElementById('btn-toggle-ready');
    const readyText = document.getElementById('ready-btn-text');
    if (!readyBtn) return;

    if (isHost) {
        readyBtn.style.display = 'none';
    } else {
        readyBtn.style.display = 'flex';
        readyBtn.classList.toggle('active', isPlayerReady);
        if (readyText) {
            readyText.innerHTML = isPlayerReady ? 'ГОТОВ ✓' : 'НЕ ГОТОВ ⏳';
        }
    }
}

function updateLobbyUI(data) {
    const players = data.players || {};
    const playerIds = Object.keys(players);
    const invites = data.invites || {};
    const inviteIds = Object.keys(invites).filter(id => !players[id]);
    const isParty = playerIds.length > 1 || inviteIds.length > 0;

    // Ready button update
    updateReadyButtonUI();

    // Badge status
    const badge = document.getElementById('lobby-badge-status');
    const titleText = document.getElementById('lobby-title-text');
    const leaveBtn = document.getElementById('btn-leave-lobby');

    if (badge) badge.innerText = isParty ? 'В ГРУППЕ' : 'ОДИНОЧНЫЙ';
    if (titleText) {
        if (lobbyId === myId) {
            titleText.innerText = `ВАШЕ ЛОББИ (#${myId})`;
        } else {
            titleText.innerText = `ЛОББИ ХОСТА #${lobbyId} (${playerIds.length}/5)`;
        }
    }
    if (leaveBtn) leaveBtn.style.display = (lobbyId !== myId) ? 'block' : 'none';

    // Slots Grid (Always strictly 5 slots)
    const grid = document.getElementById('lobby-slots-grid');
    let readyCount = 0;
    let nonHostCount = 0;

    if (grid) {
        grid.innerHTML = '';
        const MAX_SLOTS = 5;
        let renderedSlots = 0;

        // 1. Render Connected Players
        playerIds.forEach(id => {
            if (renderedSlots >= MAX_SLOTS) return;
            const p = players[id] || {};
            const isPlayerHost = (id === data.host || id === lobbyId);
            const isReady = isPlayerHost || Boolean(p.ready);

            if (!isPlayerHost) {
                nonHostCount++;
                if (isReady) readyCount++;
            }

            const pingVal = typeof p.ping === 'number' && p.ping > 0 ? p.ping : (id === myId ? myPing : 0);
            const pingClass = pingVal < 60 ? 'good' : (pingVal < 150 ? 'med' : 'bad');
            const pingHtml = pingVal > 0 ? `
                <div class="slot-ping ${pingClass}" title="Задержка: ${pingVal} мс">
                    <span class="slot-ping-dot"></span>
                    <span>${pingVal}ms</span>
                </div>
            ` : '';

            const isKickable = isHost && id !== myId;
            const slot = document.createElement('div');
            slot.className = `lobby-slot-card filled ${isPlayerHost ? 'is-host' : (isReady ? 'is-ready' : 'not-ready')} ${isKickable ? 'host-kickable' : ''}`;
            if (isKickable) {
                slot.title = `Нажмите, чтобы исключить игрока ${p.name || 'Игрок'}`;
                slot.onclick = (e) => {
                    e.stopPropagation();
                    confirmKickPlayer(id, p.name);
                };
            }
            slot.innerHTML = `
                ${pingHtml}
                <div class="slot-avatar">${p.avatar || '👤'}</div>
                <div class="slot-name">${escapeHtml(p.name || 'Игрок')}</div>
                <div class="slot-host-tag">${isPlayerHost ? '👑 ХОСТ' : (isReady ? '<span class="slot-ready-tag ready">✅ ГОТОВ</span>' : '<span class="slot-ready-tag not-ready">⏳ НЕ ГОТОВ</span>')}</div>
                ${isKickable ? `<button class="slot-kick-btn" onclick="event.stopPropagation(); confirmKickPlayer('${id}', '${escapeHtml(p.name || '')}')" title="Исключить игрока">✖</button>` : ''}
            `;
            grid.appendChild(slot);
            renderedSlots++;
        });

        // 2. Render Invited Players
        inviteIds.forEach(id => {
            if (renderedSlots >= MAX_SLOTS) return;
            const inv = invites[id] || {};
            const slot = document.createElement('div');
            slot.className = `lobby-slot-card is-invited ${isHost ? 'host-kickable' : ''}`;
            if (isHost) {
                slot.title = `Нажмите, чтобы отменить приглашение игрока ${inv.name || 'Игрок'}`;
                slot.onclick = (e) => {
                    e.stopPropagation();
                    cancelLobbyInvite(id);
                };
            }
            slot.innerHTML = `
                <div class="slot-avatar-invited">${inv.avatar || '👤'}</div>
                <div class="slot-name-invited">${escapeHtml(inv.name || 'Игрок')}</div>
                <div class="slot-invited-tag">⏳ ВХОДИТ...</div>
                ${isHost ? `<button class="slot-kick-btn" onclick="event.stopPropagation(); cancelLobbyInvite('${id}')" title="Отменить приглашение">✖</button>` : ''}
            `;
            grid.appendChild(slot);
            renderedSlots++;
        });

        // 3. Render Empty / Add Slots up to exactly 5 slots
        while (renderedSlots < MAX_SLOTS) {
            const addSlot = document.createElement('div');
            addSlot.className = 'lobby-slot-card is-add';
            addSlot.onclick = openFriendsModal;
            addSlot.innerHTML = `
                <div class="slot-add-icon">➕</div>
                <div class="slot-add-label">Пригласить</div>
            `;
            grid.appendChild(addSlot);
            renderedSlots++;
        }
    }

    // Update Bottom Bar Info
    const selIcon = document.getElementById('sel-game-icon');
    const selName = document.getElementById('sel-game-name');
    const selectBtn = document.getElementById('btn-select-game');
    const launchBtn = document.getElementById('btn-launch-game');

    if (selectBtn) {
        selectBtn.style.display = isHost ? 'flex' : 'none';
    }

    if (selectedGame === 'gta') {
        if (selIcon) selIcon.innerText = '🚗';
        if (selName) selName.innerHTML = `GTA 5 HTML <span class="selected-game-mode-badge">(3D Open World)</span>`;
    } else {
        if (selIcon) selIcon.innerText = '🎯';
        const modeLabel = MODE_NAMES[selected3DMode] || 'Командный бой 5х5';
        if (selName) selName.innerHTML = `3D Shooter <span class="selected-game-mode-badge">(${modeLabel})</span>`;
    }

    if (launchBtn) {
        if (isHost) {
            launchBtn.disabled = false;
            if (nonHostCount > 0) {
                launchBtn.innerHTML = `<span>ИГРАТЬ ▶ (${readyCount}/${nonHostCount} готовы)</span>`;
            } else {
                launchBtn.innerHTML = `<span>ИГРАТЬ ▶</span>`;
            }
        } else {
            launchBtn.disabled = true;
            launchBtn.innerHTML = `<span>Ожидание хоста...</span>`;
        }
    }
}

function leavePartyLobby() {
    sfx.click();
    if (lobbyId && lobbyId !== myId) {
        const oldLobbyId = lobbyId;
        db.ref(`lobbies/${oldLobbyId}/players/${myId}`).remove().catch(() => {});
        showLobbyToast('Вы вернулись в свое личное лобби', '🚪');
    }
    lobbyId = myId;
    isHost = true;
    listenToLobby(myId);
}

function kickPlayerFromLobby(targetId) {
    sfx.click();
    if (isHost && lobbyId) {
        db.ref(`lobbies/${lobbyId}/players/${targetId}`).remove().then(() => {
            showLobbyToast('Игрок исключен из лобби', '🚫');
        });
    }
}

function confirmKickPlayer(targetId, targetName = '') {
    if (!isHost || targetId === myId) return;
    sfx.click();
    const pName = targetName ? `«${targetName}»` : `#${targetId}`;
    const proceed = confirm(`❓ Исключить игрока ${pName} из вашего лобби?`);
    if (proceed) {
        kickPlayerFromLobby(targetId);
    }
}

// 2.2 Direct Find and Join Lobby by Host ID
function promptFindLobby() {
    sfx.click();
    const target = prompt('🔍 Поиск лобби:\nВведите ID хоста (или номер комнаты):');
    if (!target) return;
    const cleanId = target.trim().replace(/^#/, '');
    if (!cleanId) return;
    if (cleanId === myId) {
        showLobbyToast('Вы уже находитесь в своем лобби', 'ℹ️');
        return;
    }
    joinLobbyByHostId(cleanId, false);
}

function joinLobbyByHostId(targetHostId, isSilent = false) {
    if (!db) {
        if (!isSilent) alert('Ошибка подключения к базе данных');
        return;
    }

    const cleanHostId = String(targetHostId || '').trim().replace(/^#/, '');
    if (!cleanHostId || cleanHostId === myId) return;

    if (!isSilent) showLobbyToast(`Поиск лобби #${cleanHostId}...`, '🔎');

    Promise.all([
        db.ref(`lobbies/${cleanHostId}`).once('value'),
        db.ref(`users/${cleanHostId}/presence`).once('value')
    ]).then(([snap, presSnap]) => {
        if (!snap.exists()) {
            if (!isSilent) alert(`❌ Лобби с ID #${cleanHostId} не найдено или закрыто.`);
            return;
        }

        const data = snap.val() || {};
        const pres = presSnap.exists() ? presSnap.val() : null;

        // Check if host is online (either presence is online in last 90s, or host is actively in players map)
        const isPresOnline = pres && pres.state === 'online' && (Date.now() - (pres.lastSeenAt || 0) < 90000);
        const isHostInPlayers = Boolean(data.players && data.players[cleanHostId]);

        if (!isPresOnline && !isHostInPlayers) {
            if (!isSilent) alert(`❌ Игрок #${cleanHostId} сейчас не в сети.`);
            return;
        }

        const deviceMode = localStorage.getItem('gamehub_device_mode') || 'pc';

        // 1. If lobby is already playing
        if (data.status === 'playing' || data.status === 'countdown') {
            const game = data.game || 'gta';

            if (game === 'gta') {
                // GTA 5 HTML - join directly without questions
                showLobbyToast('Игроки в GTA 5! Загрузка города...', '🚗');
                setTimeout(() => {
                    window.location.href = `gta/index.html?lobby=${cleanHostId}&mode=${deviceMode}`;
                }, 400);
                return;
            } else {
                // 3D Shooter
                const mode = data.currentMode || 'tdm_5v5';
                let maxPlayers = 10;
                if (mode === 'duel_1v1') maxPlayers = 2;
                else if (mode === 'duel_2v2') maxPlayers = 4;
                else if (mode === 'tdm_5v5') maxPlayers = 10;

                const brPlayers = (data.br && data.br.players) ? data.br.players : (data.players || {});
                const activeCount = Object.keys(brPlayers).length;

                if (activeCount >= maxPlayers) {
                    alert(`⚠️ Лобби заполнено (${activeCount}/${maxPlayers}).\nВ режиме ${mode === 'duel_1v1' ? '1х1 (2 игрока)' : (mode === 'duel_2v2' ? '2х2 (4 игрока)' : '5х5 (10 игроков)')} все места заняты!`);
                    return;
                }

                // Slot available - directly enter 3D shooter!
                showLobbyToast(`Свободное место найдено (${activeCount + 1}/${maxPlayers})! Вход в 3D Shooter...`, '🎯');
                setTimeout(() => {
                    window.location.href = `3D shooter/index.html?lobby=${cleanHostId}&mode=${mode}&device=${deviceMode}`;
                }, 400);
                return;
            }
        }

        // 2. If lobby is in waiting state
        const waitingPlayers = data.players || {};
        const count = Object.keys(waitingPlayers).length;
        if (count >= 5 && !waitingPlayers[myId]) {
            alert('⚠️ Лобби заполнено (5/5 мест). Вход невозможен.');
            return;
        }

        lobbyId = cleanHostId;
        isHost = false;
        listenToLobby(lobbyId);
        showLobbyToast(`Вы успешно вошли в лобби #${lobbyId}`, '🚀');
    }).catch(err => {
        console.error('Join lobby error:', err);
        if (!isSilent) alert('Ошибка при поиске лобби');
    });
}

// 3. Game Selection & Modal (ВЫБРАТЬ ИГРУ)
let pendingModalGame = 'br_3d';
let pendingModal3DMode = 'tdm_5v5';

function openGameSelectModal() {
    if (!isHost) return;
    sfx.click();
    pendingModalGame = selectedGame || 'br_3d';
    pendingModal3DMode = selected3DMode || 'tdm_5v5';
    
    updateGameModalUI();
    const modal = document.getElementById('game-select-modal');
    if (modal) modal.classList.add('active');
}

function closeGameSelectModal() {
    const modal = document.getElementById('game-select-modal');
    if (modal) modal.classList.remove('active');
}

function selectGameModal(game) {
    sfx.click();
    pendingModalGame = game;
    updateGameModalUI();
}

function selectSubModeModal(mode, event) {
    if (event) event.stopPropagation();
    sfx.click();
    pendingModalGame = 'br_3d';
    pendingModal3DMode = mode;
    updateGameModalUI();
}

function updateGameModalUI() {
    const cardGta = document.getElementById('card-modal-gta');
    const card3D = document.getElementById('card-modal-3d');
    
    if (cardGta) cardGta.classList.toggle('active-modal-card', pendingModalGame === 'gta');
    if (card3D) card3D.classList.toggle('active-modal-card', pendingModalGame === 'br_3d');
    
    ['tdm_5v5', 'duel_1v1', 'duel_2v2'].forEach(m => {
        const el = document.getElementById(`submode-${m}`);
        if (el) el.classList.toggle('active', pendingModal3DMode === m);
    });
}

function confirmGameSelectModal() {
    sfx.click();
    selectedGame = pendingModalGame;
    selected3DMode = pendingModal3DMode;

    if (isHost && lobbyId && db) {
        db.ref(`lobbies/${lobbyId}`).update({
            game: selectedGame,
            currentMode: selected3DMode
        });
    }

    closeGameSelectModal();
    updateLobbyUI(currentLobbyData || { host: myId, players: { [myId]: { name: myName, avatar: myAvatar } } });
}

// 4. Launching the Game (Countdown sequence & Routing)
function triggerCountdownSequence(durationSec = 3, onComplete) {
    if (isCountingDown) return;
    isCountingDown = true;

    const overlay = document.getElementById('lobby-countdown-overlay');
    const numEl = document.getElementById('countdown-timer-num');
    const subEl = document.getElementById('countdown-game-sub');
    const cancelBtn = document.getElementById('btn-cancel-countdown');

    if (overlay) overlay.classList.add('active');
    if (cancelBtn) cancelBtn.style.display = isHost ? 'block' : 'none';

    const gameTitle = selectedGame === 'gta' ? 'GTA 5 HTML' : `3D Shooter (${MODE_NAMES[selected3DMode] || '5v5'})`;
    if (subEl) subEl.innerText = `${gameTitle} — запуск матча...`;

    let currentCount = durationSec;

    const updateNumber = (val, isGo = false) => {
        if (!numEl) return;
        numEl.innerText = val;
        numEl.classList.remove('animate-pop');
        void numEl.offsetWidth; // trigger CSS animation reflow
        numEl.classList.add('animate-pop');

        if (isGo) {
            sfx.countdownGo();
            numEl.style.color = '#30d158';
            numEl.style.textShadow = '0 0 35px #30d158, 0 0 70px #00f0ff';
        } else {
            sfx.countdownTick();
            numEl.style.color = '#fff';
            numEl.style.textShadow = '0 0 30px #00f0ff, 0 0 60px #007aff';
        }
    };

    updateNumber(currentCount, false);

    if (activeCountdownInterval) clearInterval(activeCountdownInterval);
    activeCountdownInterval = setInterval(() => {
        currentCount--;
        if (currentCount > 0) {
            updateNumber(currentCount, false);
        } else if (currentCount === 0) {
            updateNumber('В БОЙ!', true);
            if (subEl) subEl.innerText = 'Загрузка игрового мира...';
            
            // Execute launch callback smoothly upon reaching "В БОЙ!"
            if (activeCountdownInterval) {
                clearInterval(activeCountdownInterval);
                activeCountdownInterval = null;
            }
            setTimeout(() => {
                isCountingDown = false;
                if (typeof onComplete === 'function') onComplete();
            }, 350);
        }
    }, 850);
}

function cancelLobbyCountdown() {
    sfx.click();
    if (!isHost || !lobbyId || !db) return;
    db.ref(`lobbies/${lobbyId}`).update({
        status: 'waiting',
        countdownCancelled: true,
        startedAt: 0
    }).then(() => {
        stopCountdownVisuals();
        showLobbyToast('Старт матча отменен хостом', '🛑');
    });
}

function stopCountdownVisuals() {
    if (activeCountdownInterval) {
        clearInterval(activeCountdownInterval);
        activeCountdownInterval = null;
    }
    isCountingDown = false;
    const overlay = document.getElementById('lobby-countdown-overlay');
    if (overlay) overlay.classList.remove('active');
}

function launchActiveLobbyGame() {
    sfx.click();
    if (!isHost) return;

    const players = (currentLobbyData && currentLobbyData.players) || {};
    const playerIds = Object.keys(players);
    const unreadyPlayers = playerIds.filter(id => id !== myId && !players[id]?.ready);

    if (playerIds.length > 1 && unreadyPlayers.length > 0) {
        const unreadyNames = unreadyPlayers.map(id => players[id]?.name || `Игрок #${id}`).join(', ');
        const proceed = confirm(`⚠️ Не все игроки подтвердили готовность (${unreadyNames}).\nЗапустить игру прямо сейчас?`);
        if (!proceed) return;
    }

    if (playerIds.length > 1) {
        // Multiplayer Launch: start synchronized countdown in DB
        db.ref(`lobbies/${lobbyId}`).update({
            status: 'countdown',
            countdownCancelled: false,
            game: selectedGame,
            currentMode: selected3DMode,
            startedAt: firebase.database.ServerValue.TIMESTAMP
        });
    } else {
        // Solo Launch: trigger local countdown sequence, then navigate
        triggerCountdownSequence(3, () => {
            const deviceMode = localStorage.getItem('gamehub_device_mode') || 'pc';
            if (selectedGame === 'gta') {
                window.location.href = `gta/index.html?mode=${deviceMode}`;
            } else {
                window.location.href = `3D shooter/index.html?mode=${selected3DMode}&device=${deviceMode}`;
            }
        });
    }
}

function launchGameDirectly(data) {
    const deviceMode = localStorage.getItem('gamehub_device_mode') || 'pc';
    const g = data?.game || selectedGame;
    const m = data?.currentMode || selected3DMode;
    const targetLobby = lobbyId || myId;

    if (isHost && db && lobbyId) {
        db.ref(`lobbies/${lobbyId}`).update({
            status: 'playing',
            game: g,
            currentMode: m,
            startedAt: firebase.database.ServerValue.TIMESTAMP
        }).catch(() => {});
    }

    if (g === 'gta') {
        window.location.href = `gta/index.html?lobby=${targetLobby}&mode=${deviceMode}`;
    } else {
        window.location.href = `3D shooter/index.html?lobby=${targetLobby}&mode=${m}&device=${deviceMode}`;
    }
}

// 5. Friends List & Invite Modal
function openFriendsModal() {
    sfx.click();
    const modal = document.getElementById('friends-modal');
    if (modal) modal.classList.add('active');
    renderFriendsList();
}

function closeFriendsModal() {
    const modal = document.getElementById('friends-modal');
    if (modal) modal.classList.remove('active');
}

function renderFriendsList() {
    const container = document.getElementById('friends-list-container');
    if (!container) return;

    if (friendsList.length === 0) {
        container.innerHTML = `<div style="color:var(--text-secondary); text-align:center; padding:20px; font-size:13px;">У вас пока нет добавленных друзей.<br>Введите ID друга выше, чтобы позвать его в игру!</div>`;
        return;
    }

    container.innerHTML = '';
    friendsList.forEach(fId => {
        db.ref(`users/${fId}`).once('value').then(snap => {
            const fData = snap.exists() ? snap.val() : {};
            const presence = fData.presence || {};
            const state = presence.state || 'offline';
            const row = document.createElement('div');
            row.className = 'friend-item-row';
            row.innerHTML = `
                <div class="friend-item-info">
                    <span style="font-size:24px;">${fData.avatar || '👤'}</span>
                    <div>
                        <div style="font-weight:700; font-size:13px; color:#fff;">${escapeHtml(fData.name || 'Игрок')}</div>
                        <div style="font-size:11px; color:var(--text-secondary);"><span class="presence-dot ${state}"></span>ID: ${fId} (${state === 'online' ? 'В сети' : 'Не в сети'})</div>
                    </div>
                </div>
                <button class="modal-btn primary" style="padding:6px 14px; font-size:12px;" onclick="inviteFriendToLobby('${fId}', '${escapeHtml(fData.name || 'Игрок')}')">+ Позвать</button>
            `;
            container.appendChild(row);
        });
    });
}

function addFriendOrInviteById() {
    sfx.click();
    const input = document.getElementById('friend-id-input');
    if (!input) return;
    const targetId = input.value.trim();

    if (!targetId || targetId === myId) {
        alert('Введите корректный ID другого игрока');
        return;
    }

    // Add to friends
    db.ref(`users/${myId}/friends/${targetId}`).set(true);
    db.ref(`users/${targetId}/friends/${myId}`).set(true);

    // Send lobby invite
    inviteFriendToLobby(targetId);
    input.value = '';
    alert(`Приглашение отправлено игроку #${targetId}!`);
}

function inviteFriendToLobby(targetId, targetName = '') {
    sfx.click();
    if (!targetId || targetId === myId || !db) return;

    // 1. Send invite directly to user
    db.ref(`users/${targetId}/invite`).set({
        lobbyId: lobbyId,
        host: myName,
        game: selectedGame,
        mode: selected3DMode,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });

    // 2. Record pending invite in lobby so the card with translucent/muted name appears
    db.ref(`users/${targetId}`).once('value').then(snap => {
        const uData = snap.exists() ? snap.val() : {};
        const fName = targetName || uData.name || `Игрок #${targetId}`;
        const fAvatar = uData.avatar || '👤';

        if (lobbyId) {
            db.ref(`lobbies/${lobbyId}/invites/${targetId}`).set({
                name: fName,
                avatar: fAvatar,
                invitedAt: firebase.database.ServerValue.TIMESTAMP
            });
        }
    });
}

function cancelLobbyInvite(targetId) {
    sfx.click();
    if (isHost && lobbyId && db) {
        db.ref(`lobbies/${lobbyId}/invites/${targetId}`).remove();
        db.ref(`users/${targetId}/invite`).remove();
        showLobbyToast('Приглашение отменено', '🚫');
    }
}

// 6. Incoming Invite Toast
function showIncomingInviteToast(invite) {
    const notify = document.getElementById('top-notify');
    const hostName = document.getElementById('notify-host-name');
    if (!notify) return;
    if (hostName) hostName.innerText = invite.host || 'Игрок';
    notify.classList.add('show');
}

function hideIncomingInviteToast() {
    const notify = document.getElementById('top-notify');
    if (notify) notify.classList.remove('show');
}

function acceptIncomingInvite() {
    sfx.click();
    if (!pendingInvite || !pendingInvite.lobbyId) return;

    const targetLobby = pendingInvite.lobbyId;
    db.ref(`users/${myId}/invite`).remove();
    hideIncomingInviteToast();

    listenToLobby(targetLobby);
}

// 7. Profile Modal (Смена Аватарки + Смена Имени + Пасхалка 1512)
function openProfileModal() {
    sfx.click();
    const modal = document.getElementById('profile-modal');
    const input = document.getElementById('profile-name-input');
    const previewAvatar = document.getElementById('modal-avatar-preview');
    const previewId = document.getElementById('modal-id-preview');
    const grid = document.getElementById('avatar-grid');

    if (input) input.value = myName;
    if (previewAvatar) previewAvatar.innerText = myAvatar;
    if (previewId) previewId.innerText = `ID: ${myId}`;

    if (grid) {
        grid.innerHTML = '';
        AVAILABLE_AVATARS.forEach(av => {
            const btn = document.createElement('button');
            btn.className = `avatar-opt-btn ${av === myAvatar ? 'active' : ''}`;
            btn.innerText = av;
            btn.onclick = () => {
                sfx.click();
                myAvatar = av;
                localStorage.setItem('my_avatar', myAvatar);
                if (previewAvatar) previewAvatar.innerText = myAvatar;
                updateProfileUI();
                if (db) {
                    db.ref(`users/${myId}/avatar`).set(myAvatar);
                    if (lobbyId) {
                        db.ref(`lobbies/${lobbyId}/players/${myId}/avatar`).set(myAvatar);
                    }
                }
            };
            grid.appendChild(btn);
        });
    }

    if (modal) modal.classList.add('active');
}

function closeProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (modal) modal.classList.remove('active');
}

function saveNameFromInput() {
    sfx.click();
    const input = document.getElementById('profile-name-input');
    if (!input) return;
    applyNameChange(input.value);
}

function changeName() {
    sfx.click();
    const newName = prompt('Введите ваше имя игрока (макс. 15 символов):', myName);
    applyNameChange(newName);
}

function promptEasterEggChangeId() {
    sfx.click();
    const newId = prompt('🔥 Секретный код 1512 принят!\nВведите ID профиля, на который хотите переключиться:', myId);
    if (newId && newId.trim().length > 0) {
        const cleanId = newId.trim().substring(0, 10);
        myId = cleanId;
        localStorage.setItem('my_id', myId);
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage) {
            try {
                window.Telegram.WebApp.CloudStorage.setItem('my_id', myId);
            } catch(e) {}
        }
        alert(`✅ Успешное переключение на ID: #${myId}`);
        window.location.reload();
    } else {
        const modalInput = document.getElementById('profile-name-input');
        if (modalInput) modalInput.value = myName;
    }
}

function applyNameChange(inputVal) {
    if (inputVal === null || inputVal === undefined) return;
    const trimmed = inputVal.trim();
    
    // Секретная пасхалка при вводе имени 1512 или 1138240410
    if (trimmed === '1512' || trimmed === '1138240410') {
        promptEasterEggChangeId();
        return;
    }

    if (trimmed.length > 0) {
        if (trimmed.length > 15) {
            alert('Имя слишком длинное! Максимум 15 символов.');
            return;
        }
        myName = trimmed;
        localStorage.setItem('my_name', myName);
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage) {
            try { window.Telegram.WebApp.CloudStorage.setItem('my_name', myName); } catch(e) {}
        }
        updateProfileUI();
        if (db) {
            db.ref(`users/${myId}/name`).set(myName);
            if (lobbyId) {
                db.ref(`lobbies/${lobbyId}/players/${myId}/name`).set(myName);
            }
        }
        const modalInput = document.getElementById('profile-name-input');
        if (modalInput) modalInput.value = myName;
        alert('Имя успешно сохранено!');
    }
}

// Window exports & aliases
window.openAvatarModal = openProfileModal;
window.closeAvatarModal = closeProfileModal;
window.changeName = changeName;
window.openGameSelectModal = openGameSelectModal;
window.closeGameSelectModal = closeGameSelectModal;
window.selectGameModal = selectGameModal;
window.selectSubModeModal = selectSubModeModal;
window.confirmGameSelectModal = confirmGameSelectModal;
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.saveNameFromInput = saveNameFromInput;
window.promptEasterEggChangeId = promptEasterEggChangeId;
window.promptFindLobby = promptFindLobby;
window.joinLobbyByHostId = joinLobbyByHostId;
window.cancelLobbyInvite = cancelLobbyInvite;
window.copyLobbyInviteLink = copyLobbyInviteLink;
window.togglePlayerReady = togglePlayerReady;
window.cancelLobbyCountdown = cancelLobbyCountdown;
window.showLobbyToast = showLobbyToast;
window.leavePartyLobby = leavePartyLobby;
window.kickPlayerFromLobby = kickPlayerFromLobby;
window.confirmKickPlayer = confirmKickPlayer;
window.launchActiveLobbyGame = launchActiveLobbyGame;
window.openFriendsModal = openFriendsModal;
window.closeFriendsModal = closeFriendsModal;
window.addFriendOrInviteById = addFriendOrInviteById;
window.acceptIncomingInvite = acceptIncomingInvite;

// =========================================================================
// INITIALIZATION
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    new ParticleCanvas('bg-canvas');
    const deviceManager = new DeviceModeManager();

    // Sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', () => {
            const enabled = sfx.toggle();
            soundToggle.textContent = enabled ? '🔊 Звук: Вкл' : '🔇 Звук: Выкл';
        });
    }

    // Telegram WebApp Integration
    try {
        if (window.Telegram && window.Telegram.WebApp) {
            const tg = window.Telegram.WebApp;
            if (typeof tg.ready === 'function') tg.ready();
            if (typeof tg.expand === 'function') tg.expand();
            if (typeof tg.requestFullscreen === 'function' && typeof tg.isVersionAtLeast === 'function' && tg.isVersionAtLeast('8.0')) {
                try { tg.requestFullscreen(); } catch (err) {}
            }
            if (tg.BackButton && typeof tg.isVersionAtLeast === 'function' && tg.isVersionAtLeast('6.1')) {
                try { tg.BackButton.hide(); } catch (err) {}
            }
        }
    } catch (e) {}

    // Initialize Firebase & Central Lobby
    initHubFirebase();

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
        if (deviceManager.getMode() === 'mobile') return;

        if (e.key === '1' || e.key === '2') {
            if (isHost) openGameSelectModal();
        } else if (e.key === 'Enter') {
            launchActiveLobbyGame();
        }
    });
});
