/**
 * MinimapRenderer - стилизованная 2D-миникарта HUD (GTA V Vector Minimap)
 * Отрисовывает рельеф, дороги, ориентиры, трафик, пешеходов, полицию и маркеры миссий
 */
class MinimapRenderer {
    constructor() {
        this.canvas = document.getElementById('minimap-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.width = 176;
        this.height = 176;
        this.centerX = 88;
        this.centerY = 88;
        this.radius = 84;
        this.scale = 0.92;
        this.blipPulseTimer = 0;

        this.initStaticMap();
    }

    initStaticMap() {
        const mapSize = Math.ceil(500 * this.scale);
        this.staticCanvas = document.createElement('canvas');
        this.staticCanvas.width = mapSize;
        this.staticCanvas.height = mapSize;
        this.staticOrigin = mapSize / 2;

        const sctx = this.staticCanvas.getContext('2d');
        sctx.translate(this.staticOrigin, this.staticOrigin);

        // Суша острова
        sctx.fillStyle = '#1e242d';
        sctx.fillRect(-220 * this.scale, -220 * this.scale, 440 * this.scale, 440 * this.scale);
        sctx.strokeStyle = '#334155';
        sctx.lineWidth = 2.0;
        sctx.strokeRect(-220 * this.scale, -220 * this.scale, 440 * this.scale, 440 * this.scale);

        // Дорожная сеть
        const gridRadius = 3;
        const BLOCK = 60.0 * this.scale;
        const maxCoord = gridRadius * BLOCK;

        sctx.strokeStyle = '#0f172a';
        sctx.lineWidth = 8.5;
        sctx.beginPath();
        for (let i = -gridRadius; i <= gridRadius; i++) {
            const pos = i * BLOCK;
            sctx.moveTo(-maxCoord, pos); sctx.lineTo(maxCoord, pos);
            sctx.moveTo(pos, -maxCoord); sctx.lineTo(pos, maxCoord);
        }
        sctx.stroke();

        sctx.strokeStyle = '#94a3b8';
        sctx.lineWidth = 5.2;
        sctx.beginPath();
        for (let i = -gridRadius; i <= gridRadius; i++) {
            const pos = i * BLOCK;
            sctx.moveTo(-maxCoord, pos); sctx.lineTo(maxCoord, pos);
            sctx.moveTo(pos, -maxCoord); sctx.lineTo(pos, maxCoord);
        }
        sctx.stroke();
    }

    render(playerPos, cameraYaw, allCars, allNPCs, soccerBalls, remotePlayers = []) {
        if (!this.ctx || !playerPos) return;
        this.renderFrameSkip = (this.renderFrameSkip || 0) + 1;
        if (this.renderFrameSkip % 2 !== 0) return; // 30 FPS рендер миникарты для снижения нагрузки на GPU
        const ctx = this.ctx;
        this.blipPulseTimer += 0.05;

        ctx.clearRect(0, 0, this.width, this.height);

        // 1. Ограничение круглой маской миникарты
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
        ctx.clip();

        // 2. Фон: Океан
        ctx.fillStyle = '#0c1a2d';
        ctx.fillRect(0, 0, this.width, this.height);

        // 3. Мировая система координат
        ctx.save();
        ctx.translate(this.centerX, this.centerY);
        ctx.rotate(cameraYaw);
        ctx.translate(-playerPos.x * this.scale, -playerPos.z * this.scale);

        // 4. Статичная карта
        if (this.staticCanvas) {
            ctx.drawImage(this.staticCanvas, -this.staticOrigin, -this.staticOrigin);
        }

        // 5. Футбольные мячи
        if (soccerBalls) {
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < soccerBalls.length; i++) {
                const b = soccerBalls[i].body.position;
                ctx.beginPath();
                ctx.arc(b.x * this.scale, b.z * this.scale, 2.4, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 6. Пешеходы
        if (allNPCs) {
            for (let i = 0; i < allNPCs.length; i++) {
                const npc = allNPCs[i];
                if (!npc.body) continue;
                const np = npc.body.position;
                ctx.fillStyle = npc.state === 'PANIC' ? '#ef4444' : '#fbbf24';
                ctx.beginPath();
                ctx.arc(np.x * this.scale, np.z * this.scale, 2.0, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 7. Гражданские автомобили
        if (allCars) {
            for (let i = 0; i < allCars.length; i++) {
                const car = allCars[i];
                const cp = car.chassisBody ? car.chassisBody.position : (car.carGroup ? car.carGroup.position : null);
                if (!cp) continue;
                const cyaw = car.carGroup ? car.carGroup.rotation.y : 0;

                ctx.save();
                ctx.translate(cp.x * this.scale, cp.z * this.scale);
                ctx.rotate(cyaw);
                ctx.fillStyle = '#06b6d4';
                ctx.fillRect(-2.0, -4.2, 4.0, 8.4);
                ctx.restore();
            }
        }

        // 8. Полицейские патрули (мигающие сине-красные значки)
        if (window.gameEngine && window.gameEngine.policeManager) {
            const pCars = window.gameEngine.policeManager.policeCars;
            const isRed = Math.sin(this.blipPulseTimer * 8.0) > 0;
            for (let i = 0; i < pCars.length; i++) {
                const pc = pCars[i];
                if (!pc.chassisBody) continue;
                const pp = pc.chassisBody.position;
                ctx.fillStyle = isRed ? '#ef4444' : '#3b82f6';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.arc(pp.x * this.scale, pp.z * this.scale, 4.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        }

        // 9. Маркеры миссий и чекпоинтов
        if (window.gameEngine && window.gameEngine.missionManager) {
            const mMgr = window.gameEngine.missionManager;
            if (mMgr.activeMission && mMgr.activeMission.targetPos) {
                // Активный чекпоинт
                const cp = mMgr.activeMission.targetPos;
                const pulse = 4.5 + Math.sin(this.blipPulseTimer * 6.0) * 1.5;
                ctx.fillStyle = '#facc15';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(cp.x * this.scale, cp.z * this.scale, pulse, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            } else {
                // Доступные миссии в мире
                mMgr.missions.forEach(m => {
                    const mp = m.startPos;
                    let bColor = '#00f0ff';
                    let label = 'M';
                    if (m.type === 'TAXI') { bColor = '#ffd700'; label = 'T'; }
                    else if (m.type === 'RACE') { bColor = '#00f0ff'; label = 'R'; }
                    else if (m.type === 'GANG') { bColor = '#ef4444'; label = 'G'; }
                    else if (m.type === 'DELIVERY') { bColor = '#22c55e'; label = 'D'; }

                    ctx.fillStyle = bColor;
                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = 1.2;
                    ctx.beginPath();
                    ctx.arc(mp.x * this.scale, mp.z * this.scale, 4.0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();

                    ctx.fillStyle = '#000000';
                    ctx.font = 'bold 6px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(label, mp.x * this.scale, mp.z * this.scale);
                });
            }
        }

        // 10. Сетевые игроки (Голубые светящиеся ромбы)
        if (remotePlayers && remotePlayers.length > 0) {
            for (let i = 0; i < remotePlayers.length; i++) {
                const rp = remotePlayers[i];
                const rx = rp.x * this.scale;
                const rz = rp.z * this.scale;

                ctx.save();
                ctx.translate(rx, rz);
                ctx.fillStyle = '#00e5ff';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.4;

                ctx.beginPath();
                ctx.moveTo(0, -4.5);
                ctx.lineTo(4.5, 0);
                ctx.lineTo(0, 4.5);
                ctx.lineTo(-4.5, 0);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.restore();
            }
        }

        ctx.restore(); // Конец мировой системы координат

        // 10. Радарная сетка
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(this.centerX, 4); ctx.lineTo(this.centerX, this.height - 4);
        ctx.moveTo(4, this.centerY); ctx.lineTo(this.width - 4, this.centerY);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, 36, 0, Math.PI * 2);
        ctx.arc(this.centerX, this.centerY, 64, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // 11. Белая стрелка игрока
        const isDriving = (window.gameEngine && window.gameEngine.vehicleManager && window.gameEngine.vehicleManager.activeDrivenCar !== null);
        let playerYawWorld = 0;
        if (isDriving) {
            const car = window.gameEngine.vehicleManager.activeDrivenCar;
            playerYawWorld = car.carGroup ? car.carGroup.rotation.y : 0;
        } else if (window.gameEngine && window.gameEngine.player && window.gameEngine.player.mesh) {
            playerYawWorld = window.gameEngine.player.mesh.rotation.y;
        }

        const playerRelativeAngle = (-playerYawWorld + Math.PI) + cameraYaw;

        ctx.save();
        ctx.translate(this.centerX, this.centerY);
        ctx.rotate(playerRelativeAngle);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(0, -10.5);
        ctx.lineTo(7.5, 7.5);
        ctx.lineTo(0, 4.5);
        ctx.lineTo(-7.5, 7.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // 12. Компас 'N'
        const compassAngle = cameraYaw - Math.PI / 2;
        const compX = this.centerX + Math.cos(compassAngle) * (this.radius - 11);
        const compY = this.centerY + Math.sin(compassAngle) * (this.radius - 11);
        ctx.fillStyle = '#ef4444';
        ctx.font = '900 11px Arial Black, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('N', compX, compY);

        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 3.0;
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.radius - 1.5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }
}
window.MinimapRenderer = MinimapRenderer;
