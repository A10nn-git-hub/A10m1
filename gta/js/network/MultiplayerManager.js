/**
 * Сетевой менеджер мультиплеера (MultiplayerManager)
 * Отвечает за подключение к Firebase Realtime Database, синхронизацию игроков в реальном времени,
 * комнатную архитектуру, чат и транспорт.
 */
class MultiplayerManager {
    constructor(scene) {
        this.scene = scene;
        this.app = null;
        this.database = null;

        this.status = 'OFFLINE'; // 'OFFLINE', 'CONNECTING', 'CONNECTED', 'ERROR'
        this.statusMessage = 'Автономный режим';

        this.localPlayerId = this.generatePlayerId();
        this.nickname = FirebaseConfig.getNickname();
        this.roomId = FirebaseConfig.getRoomId();

        this.remotePlayers = new Map(); // playerId -> RemotePlayer
        this.lastPushTime = 0;
        this.pushIntervalMs = 55; // ~18 пакетов в секунду (оптимально для Firebase Quotas & 60 FPS)

        this.playersRef = null;
        this.localPlayerRef = null;
        this.chatRef = null;
        this.connectedRef = null;

        this.ping = 0;
        this.lastPingSent = 0;
        this.onStatusChange = null;
        this.onChatMessageReceived = null;
        this.onPlayersUpdated = null;

        this.init();
    }

    generatePlayerId() {
        const stored = sessionStorage.getItem('gta_multiplayer_pid');
        if (stored) return stored;
        const newId = 'usr_' + Math.random().toString(36).substring(2, 10);
        try { sessionStorage.setItem('gta_multiplayer_pid', newId); } catch (e) {}
        return newId;
    }

    init() {
        // Проверяем наличие подключенного Firebase SDK
        if (typeof firebase === 'undefined') {
            this.status = 'OFFLINE';
            this.statusMessage = 'Firebase SDK не загружен (Offline)';
            console.warn('[Multiplayer] Firebase SDK не обнаружен на странице.');
            return;
        }

        const config = FirebaseConfig.getConfig();
        if (config && config.databaseURL && !config.databaseURL.includes('default-rtdb.firebaseio.com')) {
            // Если указана реальная база данных — подключаемся сразу
            this.connect(config, this.nickname, this.roomId);
        } else {
            this.status = 'OFFLINE';
            this.statusMessage = 'Готов к подключению (Нажмите Мультиплеер)';
        }
    }

