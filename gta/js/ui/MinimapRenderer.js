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
        const isEco = window.gameEngine && window.gameEngine.isPowerSavingMode;
        const skipThreshold = isEco ? 4 : 2; // В режиме ЭКО рендер миникарты на 15 FPS для освобождения CPU
        if (this.renderFrameSkip % skipThreshold !== 0) return;
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

        // 8. Сетевые игроки (Голубые светящиеся ромбы)
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

        // 11. Вертолеты (Золотые маркеры "H" на мини-карте)
        if (window.gameEngine && window.gameEngine.helicopters) {
            const helis = window.gameEngine.helicopters;
            for (let i = 0; i < helis.length; i++) {
                const h = helis[i];
                if (h && h.group && !h.isPiloted && !h.isPassenger && !h.isMerged) {
                    const hx = h.group.position.x * this.scale;
                    const hz = h.group.position.z * this.scale;

                    ctx.fillStyle = h.isMega ? '#00f0ff' : '#fbbf24';
                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = 1.2;
                    ctx.beginPath();
                    ctx.arc(hx, hz, 4.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();

                    ctx.fillStyle = '#000000';
                    ctx.font = 'bold 6px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(h.isMega ? '⚡' : 'H', hx, hz);
                }
            }
        }

        // 12. Универсальный GPS-Навигатор (Route & Beacon на миникарте)
        if (window.gameEngine && window.gameEngine.flightNavigation && window.gameEngine.flightNavigation.hasActiveTarget()) {
            const target = window.gameEngine.flightNavigation.getTargetPosition();
            if (target && playerPos) {
                const px = playerPos.x * this.scale;
                const pz = playerPos.z * this.scale;
                const tx = target.x * this.scale;
                const tz = target.z * this.scale;
                const navMode = window.gameEngine.flightNavigation.currentMode || 'FOOT';
                const isMegaHeli = !!(window.gameEngine.helicopter && window.gameEngine.helicopter.isMega && (window.gameEngine.helicopter.isPiloted || window.gameEngine.helicopter.isPassenger));

                // Линия курса
                ctx.save();
                const routeColor = (navMode === 'FOOT') ? 'rgba(0, 240, 255, 0.45)' : ((navMode === 'CAR') ? 'rgba(56, 189, 248, 0.5)' : (isMegaHeli ? 'rgba(0, 240, 255, 0.55)' : 'rgba(34, 197, 94, 0.5)'));
                ctx.strokeStyle = routeColor;
                ctx.lineWidth = 4.0;
                ctx.beginPath();
                ctx.moveTo(px, pz);
                ctx.lineTo(tx, tz);
                ctx.stroke();

                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.8;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(px, pz);
                ctx.lineTo(tx, tz);
                ctx.stroke();
                ctx.setLineDash([]);

                // Пульсирующая иконка целевой локации
                const pPulse = (Math.sin(this.blipPulseTimer * 2.5) + 1.0) * 0.5;
                const blipCol = (navMode === 'FOOT') ? '#00f0ff' : ((navMode === 'CAR') ? '#38bdf8' : (isMegaHeli ? '#00f0ff' : '#22c55e'));
                ctx.fillStyle = blipCol;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.arc(tx, tz, 5.5 + pPulse * 2.0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#000000';
                ctx.font = 'bold 7px Arial Black, Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const blipSymbol = (navMode === 'HELI') ? (isMegaHeli ? '⚡' : 'H') : '★';
                ctx.fillText(blipSymbol, tx, tz);
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
        const isFlyingHeli = !!(window.gameEngine && window.gameEngine.helicopter && (window.gameEngine.helicopter.isPiloted || window.gameEngine.helicopter.isPassenger));
        let playerYawWorld = 0;
        if (isFlyingHeli && window.gameEngine.helicopter) {
            playerYawWorld = window.gameEngine.helicopter.headingAngle || 0;
        } else if (isDriving) {
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

        // Отображение текущей высоты (Altitude HUD), если игрок на этажах небоскреба или в воздухе
        if (playerPos && playerPos.y > 5.0) {
            ctx.save();
            ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
            ctx.lineWidth = 1.0;
            ctx.beginPath();
            ctx.roundRect(this.centerX - 24, this.height - 24, 48, 14, 4);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#00f0ff';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`▲ ${Math.round(playerPos.y)}m`, this.centerX, this.height - 17);
            ctx.restore();
        }

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
