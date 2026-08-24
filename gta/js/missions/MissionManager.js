/**
 * MissionManager - менеджер городских заданий, гонок, заданий такси и перестрелок с бандами
 */
class MissionManager {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.hud = new MissionHUD();

        this.markers = [];
        this.activeMission = null;
        this.nearbyMissionMarker = null;
        this.activeCheckpointMarker = null;

        this.gangsters = [];

        this.initMissionPool();
        this.spawnWorldMissionMarkers();
    }

    initMissionPool() {
        this.missions = [
            {
                id: 'TAXI_MISSION',
                type: 'TAXI',
                title: 'Таксист Лос-Сантоса',
                reward: 15000,
                startPos: { x: -24.0, y: 0.2, z: -18.0 },
                destinationPos: { x: 120.0, y: 0.2, z: 95.0 },
                duration: 75.0,
                description: 'Доставьте пассажира в Вайнвуд без опозданий'
            },
            {
                id: 'STREET_RACE',
                type: 'RACE',
                title: 'Уличный Спринт',
                reward: 30000,
                startPos: { x: 24.0, y: 0.2, z: -18.0 },
                checkpoints: [
                    { x: 30.0, y: 0.2, z: 45.0 },
                    { x: -60.0, y: 0.2, z: 80.0 },
                    { x: -110.0, y: 0.2, z: -40.0 },
                    { x: -20.0, y: 0.2, z: -90.0 },
                    { x: 24.0, y: 0.2, z: -18.0 }
                ],
                duration: 65.0,
                description: 'Пройдите все чекпоинты трассы до истечения времени'
            },
            {
                id: 'GANG_TAKEDOWN',
                type: 'GANG',
                title: 'Зачистка Банды Складов',
                reward: 50000,
                startPos: { x: -75.0, y: 0.2, z: 65.0 },
                gangLocation: { x: -130.0, y: 0.2, z: 120.0 },
                duration: 90.0,
                description: 'Прибудьте в промзону и нейтрализуйте бандитов'
            },
            {
                id: 'HOT_DELIVERY',
                type: 'DELIVERY',
                title: 'Доставка Контрабанды',
                reward: 75000,
                startPos: { x: 65.0, y: 0.2, z: -75.0 },
                destinationPos: { x: -140.0, y: 0.2, z: -110.0 },
                duration: 85.0,
                description: 'Доставьте ценный груз в порт под давлением полиции'
            }
        ];
    }

    spawnWorldMissionMarkers() {
        this.missions.forEach(m => {
            const marker = new MissionMarker3D(
                this.scene, m.type, m.startPos.x, m.startPos.y, m.startPos.z, m.title, m.reward
            );
            marker.missionData = m;
            this.markers.push(marker);
        });
    }

    startMission(missionData) {
        if (this.activeMission) return;

        this.activeMission = {
            data: missionData,
            timer: missionData.duration,
            currentCheckpointIndex: 0,
            targetPos: null,
            isCompleted: false
        };

        if (missionData.type === 'RACE') {
            this.activeMission.targetPos = missionData.checkpoints[0];
            this.spawnCheckpointMarker(this.activeMission.targetPos);
        } else if (missionData.type === 'TAXI') {
            this.activeMission.targetPos = missionData.destinationPos;
            this.spawnCheckpointMarker(this.activeMission.targetPos);
        } else if (missionData.type === 'GANG') {
            this.activeMission.targetPos = missionData.gangLocation;
            this.spawnCheckpointMarker(this.activeMission.targetPos);
            this.spawnGangstersAt(missionData.gangLocation);
        } else if (missionData.type === 'DELIVERY') {
            this.activeMission.targetPos = missionData.destinationPos;
            this.spawnCheckpointMarker(this.activeMission.targetPos);
            // Активируем 2 звезды розыска
            if (window.gameEngine && window.gameEngine.wantedManager) {
                window.gameEngine.wantedManager.setStars(2);
            }
        }

        this.hud.showActiveMission(
            missionData.title,
            missionData.description,
            this.activeMission.timer,
            100
        );
    }

    spawnCheckpointMarker(pos) {
        if (this.activeCheckpointMarker) {
            this.activeCheckpointMarker.destroy();
        }
        this.activeCheckpointMarker = new MissionMarker3D(
            this.scene, 'CHECKPOINT', pos.x, pos.y, pos.z, 'Чекпоинт', 0
        );
    }

    spawnGangstersAt(pos) {
        this.clearGangsters();
        const count = 3;
        for (let i = 0; i < count; i++) {
            const offset = (i - 1) * 3.5;
            const officer = new PoliceOfficerNPC(
                this.scene, this.world,
                (window.gameEngine && window.gameEngine.physicsMaterials) || {},
                new THREE.Vector3(pos.x + offset, pos.y, pos.z + (Math.random() - 0.5) * 4.0)
            );
            this.gangsters.push(officer);
        }
    }

    clearGangsters() {
        for (let i = 0; i < this.gangsters.length; i++) {
            this.gangsters[i].destroy();
        }
        this.gangsters = [];
    }

    completeMission(passed, reason = '') {
        if (!this.activeMission) return;
        const data = this.activeMission.data;

        if (this.activeCheckpointMarker) {
            this.activeCheckpointMarker.destroy();
            this.activeCheckpointMarker = null;
        }

        if (passed) {
            if (window.gameEngine && window.gameEngine.playerController) {
                window.gameEngine.playerController.addMoney(data.reward);
            }
            this.hud.showCompletionBanner(true, data.reward);
        } else {
            this.hud.showCompletionBanner(false, 0, reason || 'Время вышло!');
        }

        this.clearGangsters();
        this.activeMission = null;
    }

    interactWithNearbyMarker() {
        if (this.nearbyMissionMarker && !this.activeMission) {
            this.startMission(this.nearbyMissionMarker.missionData);
        }
    }

    update(deltaTime, playerPos) {
        const dt = Math.min(deltaTime, 0.1);

        // Обновление анимаций 3D-маркеров
        this.markers.forEach(m => m.update(dt));
        if (this.activeCheckpointMarker) {
            this.activeCheckpointMarker.update(dt);
        }

        // Обновление бандитов
        for (let i = 0; i < this.gangsters.length; i++) {
            this.gangsters[i].update(dt, playerPos);
        }

        if (!playerPos) return;

        // 1. Проверка близости к маркерам начала миссии
        if (!this.activeMission) {
            let nearest = null;
            let minDist = 4.2;

            for (let i = 0; i < this.markers.length; i++) {
                const m = this.markers[i];
                const d = Math.hypot(playerPos.x - m.position.x, playerPos.z - m.position.z);
                if (d < minDist) {
                    minDist = d;
                    nearest = m;
                }
            }

            if (nearest) {
                this.nearbyMissionMarker = nearest;
                this.hud.showStartPrompt(nearest.title, nearest.reward);
            } else {
                this.nearbyMissionMarker = null;
                this.hud.hideStartPrompt();
            }
        } else {
            // 2. Логика выполнения активной миссии
            const m = this.activeMission;
            m.timer -= dt;

            const target = m.targetPos;
            const distToTarget = target ? Math.hypot(playerPos.x - target.x, playerPos.z - target.z) : 0;

            this.hud.updateActiveStats(m.timer, distToTarget);

            if (m.timer <= 0) {
                this.completeMission(false, 'Время вышло!');
                return;
            }

            // Проверка достижения цели
            if (m.data.type === 'RACE') {
                if (distToTarget < 5.5) {
                    m.currentCheckpointIndex++;
                    if (m.currentCheckpointIndex >= m.data.checkpoints.length) {
                        this.completeMission(true);
                    } else {
                        m.targetPos = m.data.checkpoints[m.currentCheckpointIndex];
                        this.spawnCheckpointMarker(m.targetPos);
                    }
                }
            } else if (m.data.type === 'TAXI' || m.data.type === 'DELIVERY') {
                if (distToTarget < 6.0) {
                    this.completeMission(true);
                }
            } else if (m.data.type === 'GANG') {
                // Победа, если все бандиты ликвидированы
                const allDead = (this.gangsters.length > 0) && this.gangsters.every(g => g.isDead);
                if (allDead) {
                    this.completeMission(true);
                }
            }
        }
    }
}
window.MissionManager = MissionManager;