    /**
     * Подключиться к Firebase Realtime Database
     */
    connect(config = null, nickname = null, roomId = null) {
        if (typeof firebase === 'undefined') {
            this.updateStatus('ERROR', 'Firebase SDK не найден');
            return false;
        }

        const activeConfig = config || FirebaseConfig.getConfig();
        if (!activeConfig || !activeConfig.databaseURL) {
            this.updateStatus('ERROR', 'Не задан databaseURL');
            return false;
        }

        if (nickname) {
            this.nickname = nickname;
            FirebaseConfig.saveNickname(nickname);
        }
        if (roomId) {
            this.roomId = roomId;
            FirebaseConfig.saveRoomId(roomId);
        }

        this.disconnect();
        this.updateStatus('CONNECTING', 'Подключение к Firebase...');

        try {
            // Инициализация приложения Firebase (синглтон)
            if (!firebase.apps || firebase.apps.length === 0) {
                this.app = firebase.initializeApp(activeConfig);
            } else {
                this.app = firebase.apps[0];
            }

            this.database = firebase.database();
            const rootPath = `rooms/${this.roomId}`;

            this.playersRef = this.database.ref(`${rootPath}/players`);
            this.localPlayerRef = this.database.ref(`${rootPath}/players/${this.localPlayerId}`);
            this.chatRef = this.database.ref(`${rootPath}/chat`);
            this.connectedRef = this.database.ref('.info/connected');

            // 1. Обработка статуса соединения и автоматического удаления при отключении
            this.connectedRef.on('value', (snap) => {
                if (snap.val() === true) {
                    this.updateStatus('CONNECTED', `В сети [Комната: ${this.roomId}]`);
                    // При обрыве связи или закрытии вкладки удаляем персонажа из базы
                    this.localPlayerRef.onDisconnect().remove();

                    // Отправляем первое приветственное присутствие
                    this.localPlayerRef.set({
                        nickname: this.nickname,
                        x: 0, y: 1.5, z: 15.0,
                        rotY: 0,
                        health: 100,
                        connectedAt: firebase.database.ServerValue.TIMESTAMP,
                        lastSeen: firebase.database.ServerValue.TIMESTAMP
                    });
                } else {
                    if (this.status === 'CONNECTED') {
                        this.updateStatus('CONNECTING', 'Восстановление связи...');
                    }
                }
            });

            // 2. Слушатели списка игроков в комнате
            this.playersRef.on('child_added', (snapshot) => {
                const pid = snapshot.key;
                if (pid === this.localPlayerId) return;
                const data = snapshot.val();
                if (!this.remotePlayers.has(pid)) {
                    const remote = new RemotePlayer(this.scene, pid, data);
                    this.remotePlayers.set(pid, remote);
                    if (this.onPlayersUpdated) this.onPlayersUpdated(this.getRemotePlayersArray());
                    if (window.gameEngine && window.gameEngine.multiplayerHUD) {
                        window.gameEngine.multiplayerHUD.addSystemMessage(`👋 Игрок "${remote.nickname}" присоединился к сессии!`);
                    }
                }
            });

            this.playersRef.on('child_changed', (snapshot) => {
                const pid = snapshot.key;
                if (pid === this.localPlayerId) return;
                const data = snapshot.val();
                let remote = this.remotePlayers.get(pid);
                if (!remote) {
                    remote = new RemotePlayer(this.scene, pid, data);
                    this.remotePlayers.set(pid, remote);
                    if (this.onPlayersUpdated) this.onPlayersUpdated(this.getRemotePlayersArray());
                } else {
                    remote.applyNetworkState(data);
                }
            });

            this.playersRef.on('child_removed', (snapshot) => {
                const pid = snapshot.key;
                if (pid === this.localPlayerId) return;
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
            });

            // 3. Слушатель чата (последние 20 сообщений)
            this.chatRef.limitToLast(20).on('child_added', (snapshot) => {
                const msg = snapshot.val();
                if (!msg) return;

                // Если отправил удаленный игрок — показываем баббл над его головой
                if (msg.senderId && msg.senderId !== this.localPlayerId) {
                    const remote = this.remotePlayers.get(msg.senderId);
                    if (remote) {
                        remote.setChatMessage(msg.text);
                    }
                }

                if (this.onChatMessageReceived) {
                    this.onChatMessageReceived(msg);
                }
            });

            return true;
        } catch (err) {
            console.error('[Multiplayer] Ошибка подключения:', err);
            this.updateStatus('ERROR', `Ошибка: ${err.message || err}`);
            return false;
        }
    }

    /**
     * Отключиться от мультиплеера
     */
    disconnect() {
        if (this.localPlayerRef) {
            this.localPlayerRef.remove().catch(() => {});
        }
        if (this.playersRef) this.playersRef.off();
        if (this.chatRef) this.chatRef.off();
        if (this.connectedRef) this.connectedRef.off();

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

        if (this.status !== 'CONNECTED' || !this.chatRef) {
            // Локальный эхо-чат для оффлайн режима
            if (this.onChatMessageReceived) {
                this.onChatMessageReceived({
                    senderId: this.localPlayerId,
                    senderName: this.nickname,
                    text: clean,
                    timestamp: Date.now()
                });
            }
            return true;
        }

        try {
            this.chatRef.push({
                senderId: this.localPlayerId,
                senderName: this.nickname,
                text: clean,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
            return true;
        } catch (e) {
            console.error('[Multiplayer] Ошибка отправки сообщения:', e);
            return false;
        }
    }

    /**
     * Главный цикл синхронизации (вызывается в animate())
     */
    update(deltaTime, player, playerController, vehicleManager) {
        // 1. Обновление всех удаленных игроков
        this.remotePlayers.forEach((remote) => {
            remote.update(deltaTime);
        });

        // 2. Отправка состояния локального игрока в Firebase (20 Hz)
        if (this.status !== 'CONNECTED' || !this.localPlayerRef || !player || !player.mesh) {
            return;
        }

        const now = Date.now();
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
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            };

            this.localPlayerRef.update(payload).catch((e) => {
                // Игнорируем кратковременные сетевые пропуски
            });
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
