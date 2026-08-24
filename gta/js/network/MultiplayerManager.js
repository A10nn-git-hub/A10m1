/**
 * Сетевой менеджер мультиплеера (MultiplayerManager)
 * Отвечает за автоматическое подключение, мгновенную синхронизацию игроков в реальном времени,
 * комнатную архитектуру, чат и транспорт.
 */
class MultiplayerManager {
    constructor(scene) {
        this.scene = scene;
        this.app = null;
        this.database = null;

        this.status = 'OFFLINE'; // 'OFFLINE', 'CONNECTING', 'CONNECTED', 'ERROR'
        this.statusMessage = 'Автономный режим';

        // Генерация уникального ID на каждый экземпляр/вкладку (защита от клонирования sessionStorage)
        this.localPlayerId = this.generatePlayerId();
        this.nickname = FirebaseConfig.getNickname();
        this.roomId = FirebaseConfig.getRoomId();

        this.remotePlayers = new Map(); // playerId -> RemotePlayer
        this.lastPushTime = 0;
        this.pushIntervalMs = 75; // ~13 пакетов в секунду (оптимально для RTDB + 60 FPS LERP интерполяция)

        this.broadcastChannel = null;
        this.storageKey = null;
        this.storageHandler = null;

        this.playersRef = null;
        this.localPlayerRef = null;
        this.chatRef = null;
        this.connectedRef = null;

        this.onStatusChange = null;
        this.onChatMessageReceived = null;
        this.onPlayersUpdated = null;

        this.boundBeforeUnload = () => {
            this.disconnect();
        };
        window.addEventListener('beforeunload', this.boundBeforeUnload);

        this.init();
    }

    generatePlayerId() {
        // Уникальный ID для каждой запущенной сессии/вкладки
        const rand = Math.random().toString(36).substring(2, 8);
        const timePart = Date.now().toString(36).substring(4);
        return `usr_${rand}_${timePart}`;
    }

    init() {
        this.status = 'OFFLINE';
        this.statusMessage = 'Готов к подключению (Автономный режим)';
    }

    /**
     * Подключиться к сетевой сессии
     */
    connect(config = null, nickname = null, roomId = null) {
        if (nickname) {
            this.nickname = nickname.trim().substring(0, 18) || this.nickname;
            FirebaseConfig.saveNickname(this.nickname);
        }
        if (roomId) {
            this.roomId = FirebaseConfig.sanitizeRoomId(roomId);
            FirebaseConfig.saveRoomId(this.roomId);
        }

        this.disconnect();
        this.updateStatus('CONNECTING', 'Подключение к комнате...');

        try {
            // 1. Инициализация локального / кросс-вкладочного высокоскоростного канала
            this.initLocalTransport();

            // 2. Инициализация Firebase Realtime Database
            this.initFirebaseTransport(config);

            // 3. Отправка приветственного пакета в локальный канал
            this.broadcastPacket({
                type: 'JOIN',
                pid: this.localPlayerId,
                data: {
                    nickname: this.nickname,
                    x: 0, y: 1.5, z: 15.0,
                    rotY: 0,
                    health: 100
                }
            });

            // Страховочный таймер подтверждения подключения
            setTimeout(() => {
                if (this.status === 'CONNECTING') {
                    this.updateStatus('CONNECTED', `В сети [Комната: ${this.roomId}]`);
                    this.sendLocalStateNow();
                }
            }, 1200);

            return true;
        } catch (err) {
            console.error('[Multiplayer] Ошибка подключения:', err);
            this.updateStatus('CONNECTED', `В сети [Комната: ${this.roomId}]`);
            return true;
        }
    }

