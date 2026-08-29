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
        this.pushIntervalMs = 50; // ~20 пакетов в секунду (как в competitive мобильных шутерах Standoff 2)

        this.broadcastChannel = null;
        this.storageKey = null;
        this.storageHandler = null;

        this.playersRef = null;
        this.localPlayerRef = null;
        this.chatRef = null;
        this.elevatorRef = null;
        this.propsRef = null;
        this.vehiclesRef = null;
        this.heliRef = null;
        this.connectedRef = null;
        this.lastVehiclePushTime = 0;

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
        this.updateOnlineHud();
    }

    updateOnlineHud() {
        const elCount = document.getElementById('hud-online-count');
        const elRoom = document.getElementById('hud-online-room');
        if (!elCount) return;

        const count = 1 + (this.remotePlayers ? this.remotePlayers.size : 0);
        if (count === 1) {
            elCount.textContent = '1 онлайн (Вы)';
        } else {
            elCount.textContent = `${count} в сети`;
        }

        if (elRoom) {
            const cleanRoom = this.roomId ? this.roomId.replace(/^lobby_/, '').replace(/^room_/, '') : '';
            if (cleanRoom && cleanRoom !== 'public_free_roam' && cleanRoom !== 'los_santos_main' && !cleanRoom.startsWith('police_')) {
                elRoom.textContent = `• Лобби #${cleanRoom}`;
            } else {
                const hubId = localStorage.getItem('my_id');
                elRoom.textContent = hubId ? `• Лобби #${hubId}` : '';
            }
        }
    }

    /**
     * Подключиться к сетевой сессии (лобби)
     */
    connect(config = null, nickname = null, roomId = null) {
        if (nickname && typeof nickname === 'string') {
            this.nickname = nickname.trim().substring(0, 18) || this.nickname;
            FirebaseConfig.saveNickname(this.nickname);
        }
        if (roomId && typeof roomId === 'string') {
            this.roomId = FirebaseConfig.sanitizeRoomId(roomId);
            FirebaseConfig.saveRoomId(this.roomId);
        }

        this.updateOnlineHud();

        // Полное отключение от предыдущей комнаты
        this.disconnect();
        this.updateStatus('CONNECTING', `Подключение к комнате [${this.roomId}]...`);

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
            }, 1000);

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
            this.propsRef = this.database.ref(`${rootPath}/props`);
            this.vehiclesRef = this.database.ref(`${rootPath}/vehicles`);
            this.heliRef = this.database.ref(`${rootPath}/helicopter`);
            this.connectedRef = this.database.ref('.info/connected');

            // Поддержание глобального присутствия в центральном хабе
            const myHubId = localStorage.getItem('my_id');
            const cleanLobby = this.roomId ? this.roomId.replace(/^lobby_/, '') : (myHubId || 'los_santos_main');
            if (myHubId) {
                const hubPresRef = this.database.ref(`users/${myHubId}/presence`);
                const hubLobbyRef = this.database.ref(`lobbies/${myHubId}`);
                hubPresRef.set({
                    state: 'online',
                    game: 'gta',
                    lobbyId: cleanLobby,
                    lastSeenAt: firebase.database.ServerValue.TIMESTAMP
                }).catch(() => {});
                hubPresRef.onDisconnect().set({
                    state: 'offline',
                    lastSeenAt: firebase.database.ServerValue.TIMESTAMP
                }).catch(() => {});
                hubLobbyRef.update({
                    status: 'playing',
                    game: 'gta',
                    host: myHubId,
                    startedAt: firebase.database.ServerValue.TIMESTAMP
                }).catch(() => {});
            }

            // Обработка статуса подключения
            this.connectedRef.on('value', (snap) => {
                const isOnline = snap.val() === true;
                if (isOnline) {
                    this.updateStatus('CONNECTED', `В сети [Комната: ${this.roomId}]`);
                    if (this.localPlayerRef) {
                        try {
                            this.localPlayerRef.onDisconnect().remove();
                        } catch (e) {}
                    }
                    // Автоочистка данных вертолетов, слияния и транспорта при неожиданном закрытии вкладки
                    if (this.heliRef) {
                        try { this.heliRef.onDisconnect().remove(); } catch (e) {}
                    }
                    if (this.heliMergeRef) {
                        try { this.heliMergeRef.onDisconnect().remove(); } catch (e) {}
                    }
                    if (this.vehiclesRef) {
                        try { this.vehiclesRef.onDisconnect().remove(); } catch (e) {}
                    }
                    this.sendLocalStateNow();
                }
            });

            // Очистка устаревших данных из прошлых сессий при подключении (helicopter/, heli_merge/)
            this._cleanupStaleGameState(rootPath);

            // Слушатель появления новых игроков в комнате
            this.playersRef.on('child_added', (snapshot) => {
                const pid = snapshot.key;
                if (!pid || pid === this.localPlayerId) return;
                const data = snapshot.val();
                if (!data) return;
                this.handlePlayerState(pid, data);
                // Отправляем свое актуальное состояние новому игроку
                this.sendLocalStateNow();
            }, (err) => {
                console.error('[Multiplayer] Firebase playersRef child_added error:', err);
            });

            // Слушатель обновления состояния существующих игроков
            this.playersRef.on('child_changed', (snapshot) => {
                const pid = snapshot.key;
                if (!pid || pid === this.localPlayerId) return;
                const data = snapshot.val();
                if (!data) return;
                this.handlePlayerState(pid, data);
            }, (err) => {
                console.error('[Multiplayer] Firebase playersRef child_changed error:', err);
            });

            // Слушатель выхода игроков из комнаты
            this.playersRef.on('child_removed', (snapshot) => {
                const pid = snapshot.key;
                if (!pid || pid === this.localPlayerId) return;
                this.removeRemotePlayer(pid);
            }, (err) => {
                console.error('[Multiplayer] Firebase playersRef child_removed error:', err);
            });

            // Синхронизация лифта небоскреба Maze Bank
            this.elevatorRef = this.database.ref(`${rootPath}/elevator`);
            this.elevatorRef.on('value', (snapshot) => {
                const ev = snapshot.val();
                if (ev && ev.callerId !== this.localPlayerId && ev.floorNum && window.gameEngine && window.gameEngine.elevatorSystem) {
                    window.gameEngine.elevatorSystem.receiveNetworkElevatorCommand(ev.floorNum);
                }
            });

            // Синхронизация сбитых фонарей, гидрантов, заборов, урн и скамеек
            this.propsRef.on('child_added', (snapshot) => {
                const propId = parseInt(snapshot.key);
                const data = snapshot.val();
                const isRecent = data && data.ts && (Date.now() - data.ts < 4000);
                if (data && !isNaN(propId) && window.gameEngine && window.gameEngine.streetLampManager) {
                    window.gameEngine.streetLampManager.receiveNetworkBreakProp(propId, data.vx || 0, data.vy || 4, data.vz || 0, !!isRecent);
                }
            }, (err) => {
                console.error('[Multiplayer] Firebase propsRef error:', err);
            });

            // Синхронизация сбитых деревьев
            this.treesRef = this.database.ref(`${rootPath}/trees`);
            this.treesRef.on('child_added', (snapshot) => {
                const treeId = parseInt(snapshot.key);
                const data = snapshot.val();
                if (data && !isNaN(treeId) && data.topplerId !== this.localPlayerId && window.gameEngine && window.gameEngine.vegetationManager) {
                    const vm = window.gameEngine.vegetationManager;
                    const tree = vm.treePositions ? vm.treePositions[treeId] : null;
                    if (tree && !tree.isFallen) {
                        vm.toppleTree(tree, { x: data.dirX || 0, z: data.dirZ || 1 }, true);
                    }
                }
            }, (err) => {
                console.error('[Multiplayer] Firebase treesRef error:', err);
            });

            // Синхронизация слияния вертолетов
            this.heliMergeRef = this.database.ref(`${rootPath}/heli_merge`);
            this.heliMergeRef.on('value', (snapshot) => {
                const data = snapshot.val();
                // Игнорируем устаревшие данные (старше 30 секунд) — защита от "призрачного" слияния из прошлой сессии
                if (data && data.ts && (Date.now() - data.ts > 30000)) return;
                if (data && data.mergerId !== this.localPlayerId && window.gameEngine && window.gameEngine.helicopters) {
                    const helis = window.gameEngine.helicopters;
                    const masterHeli = helis[data.masterHeliIndex !== undefined ? data.masterHeliIndex : 0];
                    const partnerHeli = helis[data.partnerHeliIndex !== undefined ? data.partnerHeliIndex : 1];
                    if (masterHeli && partnerHeli && !partnerHeli.isMerged && !partnerHeli.isBeingMerged) {
                        // Level 3 (Titan): master уже isMega, нужно обойти проверку mergeState !== 'MEGA'
                        if (data.mergeLevel === 3 && masterHeli.isMega) {
                            masterHeli.mergeState = 'MEGA'; // разрешить переход MEGA -> TITAN
                            masterHeli.startMergeWith(partnerHeli, true);
                        } else if (!masterHeli.isMerged && masterHeli.mergeState !== 'MEGA') {
                            masterHeli.startMergeWith(partnerHeli, true);
                        }
                    }
                }
            }, (err) => {
                console.error('[Multiplayer] Firebase heliMergeRef error:', err);
            });

            // Синхронизация местоположения автомобилей автопарка
            const handleVehicleSync = (snapshot) => {
                const carIndex = parseInt(snapshot.key);
                const data = snapshot.val();
                if (data && !isNaN(carIndex) && data.driverId !== this.localPlayerId) {
                    this.updateCarFromNetwork(carIndex, data);
                }
            };
            this.vehiclesRef.on('child_added', handleVehicleSync);
            this.vehiclesRef.on('child_changed', handleVehicleSync);

            // Синхронизация вертолетов Maverick
            const handleHeliSync = (snapshot) => {
                const data = snapshot.val();
                // Игнорируем устаревшие данные (старше 30 секунд) — защита от "призрачных" вертолетов из прошлой сессии
                if (data && data.ts && (Date.now() - data.ts > 30000)) return;
                if (data && data.pilotId !== this.localPlayerId) {
                    this.updateHeliFromNetwork(data);
                }
            };
            this.heliRef.on('child_added', handleHeliSync);
            this.heliRef.on('child_changed', handleHeliSync);

            // Синхронизация чата
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
    /**
     * Очистка устаревших данных игрового состояния из Firebase при подключении.
     * Удаляет вертолеты, слияния и транспорт, если их timestamp старше 30 секунд.
     * Это предотвращает появление "призрачных" вертолетов, зависших в воздухе из прошлых сессий.
     */
    _cleanupStaleGameState(rootPath) {
        if (!this.database) return;
        const staleThreshold = 30000; // 30 секунд
        const now = Date.now();

        // Очистка устаревших данных вертолетов
        const heliCleanRef = this.database.ref(`${rootPath}/helicopter`);
        heliCleanRef.once('value', (snapshot) => {
            const data = snapshot.val();
            if (!data) return;
            let allStale = true;
            Object.keys(data).forEach((key) => {
                const entry = data[key];
                if (entry && entry.ts && (now - entry.ts > staleThreshold)) {
                    heliCleanRef.child(key).remove().catch(() => {});
                } else if (entry && entry.ts) {
                    allStale = false;
                }
            });
            if (allStale && Object.keys(data).length > 0) {
                heliCleanRef.remove().catch(() => {});
            }
        }).catch(() => {});

        // Очистка устаревшего слияния
        const mergeCleanRef = this.database.ref(`${rootPath}/heli_merge`);
        mergeCleanRef.once('value', (snapshot) => {
            const data = snapshot.val();
            if (data && data.ts && (now - data.ts > staleThreshold)) {
                mergeCleanRef.remove().catch(() => {});
            }
        }).catch(() => {});

        // Очистка устаревших данных транспорта
        const vehCleanRef = this.database.ref(`${rootPath}/vehicles`);
        vehCleanRef.once('value', (snapshot) => {
            const data = snapshot.val();
            if (!data) return;
            Object.keys(data).forEach((key) => {
                const entry = data[key];
                if (entry && entry.ts && (now - entry.ts > staleThreshold)) {
                    vehCleanRef.child(key).remove().catch(() => {});
                }
            });
        }).catch(() => {});
    }

    broadcastElevatorCall(floorNum) {
        this.broadcastPacket({
            type: 'ELEVATOR',
            pid: this.localPlayerId,
            data: { floorNum }
        });

        if (this.database && this.roomId) {
            try {
                this.database.ref(`gta_rooms/${this.roomId}/elevator`).set({
                    floorNum: floorNum,
                    callerId: this.localPlayerId,
                    ts: Date.now()
                }).catch(() => {});
            } catch (e) {}
        }
    }

    broadcastPropBreak(propId, vx, vy, vz) {
        if (propId === undefined) return;
        const data = {
            propId,
            vx: Math.round((vx || 0) * 10) / 10,
            vy: Math.round((vy || 4) * 10) / 10,
            vz: Math.round((vz || 0) * 10) / 10,
            ts: Date.now()
        };
        this.broadcastPacket({
            type: 'PROP_BREAK',
            pid: this.localPlayerId,
            data
        });
        if (this.propsRef) {
            try {
                this.propsRef.child(String(propId)).set(data).catch(() => {});
            } catch (e) {}
        }
    }

    broadcastTreeTopple(treeId, dirX, dirZ) {
        if (treeId === undefined) return;
        const data = {
            treeId,
            dirX: Math.round((dirX || 0) * 100) / 100,
            dirZ: Math.round((dirZ || 1) * 100) / 100,
            topplerId: this.localPlayerId,
            ts: Date.now()
        };
        this.broadcastPacket({
            type: 'TREE_TOPPLE',
            pid: this.localPlayerId,
            data
        });
        if (this.treesRef) {
            try {
                this.treesRef.child(String(treeId)).set(data).catch(() => {});
            } catch (e) {}
        }
    }

    broadcastHeliMerge(masterHeliIndex, partnerHeliIndex, mergeLevel = 2) {
        const data = {
            masterHeliIndex: masterHeliIndex !== undefined ? masterHeliIndex : 0,
            partnerHeliIndex: partnerHeliIndex !== undefined ? partnerHeliIndex : 1,
            mergeLevel: mergeLevel,
            mergerId: this.localPlayerId,
            ts: Date.now()
        };
        this.broadcastPacket({
            type: 'HELI_MERGE',
            pid: this.localPlayerId,
            data
        });
        if (this.heliMergeRef) {
            try {
                this.heliMergeRef.set(data).catch(() => {});
            } catch (e) {}
        }
    }

    broadcastCarSync(carIndex, x, y, z, rotY, isDriven = false, vx = 0, vy = 0, vz = 0) {
        if (carIndex === undefined || carIndex < 0) return;
        const data = {
            carIndex,
            x: Math.round((x || 0) * 100) / 100,
            y: Math.round((y || 0) * 100) / 100,
            z: Math.round((z || 0) * 100) / 100,
            rotY: Math.round((rotY || 0) * 100) / 100,
            vx: Math.round((vx || 0) * 100) / 100,
            vy: Math.round((vy || 0) * 100) / 100,
            vz: Math.round((vz || 0) * 100) / 100,
            isDriven: !!isDriven,
            driverId: isDriven ? this.localPlayerId : null,
            ts: Date.now()
        };
        this.broadcastPacket({
            type: 'VEHICLE_SYNC',
            pid: this.localPlayerId,
            data
        });
        if (this.vehiclesRef) {
            try {
                this.vehiclesRef.child(String(carIndex)).set(data).catch(() => {});
            } catch (e) {}
        }
    }

    broadcastHeliSync(heliIndex, x, y, z, rotY, pitch = 0, roll = 0, isPiloted = false, vx = 0, vy = 0, vz = 0) {
        const hIdx = (heliIndex !== undefined && !isNaN(heliIndex)) ? heliIndex : 0;
        const data = {
            heliIndex: hIdx,
            x: Math.round((x || 0) * 100) / 100,
            y: Math.round((y || 0) * 100) / 100,
            z: Math.round((z || 0) * 100) / 100,
            rotY: Math.round((rotY || 0) * 100) / 100,
            pitch: Math.round((pitch || 0) * 100) / 100,
            roll: Math.round((roll || 0) * 100) / 100,
            vx: Math.round((vx || 0) * 100) / 100,
            vy: Math.round((vy || 0) * 100) / 100,
            vz: Math.round((vz || 0) * 100) / 100,
            isPiloted: !!isPiloted,
            pilotId: isPiloted ? this.localPlayerId : null,
            ts: Date.now()
        };
        this.broadcastPacket({
            type: 'HELI_SYNC',
            pid: this.localPlayerId,
            data
        });
        if (this.heliRef) {
            try {
                this.heliRef.child(String(hIdx)).set(data).catch(() => {});
            } catch (e) {}
        }
    }

    updateCarFromNetwork(carIndex, data) {
        if (!data || carIndex === undefined || isNaN(carIndex)) return;
        if (!window.gameEngine || !window.gameEngine.vehicleManager || !window.gameEngine.vehicleManager.cars) return;
        const car = window.gameEngine.vehicleManager.cars[carIndex];
        if (!car) return;

        const activeCar = window.gameEngine.vehicleManager.activeDrivenCar;
        const isLocallyDriving = (activeCar === car && !window.gameEngine.vehicleManager.isPassenger && window.gameEngine.vehicleManager.seatIndex === 0);
        if (isLocallyDriving) return;

        if (data.x !== undefined && data.y !== undefined && data.z !== undefined) {
            if (typeof car.applyNetworkTransform === 'function') {
                car.applyNetworkTransform(data.x, data.y, data.z, data.rotY || 0, data.vx || 0, data.vy || 0, data.vz || 0, !!data.isDriven);
            } else if (car.carGroup) {
                car.carGroup.position.set(data.x, data.y, data.z);
                if (data.rotY !== undefined) car.carGroup.rotation.set(0, data.rotY, 0);
            }
        }
    }

    updateHeliFromNetwork(data) {
        if (!data || !window.gameEngine) return;
        const helis = window.gameEngine.helicopters;
        const hIdx = (data.heliIndex !== undefined && !isNaN(data.heliIndex)) ? data.heliIndex : 0;
        const heli = (helis && helis[hIdx]) ? helis[hIdx] : window.gameEngine.helicopter;
        if (!heli || heli.isPiloted) return;

        if (data.x !== undefined && data.y !== undefined && data.z !== undefined) {
            if (typeof heli.applyNetworkTransform === 'function') {
                heli.applyNetworkTransform(data.x, data.y, data.z, data.rotY || 0, data.pitch || 0, data.roll || 0, data.vx || 0, data.vy || 0, data.vz || 0, !!data.isPiloted);
            } else if (heli.group) {
                heli.group.position.set(data.x, data.y, data.z);
            }
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
        } else if (type === 'ELEVATOR') {
            if (data && data.floorNum && window.gameEngine && window.gameEngine.elevatorSystem) {
                window.gameEngine.elevatorSystem.receiveNetworkElevatorCommand(data.floorNum);
            }
        } else if (type === 'PROP_BREAK') {
            if (data && data.propId !== undefined && window.gameEngine && window.gameEngine.streetLampManager) {
                window.gameEngine.streetLampManager.receiveNetworkBreakProp(data.propId, data.vx, data.vy, data.vz);
            }
        } else if (type === 'TREE_TOPPLE') {
            if (data && data.treeId !== undefined && window.gameEngine && window.gameEngine.vegetationManager) {
                const vm = window.gameEngine.vegetationManager;
                const tree = vm.treePositions ? vm.treePositions[data.treeId] : null;
                if (tree && !tree.isFallen) {
                    vm.toppleTree(tree, { x: data.dirX || 0, z: data.dirZ || 1 }, true);
                }
            }
        } else if (type === 'HELI_MERGE') {
            if (data && window.gameEngine && window.gameEngine.helicopters) {
                const helis = window.gameEngine.helicopters;
                const masterHeli = helis[data.masterHeliIndex !== undefined ? data.masterHeliIndex : 0];
                const partnerHeli = helis[data.partnerHeliIndex !== undefined ? data.partnerHeliIndex : 1];
                if (masterHeli && partnerHeli && !partnerHeli.isMerged && !partnerHeli.isBeingMerged) {
                    masterHeli.startMergeWith(partnerHeli, true);
                }
            }
        } else if (type === 'VEHICLE_SYNC') {
            if (data && data.carIndex !== undefined && pid !== this.localPlayerId) {
                this.updateCarFromNetwork(data.carIndex, data);
            }
        } else if (type === 'HELI_SYNC') {
            if (data && pid !== this.localPlayerId) {
                this.updateHeliFromNetwork(data);
            }
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

        try {
            const now = Date.now();
            let remote = this.remotePlayers.get(pid);

            if (!remote) {
                remote = new RemotePlayer(this.scene, pid, data);
                // Запоминаем локальное время получения пакета (исключает проблему рассинхронизации часов между устройствами)
                remote.lastReceiveTime = now;
                this.remotePlayers.set(pid, remote);
                this.updateOnlineHud();
                if (this.onPlayersUpdated) this.onPlayersUpdated(this.getRemotePlayersArray());
                if (window.gameEngine && window.gameEngine.multiplayerHUD) {
                    window.gameEngine.multiplayerHUD.addSystemMessage(`👋 Игрок "${remote.nickname}" присоединился к сессии!`);
                }
            } else {
                remote.lastReceiveTime = now;
                remote.applyNetworkState(data);
            }
        } catch (err) {
            console.error('[Multiplayer] Ошибка обработки состояния игрока:', pid, err);
        }
    }

    removeRemotePlayer(pid) {
        const remote = this.remotePlayers.get(pid);
        if (remote) {
            const name = remote.nickname;
            try {
                remote.destroy();
            } catch (e) {}
            this.remotePlayers.delete(pid);
            this.updateOnlineHud();
            if (this.onPlayersUpdated) this.onPlayersUpdated(this.getRemotePlayersArray());
            if (window.gameEngine && window.gameEngine.multiplayerHUD) {
                window.gameEngine.multiplayerHUD.addSystemMessage(`🚪 Игрок "${name}" покинул сессию.`);
            }
        }
    }

    /**
     * Сборка безопасного сериализуемого пакета локального игрока (без undefined значений)
     */
    buildLocalPayload() {
        const player = window.gameEngine?.player;
        const playerController = window.gameEngine?.playerController;
        const vehicleManager = window.gameEngine?.vehicleManager;
        const heli = window.gameEngine?.helicopter;
        const weaponSystem = window.gameEngine?.weaponSystem;

        if (!player || !player.mesh) return null;

        const isDriving = !!(vehicleManager && vehicleManager.activeDrivenCar !== null);
        const activeCar = isDriving ? vehicleManager.activeDrivenCar : null;

        let posX = 0, posY = 1.5, posZ = 15.0, rotY = 0;

        if (isDriving && activeCar) {
            const carPos = activeCar.chassisBody ? activeCar.chassisBody.position : (activeCar.carGroup ? activeCar.carGroup.position : player.mesh.position);
            posX = carPos.x || 0;
            posY = carPos.y || 0;
            posZ = carPos.z || 0;
            rotY = activeCar.carGroup ? activeCar.carGroup.rotation.y : (activeCar.group ? activeCar.group.rotation.y : 0);
        } else if (player.mesh) {
            posX = player.mesh.position.x || 0;
            posY = player.mesh.position.y || 0;
            posZ = player.mesh.position.z || 0;
            rotY = player.mesh.rotation.y || 0;
        } else if (player.body) {
            posX = player.body.position.x || 0;
            posY = (player.body.position.y || 0) - 0.815;
            posZ = player.body.position.z || 0;
            rotY = 0;
        }

        const isPassenger = isDriving && vehicleManager ? !!vehicleManager.isPassenger : false;
        const seatIndex = isDriving && vehicleManager ? (vehicleManager.seatIndex || 0) : 0;
        const isDriver = isDriving && activeCar && !isPassenger && (seatIndex === 0);

        let activeHeli = null;
        let activeHeliIndex = 0;
        if (window.gameEngine && window.gameEngine.helicopters) {
            for (let i = 0; i < window.gameEngine.helicopters.length; i++) {
                const h = window.gameEngine.helicopters[i];
                if (h && (h.isPiloted || h.isPassenger)) {
                    activeHeli = h;
                    activeHeliIndex = i;
                    break;
                }
            }
        }
        if (!activeHeli && heli && (heli.isPiloted || heli.isPassenger)) {
            activeHeli = heli;
            activeHeliIndex = heli.heliIndex || 0;
        }

        const isFlyingHeli = !!(activeHeli && (activeHeli.isPiloted || activeHeli.isPassenger));
        const isHeliPilot = isFlyingHeli && activeHeli && !!activeHeli.isPiloted;
        const heliSeat = isFlyingHeli && activeHeli ? (activeHeli.isPassenger ? 1 : 0) : 0;

        const pVx = (player.body && player.body.velocity) ? player.body.velocity.x : 0;
        const pVy = (player.body && player.body.velocity) ? player.body.velocity.y : 0;
        const pVz = (player.body && player.body.velocity) ? player.body.velocity.z : 0;

        const cVx = (isDriver && activeCar && activeCar.chassisBody) ? activeCar.chassisBody.velocity.x : 0;
        const cVy = (isDriver && activeCar && activeCar.chassisBody) ? activeCar.chassisBody.velocity.y : 0;
        const cVz = (isDriver && activeCar && activeCar.chassisBody) ? activeCar.chassisBody.velocity.z : 0;

        const hVx = (isHeliPilot && activeHeli && activeHeli.body) ? activeHeli.body.velocity.x : 0;
        const hVy = (isHeliPilot && activeHeli && activeHeli.body) ? activeHeli.body.velocity.y : 0;
        const hVz = (isHeliPilot && activeHeli && activeHeli.body) ? activeHeli.body.velocity.z : 0;

        const speed = player.body
            ? Math.hypot(player.body.velocity.x || 0, player.body.velocity.z || 0)
            : 0;

        const walkCycle = (playerController && playerController.animSystem)
            ? (playerController.animSystem.walkCycle || 0)
            : 0;

        const isSprinting = playerController && playerController.input ? !!playerController.input.keys.sprint : false;
        const health = playerController ? Math.round(playerController.health || 100) : 100;
        const weaponIdx = weaponSystem ? (weaponSystem.currentWeaponIndex || 0) : 0;

        return {
            nickname: this.nickname || 'Player',
            x: Math.round(posX * 100) / 100,
            y: Math.round(posY * 100) / 100,
            z: Math.round(posZ * 100) / 100,
            rotY: Math.round(rotY * 100) / 100,
            vx: Math.round((isDriver ? cVx : (isHeliPilot ? hVx : pVx)) * 100) / 100,
            vy: Math.round((isDriver ? cVy : (isHeliPilot ? hVy : pVy)) * 100) / 100,
            vz: Math.round((isDriver ? cVz : (isHeliPilot ? hVz : pVz)) * 100) / 100,
            speed: Math.round(speed * 10) / 10,
            walkCycle: Math.round(walkCycle * 100) / 100,
            isSprinting: isSprinting,
            isDriving: isDriving,
            carIndex: (isDriving && activeCar && activeCar.carIndex !== undefined) ? activeCar.carIndex : -1,
            seatIndex: seatIndex,
            isPassenger: isPassenger,
            carX: (isDriver && activeCar && activeCar.carGroup) ? Math.round(activeCar.carGroup.position.x * 100) / 100 : 0,
            carY: (isDriver && activeCar && activeCar.carGroup) ? Math.round(activeCar.carGroup.position.y * 100) / 100 : 0,
            carZ: (isDriver && activeCar && activeCar.carGroup) ? Math.round(activeCar.carGroup.position.z * 100) / 100 : 0,
            carRotY: (isDriver && activeCar && activeCar.carGroup) ? Math.round(activeCar.carGroup.rotation.y * 100) / 100 : 0,
            carVx: Math.round(cVx * 100) / 100,
            carVy: Math.round(cVy * 100) / 100,
            carVz: Math.round(cVz * 100) / 100,
            vehicleId: (isDriving && activeCar && activeCar.carName) ? activeCar.carName : '',
            isFlyingHeli: isFlyingHeli,
            isMegaHeli: (isFlyingHeli && activeHeli && !!activeHeli.isMega) ? true : false,
            isClimbingTree: playerController ? !!playerController.isClimbingTree : false,
            heliIndex: activeHeliIndex,
            heliSeat: heliSeat,
            heliX: (isHeliPilot && activeHeli && activeHeli.body) ? Math.round(activeHeli.body.position.x * 100) / 100 : 0,
            heliY: (isHeliPilot && activeHeli && activeHeli.body) ? Math.round(activeHeli.body.position.y * 100) / 100 : 0,
            heliZ: (isHeliPilot && activeHeli && activeHeli.body) ? Math.round(activeHeli.body.position.z * 100) / 100 : 0,
            heliRotY: (isHeliPilot && activeHeli) ? Math.round((activeHeli.headingAngle || 0) * 100) / 100 : 0,
            heliPitch: (isHeliPilot && activeHeli) ? Math.round((activeHeli.pitchAngle || 0) * 100) / 100 : 0,
            heliRoll: (isHeliPilot && activeHeli) ? Math.round((activeHeli.rollAngle || 0) * 100) / 100 : 0,
            heliVx: Math.round(hVx * 100) / 100,
            heliVy: Math.round(hVy * 100) / 100,
            heliVz: Math.round(hVz * 100) / 100,
            health: health,
            weaponIndex: weaponIdx,
            lastSeen: Date.now()
        };
    }

    sendLocalStateNow() {
        if (this.status !== 'CONNECTED' && this.status !== 'CONNECTING') return;
        const payload = this.buildLocalPayload();
        if (!payload) return;

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
            try {
                this.localPlayerRef.onDisconnect().cancel();
                this.localPlayerRef.remove();
            } catch (e) {}
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
        if (this.elevatorRef) {
            try { this.elevatorRef.off(); } catch (e) {}
            this.elevatorRef = null;
        }
        if (this.propsRef) {
            try {
                this.propsRef.off();
                this.propsRef.remove();
            } catch (e) {}
            this.propsRef = null;
        }
        if (this.vehiclesRef) {
            try {
                this.vehiclesRef.off();
                this.vehiclesRef.remove();
            } catch (e) {}
            this.vehiclesRef = null;
        }
        if (this.heliRef) {
            try {
                this.heliRef.off();
                this.heliRef.remove();
            } catch (e) {}
            this.heliRef = null;
        }
        // Очистка данных слияния вертолетов
        if (this.heliMergeRef) {
            try {
                this.heliMergeRef.off();
                this.heliMergeRef.remove();
            } catch (e) {}
            this.heliMergeRef = null;
        }
        // Очистка данных поваленных деревьев
        if (this.treesRef) {
            try {
                this.treesRef.off();
                this.treesRef.remove();
            } catch (e) {}
            this.treesRef = null;
        }
        if (this.connectedRef) {
            try { this.connectedRef.off(); } catch (e) {}
            this.connectedRef = null;
        }

        // Локальный сброс всей карты (все вертолеты, машины, деревья, фонари)
        if (window.gameEngine && typeof window.gameEngine.resetEntireMap === 'function') {
            try { window.gameEngine.resetEntireMap(); } catch (e) {}
        }

        // Удалить всех сетевых игроков
        this.remotePlayers.forEach((p) => p.destroy());
        this.remotePlayers.clear();

        this.updateStatus('OFFLINE', 'Отключено (Автономный режим)');
        this.updateOnlineHud();
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

        // 1. Обновление всех удаленных игроков и проверка таймаута (15 сек отсутствия локальных пакетов)
        const deadIds = [];
        this.remotePlayers.forEach((remote, pid) => {
            remote.update(deltaTime);
            if (now - (remote.lastReceiveTime || 0) > 15000) {
                deadIds.push(pid);
            }
        });

        if (deadIds.length > 0) {
            deadIds.forEach((pid) => this.removeRemotePlayer(pid));
        }

        // 2. Отправка состояния локального игрока (~13 Hz)
        if (this.status === 'OFFLINE' || !player || !player.mesh) {
            return;
        }

        if (now - this.lastPushTime >= this.pushIntervalMs) {
            this.lastPushTime = now;
            const payload = this.buildLocalPayload();
            if (!payload) return;

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

        // 3. Периодическая синхронизация управляемого транспорта водителем (~16 Hz)
        if (now - (this.lastVehiclePushTime || 0) >= 60) {
            this.lastVehiclePushTime = now;
            const vm = vehicleManager || window.gameEngine?.vehicleManager;
            if (vm && vm.activeDrivenCar && !vm.isPassenger && vm.seatIndex === 0) {
                const ac = vm.activeDrivenCar;
                if (ac.carIndex !== undefined && ac.carGroup) {
                    const cVx = ac.chassisBody ? ac.chassisBody.velocity.x : 0;
                    const cVy = ac.chassisBody ? ac.chassisBody.velocity.y : 0;
                    const cVz = ac.chassisBody ? ac.chassisBody.velocity.z : 0;
                    this.broadcastCarSync(
                        ac.carIndex,
                        ac.carGroup.position.x,
                        ac.carGroup.position.y,
                        ac.carGroup.position.z,
                        ac.carGroup.rotation.y,
                        true,
                        cVx,
                        cVy,
                        cVz
                    );
                }
            }
            const helis = window.gameEngine?.helicopters || [window.gameEngine?.helicopter].filter(Boolean);
            for (let i = 0; i < helis.length; i++) {
                const heli = helis[i];
                if (heli && heli.isPiloted && heli.body) {
                    const hVx = heli.body.velocity.x || 0;
                    const hVy = heli.body.velocity.y || 0;
                    const hVz = heli.body.velocity.z || 0;
                    this.broadcastHeliSync(
                        i,
                        heli.body.position.x,
                        heli.body.position.y,
                        heli.body.position.z,
                        heli.headingAngle || 0,
                        heli.pitchAngle || 0,
                        heli.rollAngle || 0,
                        true,
                        hVx,
                        hVy,
                        hVz
                    );
                }
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