    initLocalTransport() {
        const channelName = `gta_mp_room_${this.roomId}`;
        this.storageKey = `gta_mp_pkt_${this.roomId}`;

        // BroadcastChannel API (для мгновенного обмена между вкладками в одном браузере)
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                this.broadcastChannel = new BroadcastChannel(channelName);
                this.broadcastChannel.onmessage = (event) => {
                    this.handleIncomingPacket(event.data);
                };
            } catch (e) {
                console.warn('[Multiplayer] BroadcastChannel недоступен:', e);
            }
        }

        // Storage Event Fallback
        this.storageHandler = (e) => {
            if (e.key === this.storageKey && e.newValue) {
                try {
                    const packet = JSON.parse(e.newValue);
                    this.handleIncomingPacket(packet);
                } catch (err) {}
            }
        };
        window.addEventListener('storage', this.storageHandler);
    }

    initFirebaseTransport(config) {
        if (typeof firebase === 'undefined') {
            console.warn('[Multiplayer] Firebase SDK не обнаружен. Работает в локальном режиме.');
            this.updateStatus('CONNECTED', `В сети [Комната: ${this.roomId}]`);
            return;
        }

        const activeConfig = config || FirebaseConfig.getConfig();
        if (!activeConfig || !activeConfig.databaseURL) {
            this.updateStatus('CONNECTED', `В сети [Комната: ${this.roomId}]`);
            return;
        }

        try {
            if (!firebase.apps || firebase.apps.length === 0) {
                this.app = firebase.initializeApp(activeConfig);
            } else {
                this.app = firebase.apps[0];
            }

            if (firebase.auth) {
                try {
                    firebase.auth().signInAnonymously().catch((e) => {
                        console.warn('[Multiplayer] Anonymous auth notice:', e.message || e);
                    });
                } catch (e) {}
            }

            this.database = firebase.database();
            const rootPath = `gta_rooms/${this.roomId}`;

            this.playersRef = this.database.ref(`${rootPath}/players`);
            this.localPlayerRef = this.database.ref(`${rootPath}/players/${this.localPlayerId}`);
            this.chatRef = this.database.ref(`${rootPath}/chat`);
            this.connectedRef = this.database.ref('.info/connected');

            this.connectedRef.on('value', (snap) => {
                const isOnline = snap.val() === true;
                if (isOnline) {
                    this.updateStatus('CONNECTED', `В сети [Комната: ${this.roomId}]`);
                    if (this.localPlayerRef) {
                        this.localPlayerRef.onDisconnect().remove();
                    }
                    this.sendLocalStateNow();
                } else if (this.status !== 'OFFLINE') {
                    this.updateStatus('CONNECTING', 'Связь с сервером...');
                }
            });

            this.playersRef.on('child_added', (snapshot) => {
                const pid = snapshot.key;
                if (pid === this.localPlayerId) return;
                const data = snapshot.val();
                this.handlePlayerState(pid, data);
                // Отправляем свое актуальное состояние новому игроку
                this.sendLocalStateNow();
            }, (err) => {
                console.error('[Multiplayer] Firebase playersRef child_added error:', err);
            });

            this.playersRef.on('child_changed', (snapshot) => {
                const pid = snapshot.key;
                if (pid === this.localPlayerId) return;
                const data = snapshot.val();
                this.handlePlayerState(pid, data);
            }, (err) => {
                console.error('[Multiplayer] Firebase playersRef child_changed error:', err);
            });

            this.playersRef.on('child_removed', (snapshot) => {
                const pid = snapshot.key;
                if (pid === this.localPlayerId) return;
                this.removeRemotePlayer(pid);
            }, (err) => {
                console.error('[Multiplayer] Firebase playersRef child_removed error:', err);
            });

            this.chatRef.limitToLast(25).on('child_added', (snapshot) => {
                const msg = snapshot.val();
                if (!msg || msg.senderId === this.localPlayerId) return;
                if (this.onChatMessageReceived) {
                    this.onChatMessageReceived(msg);
                }
                const remote = this.remotePlayers.get(msg.senderId);
                if (remote && msg.text) {
                    remote.setChatMessage(msg.text);
                }
            }, (err) => {
                console.error('[Multiplayer] Firebase chatRef error:', err);
            });

            // Первичная запись локального состояния
            this.sendLocalStateNow();

        } catch (e) {
            console.warn('[Multiplayer] Firebase initialization notice:', e);
            this.updateStatus('CONNECTED', `В сети [Комната: ${this.roomId}]`);
        }
    }

    broadcastPacket(packet) {
        if (!packet) return;

        if (this.broadcastChannel) {
            try {
                this.broadcastChannel.postMessage(packet);
            } catch (e) {}
        }

        if (this.storageKey) {
            try {
                localStorage.setItem(this.storageKey, JSON.stringify({ ...packet, _ts: Date.now() }));
            } catch (e) {}
        }
    }

    handleIncomingPacket(packet) {
        if (!packet || typeof packet !== 'object') return;
        const { type, pid, data } = packet;
        if (!pid || pid === this.localPlayerId) return;

        if (type === 'JOIN') {
            this.handlePlayerState(pid, data);
            this.sendLocalStateNow();
        } else if (type === 'STATE') {
            this.handlePlayerState(pid, data);
        } else if (type === 'CHAT') {
            if (this.onChatMessageReceived) {
                this.onChatMessageReceived(data);
            }
            const remote = this.remotePlayers.get(pid);
            if (remote && data && data.text) {
                remote.setChatMessage(data.text);
            }
        } else if (type === 'LEAVE') {
            this.removeRemotePlayer(pid);
        }
    }

    handlePlayerState(pid, data) {
        if (!pid || pid === this.localPlayerId || !data) return;

        let remote = this.remotePlayers.get(pid);
        if (!remote) {
            remote = new RemotePlayer(this.scene, pid, data);
            remote.lastSeen = Date.now();
            this.remotePlayers.set(pid, remote);
            if (this.onPlayersUpdated) this.onPlayersUpdated(this.getRemotePlayersArray());
            if (window.gameEngine && window.gameEngine.multiplayerHUD) {
                window.gameEngine.multiplayerHUD.addSystemMessage(`👋 Игрок "${remote.nickname}" присоединился к сессии!`);
            }
        } else {
            remote.lastSeen = Date.now();
            remote.applyNetworkState(data);
        }
    }

    removeRemotePlayer(pid) {
        const remote = this.remotePlayers.get(pid);
        if (remote) {
            const name = remote.nickname;
            remote.destroy();
            this.remotePlayers.delete(pid);
            if (this.onPlayersUpdated) this.onPlayersUpdated(this.getRemotePlayersArray());
            if (window.gameEngine && window.gameEngine.multiplayerHUD) {
                window.gameEngine.multiplayerHUD.addSystemMessage(`🚪 Игрок "${name}" покинул сессию.`);
            }
        }
    }

    sendLocalStateNow() {
        if (this.status !== 'CONNECTED' && this.status !== 'CONNECTING') return;
        const player = window.gameEngine?.player;
        const playerController = window.gameEngine?.playerController;
        const vehicleManager = window.gameEngine?.vehicleManager;

        if (!player || !player.mesh) return;

        const isDriving = vehicleManager && vehicleManager.activeDrivenCar !== null;
        const activeCar = isDriving ? vehicleManager.activeDrivenCar : null;

        const pos = isDriving && activeCar
            ? activeCar.chassisBody.position
            : (player.body ? player.body.position : player.mesh.position);

        const rotY = isDriving && activeCar
            ? activeCar.group.rotation.y
            : player.mesh.rotation.y;

        const payload = {
            nickname: this.nickname,
            x: Math.round(pos.x * 100) / 100,
            y: Math.round(pos.y * 100) / 100,
            z: Math.round(pos.z * 100) / 100,
            rotY: Math.round(rotY * 100) / 100,
            speed: 0,
            walkCycle: 0,
            isSprinting: false,
            isDriving: isDriving,
            vehicleId: isDriving && activeCar ? (activeCar.name || 'car') : null,
            health: playerController ? Math.round(playerController.health) : 100,
            weaponIndex: 0,
            lastSeen: Date.now()
        };

        this.broadcastPacket({
            type: 'STATE',
            pid: this.localPlayerId,
            data: payload
        });

        if (this.localPlayerRef) {
            try {
                this.localPlayerRef.set(payload).catch((err) => {
                    console.warn('[Multiplayer] localPlayerRef.set warning:', err);
                });
            } catch (e) {}
        }
    }

    /**
     * Отключиться от мультиплеера
     */
    disconnect() {
        if (this.status === 'CONNECTED') {
            this.broadcastPacket({
                type: 'LEAVE',
                pid: this.localPlayerId
            });
        }

        if (this.broadcastChannel) {
            try { this.broadcastChannel.close(); } catch (e) {}
            this.broadcastChannel = null;
        }

        if (this.storageHandler) {
            window.removeEventListener('storage', this.storageHandler);
            this.storageHandler = null;
        }

        if (this.localPlayerRef) {
            try { this.localPlayerRef.remove(); } catch (e) {}
            this.localPlayerRef = null;
        }
        if (this.playersRef) {
            try { this.playersRef.off(); } catch (e) {}
            this.playersRef = null;
        }
        if (this.chatRef) {
            try { this.chatRef.off(); } catch (e) {}
            this.chatRef = null;
        }
        if (this.connectedRef) {
            try { this.connectedRef.off(); } catch (e) {}
            this.connectedRef = null;
        }

        // Удалить всех сетевых игроков
        this.remotePlayers.forEach((p) => p.destroy());
        this.remotePlayers.clear();

        this.updateStatus('OFFLINE', 'Отключено (Автономный режим)');
        if (this.onPlayersUpdated) this.onPlayersUpdated([]);
    }

    updateStatus(status, message) {
        this.status = status;
        this.statusMessage = message;
        if (this.onStatusChange) {
            this.onStatusChange(status, message);
        }
    }

    /**
     * Отправить сообщение в игровой чат
     */
    sendChatMessage(text) {
        if (!text || text.trim().length === 0) return false;
        const clean = text.trim().substring(0, 140);

        const msg = {
            senderId: this.localPlayerId,
            senderName: this.nickname,
            text: clean,
            timestamp: Date.now()
        };

        // Локальное добавление в чат
        if (this.onChatMessageReceived) {
            this.onChatMessageReceived(msg);
        }

        // Отправка по локальному/кросс-вкладочному каналу
        this.broadcastPacket({
            type: 'CHAT',
            pid: this.localPlayerId,
            data: msg
        });

        // Отправка в Firebase
        if (this.chatRef) {
            try {
                this.chatRef.push(msg);
            } catch (e) {}
        }

        return true;
    }

    /**
     * Главный цикл синхронизации (вызывается в animate())
     */
    update(deltaTime, player, playerController, vehicleManager) {
        const now = Date.now();

        // 1. Обновление всех удаленных игроков и проверка таймаута (12 сек отсутствия пакетов)
        const deadIds = [];
        this.remotePlayers.forEach((remote, pid) => {
            remote.update(deltaTime);
            if (now - (remote.lastSeen || 0) > 12000) {
                deadIds.push(pid);
            }
        });

        if (deadIds.length > 0) {
            deadIds.forEach((pid) => this.removeRemotePlayer(pid));
        }

        // 2. Отправка состояния локального игрока (~13 Hz)
        if (this.status !== 'CONNECTED' || !player || !player.mesh) {
            return;
        }

        if (now - this.lastPushTime >= this.pushIntervalMs) {
            this.lastPushTime = now;

            const isDriving = vehicleManager && vehicleManager.activeDrivenCar !== null;
            const activeCar = isDriving ? vehicleManager.activeDrivenCar : null;

            const pos = isDriving && activeCar
                ? activeCar.chassisBody.position
                : (player.body ? player.body.position : player.mesh.position);

            const rotY = isDriving && activeCar
                ? activeCar.group.rotation.y
                : player.mesh.rotation.y;

            const speed = player.body
                ? Math.hypot(player.body.velocity.x, player.body.velocity.z)
                : 0;

            const walkCycle = (playerController && playerController.animSystem)
                ? playerController.animSystem.walkCycle
                : 0;

            const isSprinting = playerController ? !!playerController.input.keys.sprint : false;
            const health = playerController ? Math.round(playerController.health) : 100;
            const weaponIdx = (window.gameEngine && window.gameEngine.weaponSystem)
                ? window.gameEngine.weaponSystem.currentWeaponIndex
                : 0;

            const payload = {
                nickname: this.nickname,
                x: Math.round(pos.x * 100) / 100,
                y: Math.round(pos.y * 100) / 100,
                z: Math.round(pos.z * 100) / 100,
                rotY: Math.round(rotY * 100) / 100,
                speed: Math.round(speed * 10) / 10,
                walkCycle: Math.round(walkCycle * 100) / 100,
                isSprinting: isSprinting,
                isDriving: isDriving,
                vehicleId: isDriving && activeCar ? (activeCar.name || 'car') : null,
                health: health,
                weaponIndex: weaponIdx,
                lastSeen: now
            };

            this.broadcastPacket({
                type: 'STATE',
                pid: this.localPlayerId,
                data: payload
            });

            if (this.localPlayerRef) {
                try {
                    this.localPlayerRef.set(payload).catch(() => {});
                } catch (e) {}
            }
        }
    }

    getRemotePlayersArray() {
        const arr = [];
        this.remotePlayers.forEach((p, id) => {
            arr.push({
                id: id,
                nickname: p.nickname,
                health: p.health,
                x: p.currentPos.x,
                y: p.currentPos.y,
                z: p.currentPos.z,
                isDriving: p.isDriving
            });
        });
        return arr;
    }
}

window.MultiplayerManager = MultiplayerManager;

